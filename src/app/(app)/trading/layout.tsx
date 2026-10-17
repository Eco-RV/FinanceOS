import type { ReactNode } from "react";
import { StellarShell } from "@/components/stellar/stellar-shell";

/** Pestaña Constelación (2.9.0): todas sus páginas comparten la wallet de Stellar. */
export default function ConstellationLayout({ children }: { children: ReactNode }) {
  return <StellarShell>{children}</StellarShell>;
}
