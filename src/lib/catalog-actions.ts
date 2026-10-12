import type { UseCaseResult } from "@/application";
import type { FormResult } from "@/lib/forms";

/** Lee `id` y `active` ("true"/"false") de un formulario de activar/desactivar. */
export function lifecycleForm(formData: FormData): { id: string | null; active: boolean } {
  return {
    id: (formData.get("id") as string) || null,
    active: formData.get("active") === "true",
  };
}

/** Convierte el resultado de un caso de uso en el `FormResult` de los formularios. */
export function toFormResult(result: UseCaseResult<unknown>): FormResult {
  return result.ok ? { ok: true } : { ok: false, message: result.message };
}
