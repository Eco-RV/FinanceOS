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
} from "@/application";
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
