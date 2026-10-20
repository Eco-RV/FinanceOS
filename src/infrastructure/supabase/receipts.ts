/**
 * Comprobantes (3.0.1, G8): bucket PRIVADO `receipts`, carpeta por usuario
 * (`<user_id>/<movimiento>-<marca>.<ext>`); la ruta queda en
 * `transactions.receipt_path` y se ven con un enlace firmado de 10 minutos.
 * SQL en `supabase/Versionamiento/3.0.1/09_receipts.sql`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { InfrastructureError, type ReceiptStorage } from "@/application";

const BUCKET = "receipts";
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function supabaseReceipts(supabase: SupabaseClient) {
  const pathOf = async (movementId: string): Promise<string | null> => {
    const { data, error } = await supabase.from("transactions").select("receipt_path").eq("id", movementId).maybeSingle();
    if (error) return null;
    return (data?.receipt_path as string | null) ?? null;
  };

  const receipts: ReceiptStorage = {
    async attach(movementId, file) {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new InfrastructureError("La sesión expiró. Vuelve a iniciar sesión.");
      const previous = await pathOf(movementId);
      const path = `${auth.user.id}/${movementId}-${Date.now()}.${EXT[file.type] ?? "bin"}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file.bytes, { contentType: file.type });
      if (error) {
        throw new InfrastructureError(
          /bucket not found/i.test(error.message)
            ? "Falta correr el SQL de la versión 3.0.1 (comprobantes)"
            : "No se pudo subir el comprobante",
        );
      }
      const { error: linkError } = await supabase.from("transactions").update({ receipt_path: path }).eq("id", movementId);
      if (linkError) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw new InfrastructureError("No se pudo ligar el comprobante al movimiento");
      }
      if (previous) await supabase.storage.from(BUCKET).remove([previous]);
    },
    async urlOf(movementId) {
      const path = await pathOf(movementId);
      if (!path) return null;
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
      if (error || !data) throw new InfrastructureError("No se pudo abrir el comprobante");
      return data.signedUrl;
    },
    async remove(movementId) {
      const path = await pathOf(movementId);
      const { error } = await supabase.from("transactions").update({ receipt_path: null }).eq("id", movementId);
      if (error) throw new InfrastructureError("No se pudo quitar el comprobante");
      if (path) await supabase.storage.from(BUCKET).remove([path]);
    },
  };
  return { receipts };
}
