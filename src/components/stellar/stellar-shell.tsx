"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Carga la wallet de Stellar solo en el navegador (Cavos y Stellar Wallets Kit
 * usan `window`). Envuelve las páginas de la pestaña Constelación.
 */
const StellarProviders = dynamic(() => import("./stellar-providers"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando la wallet">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
    </div>
  ),
});

export function StellarShell({ children }: { children: ReactNode }) {
  return <StellarProviders>{children}</StellarProviders>;
}
