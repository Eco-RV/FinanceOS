import type { ReactNode } from "react";
import { StellarShell } from "@/components/stellar/stellar-shell";
import { WalletLinker } from "./wallet-linker";

/**
 * Pestaña Constelación (2.9.0): todas sus páginas comparten la wallet de
 * Stellar. 3.0.0: la wallet conectada se liga a la cuenta (solo la dirección).
 */
export default function ConstellationLayout({ children }: { children: ReactNode }) {
  return (
    <StellarShell>
      <WalletLinker />
      {children}
    </StellarShell>
  );
}
