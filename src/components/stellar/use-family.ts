"use client";

import { useCallback, useEffect, useState } from "react";
import type { contract } from "@stellar/stellar-sdk";
import {
  familiesOf,
  familyClient,
  readFamilySnapshot,
  signAndSendResult,
  type FamilySnapshot,
} from "@/infrastructure/stellar/family";
import { explainStellarError } from "@/infrastructure/stellar/horizon";
import { useWallet } from "./wallet-context";

export type FamilyState =
  | { status: "loading" }
  | { status: "none" }
  | { status: "error"; message: string }
  | { status: "ready"; familyId: number; snapshot: FamilySnapshot };

/**
 * La familia de la wallet conectada, leída del contrato (D6: la interfaz
 * muestra la primera). `refresh()` después de cada firma.
 */
export function useMyFamily() {
  const { address } = useWallet();
  const [state, setState] = useState<FamilyState>({ status: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!address) return;
    let alive = true;
    void (async () => {
      try {
        const ids = await familiesOf(address);
        if (!alive) return;
        if (ids.length === 0) return setState({ status: "none" });
        const snapshot = await readFamilySnapshot(ids[0]);
        if (!alive) return;
        setState(snapshot ? { status: "ready", familyId: ids[0], snapshot } : { status: "none" });
      } catch (e) {
        if (alive) setState({ status: "error", message: e instanceof Error ? e.message : "No se pudo leer la familia" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [address, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  return { state, refresh };
}

/**
 * Escritura en el contrato `family`: simula (si el contrato rechaza, muestra
 * su mensaje sin pedir firma), firma en la wallet y envía.
 */
export function useFamilyWrite() {
  const { address, signTransaction, connector, updateBalances } = useWallet();
  const [pending, setPending] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(
      label: string,
      build: (client: Awaited<ReturnType<typeof familyClient>>, me: string) => Promise<contract.AssembledTransaction<contract.Result<T>>>,
    ): Promise<{ ok: true; value: T } | { ok: false; message: string }> => {
      if (!address) return { ok: false, message: "Conecta tu wallet primero" };
      setPending(label);
      try {
        const client = await familyClient({ address, sign: signTransaction });
        const value = await signAndSendResult(await build(client, address));
        void updateBalances();
        return { ok: true, value };
      } catch (e) {
        const message = e instanceof Error && !/HostError|simulation|Error\(/i.test(e.message) && e.message.length < 160
          ? e.message
          : explainStellarError(e);
        return { ok: false, message };
      } finally {
        setPending(null);
      }
    },
    [address, signTransaction, updateBalances],
  );

  return { run, pending, needsApprovalModal: connector === "cavos" };
}
