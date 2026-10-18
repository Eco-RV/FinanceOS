"use client";

import { useEffect } from "react";
import { useWallet } from "@/components/stellar/wallet-context";
import { linkWalletAction } from "./actions";

/** Direcciones ya ligadas en esta pestaña del navegador. */
const linked = new Set<string>();

/**
 * Liga en silencio la wallet conectada a la cuenta de Finance OS (solo la
 * dirección pública), para invitaciones y la agenda de la familia.
 */
export function WalletLinker() {
  const { address, connector } = useWallet();
  useEffect(() => {
    if (!address || !connector) return;
    const key = `${address}:${connector}`;
    if (linked.has(key)) return;
    linked.add(key);
    void linkWalletAction({ address, connector }).then((r) => {
      if (!r.ok) console.warn("No se pudo ligar la wallet:", r.message);
    });
  }, [address, connector]);
  return null;
}
