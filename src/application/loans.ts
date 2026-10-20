/**
 * Casos de uso de préstamos bancarios (F5, L1–L5). El calendario de cuotas lo
 * calcula el dominio a partir de los términos; aquí solo se registran los
 * hechos: el desembolso (ingreso opcional) y el pago de cada cuota (gasto).
 */

import {
  assertActive,
  assertCategoryUsable,
  assertSameCurrency,
  DomainError,
  installmentNote,
  lastPaidInstallment,
  LOAN_CATEGORY,
  loanProgress,
  loanSchedule,
  nextInstallment,
  validateLoanPrepayment,
  validateLoanRateChange,
  validateLoanTerms,
  validateMovement,
  type AmortizationEvent,
  type Currency,
  type ISODate,
  type LoanTerms,
  type PrepaymentMode,
} from "../domain/index.ts";
import type {
  AccountRepository,
  CategoryRepository,
  Loan,
  LoanFields,
  LoanRepository,
  MovementRepository,
} from "./ports.ts";
import { fail, ok, run, type UseCaseResult } from "./result.ts";

export type LoanDeps = {
  loans: LoanRepository;
  accounts: AccountRepository;
  movements: MovementRepository;
  categories: CategoryRepository;
};

export function termsOf(
  loan: Pick<Loan, "principal" | "annual_rate" | "months" | "first_payment_on" | "currency">,
  /** 3.1.0: abonos (L7) y cambios de tasa (L8), en orden. */
  adjustments: AmortizationEvent[] = [],
): LoanTerms {
  return {
    principal: Number(loan.principal),
    annualRatePercent: Number(loan.annual_rate),
    months: Number(loan.months),
    firstPaymentOn: loan.first_payment_on,
    currency: loan.currency,
    adjustments,
  };
}

/** Términos con los ajustes guardados del préstamo. */
async function currentTerms(loans: LoanDeps["loans"], loan: Loan): Promise<LoanTerms> {
  return termsOf(loan, (await loans.adjustments(loan.id)).map((a) => a.event));
}

/** Moneda de una cuenta activa (G4) y que coincida con la del préstamo (G3). */
async function accountFor(
  accounts: AccountRepository,
  accountId: string,
  loanCurrency: Currency,
): Promise<Currency> {
  const currency = await accounts.currencyOf(accountId);
  if (!currency) throw new DomainError("G4", "Cuenta no encontrada o desactivada");
  assertSameCurrency(currency, loanCurrency);
  return currency;
}

export type CreateLoanInput = {
  fields: LoanFields;
  /** Registrar el dinero recibido como ingreso en una cuenta (opcional). */
  disbursement?: { account_id: string; occurred_on: ISODate } | null;
};

/** Crea un préstamo (L1) y, si se pide, registra su desembolso como ingreso. */
export function createLoan(
  deps: LoanDeps,
  input: CreateLoanInput,
): Promise<UseCaseResult<{ id: string }>> {
  return run(async () => {
    const { fields, disbursement } = input;
    validateLoanTerms(termsOf(fields));
    if (fields.account_id) await accountFor(deps.accounts, fields.account_id, fields.currency);

    let disbursementCurrency: Currency | null = null;
    if (disbursement) {
      disbursementCurrency = await accountFor(deps.accounts, disbursement.account_id, fields.currency);
      assertCategoryUsable({
        category: LOAN_CATEGORY,
        deactivated: await deps.categories.isDeactivated("income", LOAN_CATEGORY),
      });
    }

    const { id } = await deps.loans.create(fields);
    if (disbursement && disbursementCurrency) {
      try {
        await deps.movements.create({
          type: "income",
          amount: Number(fields.principal),
          currency: disbursementCurrency,
          occurred_on: disbursement.occurred_on,
          category: LOAN_CATEGORY,
          note: `Desembolso · ${fields.name}`.slice(0, 200),
          account_id: disbursement.account_id,
          card_id: null,
          loan_id: id,
        });
      } catch (e) {
        // Un préstamo nuevo sin su desembolso no debe quedar a medias.
        await deps.loans.delete(id);
        throw e;
      }
    }
    return ok({ id });
  });
}

/** Cambia nombre, prestamista o cuenta sugerida. Los términos no se editan. */
export function renameLoan(
  deps: Pick<LoanDeps, "loans" | "accounts">,
  input: { id: string; name: string; lender: string | null; account_id: string | null },
): Promise<UseCaseResult> {
  return run(async () => {
    const loan = await deps.loans.find(input.id);
    if (!loan) return fail("Préstamo no encontrado");
    assertActive("loan", loan.name, loan.archived);
    if (input.account_id) await accountFor(deps.accounts, input.account_id, loan.currency);
    await deps.loans.rename(input.id, {
      name: input.name,
      lender: input.lender,
      account_id: input.account_id,
    });
    return ok();
  });
}

export type PayInstallmentInput = {
  loan_id: string;
  account_id: string;
  occurred_on: ISODate;
};

/**
 * L2/L3: paga la próxima cuota en orden. Crea un gasto desde una cuenta de
 * débito activa en la moneda del préstamo, por el monto de la cuota (interés
 * + capital), con la fecha real del pago.
 */
export function payInstallment(
  deps: LoanDeps,
  input: PayInstallmentInput,
): Promise<UseCaseResult<{ installmentNo: number; amount: number }>> {
  return run(async () => {
    const loan = await deps.loans.find(input.loan_id);
    if (!loan) return fail("Préstamo no encontrado");
    assertActive("loan", loan.name, loan.archived);

    const accountCurrency = await accountFor(deps.accounts, input.account_id, loan.currency);
    const schedule = loanSchedule(await currentTerms(deps.loans, loan));
    const row = nextInstallment(schedule, await deps.loans.paidInstallments(loan.id));

    assertCategoryUsable({
      category: LOAN_CATEGORY,
      deactivated: await deps.categories.isDeactivated("expense", LOAN_CATEGORY),
    });
    const currency = validateMovement({
      type: "expense",
      amount: row.payment,
      category: LOAN_CATEGORY,
      accountCurrency,
      cardCurrency: null,
    });

    await deps.movements.create({
      type: "expense",
      amount: row.payment,
      currency,
      occurred_on: input.occurred_on,
      category: LOAN_CATEGORY,
      note: installmentNote(loan.name, row, schedule.rows.length).slice(0, 200),
      account_id: input.account_id,
      card_id: null,
      loan_id: loan.id,
      installment_no: row.no,
    });
    return ok({ installmentNo: row.no, amount: row.payment });
  });
}

/** L5: deshace el pago de la última cuota pagada (borra ese gasto). */
export function undoLastInstallment(
  deps: Pick<LoanDeps, "loans" | "movements">,
  loanId: string,
): Promise<UseCaseResult<{ installmentNo: number }>> {
  return run(async () => {
    const loan = await deps.loans.find(loanId);
    if (!loan) return fail("Préstamo no encontrado");
    assertActive("loan", loan.name, loan.archived);
    const adjustments = (await deps.loans.adjustments(loanId)).map((a) => a.event);
    const no = lastPaidInstallment(await deps.loans.paidInstallments(loanId), adjustments);
    const movementId = await deps.loans.paymentOf(loanId, no);
    if (!movementId) return fail("No se encontró el pago de esa cuota");
    await deps.movements.delete(movementId);
    return ok({ installmentNo: no });
  });
}

export type PrepayLoanInput = {
  loan_id: string;
  account_id: string;
  amount: number;
  mode: PrepaymentMode;
  occurred_on: ISODate;
  today: ISODate;
};

/**
 * L7 (3.1.0): abono extraordinario al capital. Sale de una cuenta activa de la
 * moneda del préstamo como un gasto con `loan_id` (sin número de cuota) y
 * recalcula el calendario: baja el plazo (misma cuota) o la cuota (mismo plazo).
 */
export function prepayLoan(
  deps: LoanDeps,
  input: PrepayLoanInput,
): Promise<UseCaseResult<{ remainingInstallments: number; payment: number }>> {
  return run(async () => {
    const loan = await deps.loans.find(input.loan_id);
    if (!loan) return fail("Préstamo no encontrado");
    assertActive("loan", loan.name, loan.archived);
    const accountCurrency = await accountFor(deps.accounts, input.account_id, loan.currency);

    const terms = await currentTerms(deps.loans, loan);
    const paid = await deps.loans.paidInstallments(loan.id);
    const progress = loanProgress(terms, paid, input.today);
    validateLoanPrepayment(progress, input.amount, input.mode);

    const currency = validateMovement({
      type: "expense",
      amount: input.amount,
      category: LOAN_CATEGORY,
      accountCurrency,
      cardCurrency: null,
    });
    const event: AmortizationEvent = {
      kind: "prepayment",
      afterNo: progress.paidCount,
      amount: input.amount,
      mode: input.mode,
    };
    const { id: movementId } = await deps.movements.create({
      type: "expense",
      amount: input.amount,
      currency,
      occurred_on: input.occurred_on,
      category: LOAN_CATEGORY,
      note: `${loan.name} · abono extraordinario al capital (${input.mode === "term" ? "baja el plazo" : "baja la cuota"})`.slice(0, 200),
      account_id: input.account_id,
      card_id: null,
      loan_id: loan.id,
      installment_no: null,
    });
    try {
      await deps.loans.addAdjustment(loan.id, { event, occurred_on: input.occurred_on, transaction_id: movementId });
    } catch (e) {
      await deps.movements.delete(movementId);
      throw e;
    }
    const after = loanSchedule({ ...terms, adjustments: [...(terms.adjustments ?? []), event] });
    const left = after.rows.slice(progress.paidCount);
    return ok({ remainingInstallments: left.length, payment: left[0]?.payment ?? 0 });
  });
}

/** L8 (3.1.0): la tasa cambia desde una cuota sin pagar; se recalcula la cuota. */
export function changeLoanRate(
  deps: Pick<LoanDeps, "loans">,
  input: { loan_id: string; from_no: number; annual_rate: number; occurred_on: ISODate; today: ISODate },
): Promise<UseCaseResult<{ payment: number }>> {
  return run(async () => {
    const loan = await deps.loans.find(input.loan_id);
    if (!loan) return fail("Préstamo no encontrado");
    assertActive("loan", loan.name, loan.archived);
    const terms = await currentTerms(deps.loans, loan);
    const progress = loanProgress(terms, await deps.loans.paidInstallments(loan.id), input.today);
    validateLoanRateChange(progress, input.from_no, input.annual_rate);
    const event: AmortizationEvent = { kind: "rate", fromNo: input.from_no, annualRatePercent: input.annual_rate };
    await deps.loans.addAdjustment(loan.id, { event, occurred_on: input.occurred_on, transaction_id: null });
    const after = loanSchedule({ ...terms, adjustments: [...(terms.adjustments ?? []), event] });
    return ok({ payment: after.rows[input.from_no - 1]?.payment ?? 0 });
  });
}

/**
 * Deshace el último ajuste (abono o cambio de tasa), solo si no hay cuotas
 * pagadas después de él (así el calendario de lo pagado no cambia).
 */
export function undoLastLoanAdjustment(
  deps: Pick<LoanDeps, "loans" | "movements">,
  loanId: string,
): Promise<UseCaseResult> {
  return run(async () => {
    const loan = await deps.loans.find(loanId);
    if (!loan) return fail("Préstamo no encontrado");
    assertActive("loan", loan.name, loan.archived);
    const list = await deps.loans.adjustments(loanId);
    const last = list.at(-1);
    if (!last) return fail("El préstamo no tiene ajustes");
    const paid = Math.max(0, ...(await deps.loans.paidInstallments(loanId)));
    const at = last.event.kind === "prepayment" ? last.event.afterNo : last.event.fromNo - 1;
    if (paid > at) return fail("Ya hay cuotas pagadas después de ese ajuste: deshazlas primero", "L5");
    await deps.loans.deleteAdjustment(last.id);
    if (last.transaction_id) await deps.movements.delete(last.transaction_id);
    return ok();
  });
}
