import assert from "node:assert/strict";
import { test } from "node:test";
import { DomainError } from "../shared/errors.ts";
import {
  installmentNote,
  lastPaidInstallment,
  loanDue,
  loanProgress,
  loanSchedule,
  nextInstallment,
  paidInOrder,
  validateLoanTerms,
  type LoanTerms,
} from "./loan.ts";

// Ejemplo de docs/historias-usuario/tarjetas.md (F5): ₡600 000, 24 % anual, 12 meses.
const terms: LoanTerms = {
  principal: 600_000,
  annualRatePercent: 24,
  months: 12,
  firstPaymentOn: "2026-11-01",
  currency: "CRC",
};

function rule(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    assert.ok(e instanceof DomainError);
    return e.rule;
  }
}

test("F5: cuota fija y tabla del ejemplo documentado", () => {
  const s = loanSchedule(terms);
  assert.equal(s.payment, 56_735.76);
  assert.equal(s.rows.length, 12);
  assert.deepEqual(
    [s.rows[0].interest, s.rows[0].principal, s.rows[0].balance],
    [12_000, 44_735.76, 555_264.24],
  );
  assert.equal(s.rows[11].balance, 0);
  assert.equal(s.rows[11].occurred_on, "2027-10-01");
});

test("L1: términos inválidos se rechazan", () => {
  assert.equal(rule(() => validateLoanTerms({ ...terms, principal: 0 })), "G2");
  assert.equal(rule(() => validateLoanTerms({ ...terms, annualRatePercent: -1 })), "L1");
  assert.equal(rule(() => validateLoanTerms({ ...terms, annualRatePercent: 101 })), "L1");
  assert.equal(rule(() => validateLoanTerms({ ...terms, months: 0 })), "L1");
  assert.equal(rule(() => validateLoanTerms({ ...terms, months: 481 })), "L1");
  assert.equal(rule(() => validateLoanTerms({ ...terms, months: 1.5 })), "L1");
  assert.equal(rule(() => validateLoanTerms({ ...terms, annualRatePercent: 0 })), null);
});

test("L2: las cuotas se pagan en orden; un hueco corta el avance", () => {
  assert.equal(paidInOrder([]), 0);
  assert.equal(paidInOrder([1, 2, 3]), 3);
  assert.equal(paidInOrder([1, 3]), 1);
  const s = loanSchedule(terms);
  assert.equal(nextInstallment(s, []).no, 1);
  assert.equal(nextInstallment(s, [1, 2]).no, 3);
});

test("L3: no hay próxima cuota en un préstamo pagado", () => {
  const s = loanSchedule(terms);
  const all = s.rows.map((r) => r.no);
  assert.equal(rule(() => nextInstallment(s, all)), "L3");
});

test("L5: solo se deshace la última cuota pagada", () => {
  assert.equal(lastPaidInstallment([1, 2, 3]), 3);
  assert.equal(rule(() => lastPaidInstallment([])), "L5");
});

test("L4: avance, atrasos e intereses a una fecha", () => {
  const p0 = loanProgress(terms, [], "2026-10-12");
  assert.equal(p0.status, "al-dia");
  assert.equal(p0.remainingPrincipal, 600_000);
  assert.equal(p0.next?.no, 1);
  assert.equal(p0.interestPaid, 0);
  assert.equal(p0.interestPending, loanSchedule(terms).totalInterest);

  // Vence el 1 de noviembre: ese día todavía está al día; al siguiente, atrasado.
  assert.equal(loanProgress(terms, [], "2026-11-01").status, "al-dia");
  const late = loanProgress(terms, [], "2026-12-15");
  assert.equal(late.status, "atrasado");
  assert.deepEqual(late.overdue.map((r) => r.no), [1, 2]);

  const p2 = loanProgress(terms, [1, 2], "2026-12-15");
  assert.equal(p2.status, "al-dia");
  assert.equal(p2.paidCount, 2);
  assert.equal(p2.remainingPrincipal, 509_633.76);
  assert.equal(p2.interestPaid, 23_105.28);
  assert.equal(p2.principalPaid, 90_366.24);

  const done = loanProgress(terms, loanSchedule(terms).rows.map((r) => r.no), "2030-01-01");
  assert.equal(done.status, "pagado");
  assert.equal(done.next, null);
  assert.equal(done.remainingPrincipal, 0);
  assert.equal(done.interestPending, 0);
});

test("installmentNote desglosa interés y capital", () => {
  const row = loanSchedule(terms).rows[0];
  assert.equal(
    installmentNote("Carro", row, 12),
    "Carro · cuota 1/12 (interés 12000.00 · capital 44735.76)",
  );
});

test("L6: cuota a cobro — vencidas suman; la próxima solo dentro del horizonte", () => {
  // Primera cuota el 1/11: el 12/10 faltan 20 días → entra.
  assert.deepEqual(loanDue(loanProgress(terms, [], "2026-10-12"), "2026-10-12"), {
    amount: 56_735.76,
    dueOn: "2026-11-01",
    overdue: false,
    installments: [1],
  });
  // El 15/09 faltan 47 días → todavía no.
  assert.equal(loanDue(loanProgress(terms, [], "2026-09-15"), "2026-09-15"), null);
  // Dos cuotas vencidas.
  const late = loanDue(loanProgress(terms, [], "2026-12-15"), "2026-12-15");
  assert.deepEqual(late, {
    amount: 113_471.52,
    dueOn: "2026-11-01",
    overdue: true,
    installments: [1, 2],
  });
  // Pagado: nada.
  const all = loanSchedule(terms).rows.map((r) => r.no);
  assert.equal(loanDue(loanProgress(terms, all, "2030-01-01"), "2030-01-01"), null);
});
