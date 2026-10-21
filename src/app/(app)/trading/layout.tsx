import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { CONSTELLATION_ENABLED } from "@/lib/flags";
import { StellarShell } from "@/components/stellar/stellar-shell";
import { WalletLinker } from "./wallet-linker";

/**
 * Pestaña Constelación (2.9.0): todas sus páginas comparten la wallet de
 * Stellar. 3.0.0: la wallet conectada se liga a la cuenta (solo la dirección).
 * 3.2.0: solo con NEXT_PUBLIC_FEATURE_CONSTELLATION=1 (`src/lib/flags.ts`);
 * si no, 404 y no se cargan los SDK.
 */
export default function ConstellationLayout({ children }: { children: ReactNode }) {
  if (!CONSTELLATION_ENABLED) notFound();
  return (
    <StellarShell>
      <WalletLinker />
      {children}
    </StellarShell>
  );
}
