"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { loanPaymentSchema, loanRenameSchema, loanSchema } from "@/lib/schema";
import { fieldErrors, type FormResult } from "@/lib/forms";
import {
  createLoan as createLoanUseCase,
  payInstallment,
  removeFromCatalog,
  renameLoan as renameLoanUseCase,
  setCatalogActive,
  undoLastInstallment,
  prepayLoan,
  changeLoanRate,
  undoLastLoanAdjustment,
} from "@/application";
import { z } from "zod";
import { crToday, toISODate } from "@/domain";
import { repositories } from "@/infrastructure/container";
import { lifecycleForm, toFormResult } from "@/lib/catalog-actions";

function revalidate(id?: string) {
  revalidatePath("/procesos/prestamos");
  if (id) revalidatePath(`/procesos/prestamos/${id}`);
  // Pagos y desembolso son gastos/ingresos de una cuenta.
  revalidatePath("/procesos/gastos");
  revalidatePath("/procesos/ingresos");
  revalidatePath("/procesos/cuentas");
  revalidatePath("/dashboard");
}

export async function createLoan(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  await requireUser();

  const parsed = loanSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const { disbursement_account_id, disbursement_on, ...fields } = parsed.data;
  const result = await createLoanUseCase(await repositories(), {
    fields,
    disbursement:
      disbursement_account_id && disbursement_on
        ? { account_id: disbursement_account_id, occurred_on: disbursement_on }
        : null,
  });
  if (result.ok) revalidate(result.value.id);
  return toFormResult(result);
}

export async function renameLoan(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  await requireUser();

  const parsed = loanRenameSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const result = await renameLoanUseCase(await repositories(), parsed.data);
  if (result.ok) revalidate(parsed.data.id);
  return toFormResult(result);
}

/** L2: paga la próxima cuota del préstamo. */
export async function payLoanInstallment(
  _prev: FormResult,
  formData: FormData,
): Promise<FormResult> {
  await requireUser();

  const parsed = loanPaymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const result = await payInstallment(await repositories(), parsed.data);
  if (result.ok) revalidate(parsed.data.loan_id);
  return toFormResult(result);
}

/** L5: deshace el pago de la última cuota. */
export async function undoLoanInstallment(formData: FormData): Promise<FormResult> {
  await requireUser();
  const { id } = lifecycleForm(formData);
  if (!id) return { ok: false, message: "Falta el préstamo" };

  const result = await undoLastInstallment(await repositories(), id);
  if (result.ok) revalidate(id);
  return toFormResult(result);
}

/** G5: solo se elimina un préstamo sin cuotas pagadas (arrastra su desembolso). */
export async function deleteLoan(formData: FormData): Promise<FormResult> {
  await requireUser();
  const { id } = lifecycleForm(formData);
  if (!id) return { ok: false, message: "Falta el préstamo" };

  const { loans } = await repositories();
  const result = await removeFromCatalog(loans, "loan", id);
  if (result.ok) revalidate();
  return toFormResult(result);
}

/** Desactiva (p. ej. un préstamo ya liquidado) o reactiva un préstamo. */
export async function setLoanActive(formData: FormData): Promise<FormResult> {
  await requireUser();
  const { id, active } = lifecycleForm(formData);
  if (!id) return { ok: false, message: "Falta el préstamo" };

  const { loans } = await repositories();
  const result = await setCatalogActive(loans, "loan", id, active);
  if (result.ok) revalidate(id);
  return toFormResult(result);
}

const uuid = z.string().regex(/^[0-9a-fA-F-]{36}$/, "Inválido");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

/** L7 (3.1.0): abono extraordinario al capital. */
export async function prepayAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireUser();
  const parsed = z
    .object({
      loan_id: uuid,
      account_id: uuid,
      amount: z.coerce.number().finite().positive("Debe ser mayor que 0"),
      mode: z.enum(["term", "payment"]),
      occurred_on: isoDate,
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const result = await prepayLoan(await repositories(), { ...parsed.data, today: toISODate(crToday()) });
  if (result.ok) revalidate(parsed.data.loan_id);
  return toFormResult(result);
}

/** L8 (3.1.0): cambio de tasa desde una cuota. */
export async function changeRateAction(_prev: FormResult, formData: FormData): Promise<FormResult> {
  await requireUser();
  const parsed = z
    .object({
      loan_id: uuid,
      from_no: z.coerce.number().int().min(1),
      annual_rate: z.coerce.number().finite().min(0).max(100, "Máximo 100 %"),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const today = toISODate(crToday());
  const result = await changeLoanRate(await repositories(), { ...parsed.data, occurred_on: today, today });
  if (result.ok) revalidate(parsed.data.loan_id);
  return toFormResult(result);
}

export async function undoAdjustmentAction(formData: FormData): Promise<FormResult> {
  await requireUser();
  const loanId = (formData.get("loan_id") as string) || "";
  const result = await undoLastLoanAdjustment(await repositories(), loanId);
  if (result.ok) revalidate(loanId);
  return toFormResult(result);
}
