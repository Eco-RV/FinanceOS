"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { celebrate } from "@/lib/celebrate";

/**
 * Avisos que llegan en la URL (`?aviso=…`) al volver de un enlace del correo
 * (2.6.0): bienvenida al confirmar la cuenta, correo o contraseña
 * actualizados. Se muestran una vez y se quitan de la URL.
 */
export function UrlNotice() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const aviso = params.get("aviso");

  useEffect(() => {
    if (!aviso) return;
    if (aviso === "bienvenida") celebrate("¡Cuenta confirmada!", "Bienvenido a Finance OS");
    else if (aviso === "correo-actualizado") toast.success("Tu correo se actualizó");
    else if (aviso === "contrasena-actualizada") toast.success("Tu contraseña se actualizó");
    else return;
    const rest = new URLSearchParams(params);
    rest.delete("aviso");
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [aviso, params, pathname, router]);

  return null;
}
