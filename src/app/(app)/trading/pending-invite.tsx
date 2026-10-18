"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useWallet } from "@/components/stellar/wallet-context";

/**
 * Invitación abierta antes de conectar la wallet: se recuerda en este
 * navegador para volver a ella después de entrar en Constelación (el login de
 * Cavos solo ocurre en `/trading`).
 */
const KEY = "constelacion:invite";

export function savePendingInvite(token: string) {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    // Sin almacenamiento: el usuario vuelve a abrir el enlace.
  }
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nada
  }
}

function readPendingInvite(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Aviso en el hub: "Tienes una invitación pendiente". */
export function PendingInviteBanner() {
  const { address } = useWallet();
  const token = useSyncExternalStore(
    () => () => {},
    readPendingInvite,
    () => null,
  );
  if (!address || !token) return null;
  return (
    <div className="surface rise flex flex-wrap items-center justify-between gap-3 border-violet-500/40 p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="size-4 text-violet-500" /> Tienes una invitación a una familia.
      </p>
      <Link href={`/trading/unirse/${token}`} className={buttonVariants({ size: "sm" })}>
        Continuar
      </Link>
    </div>
  );
}
