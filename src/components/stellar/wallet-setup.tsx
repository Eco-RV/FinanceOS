"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/stepper";
import {
  addUsdcTrustline,
  explainStellarError,
  fetchBalances,
  fundWithFriendbot,
  swapXlmForUsdc,
} from "@/infrastructure/stellar/horizon";
import { useWallet } from "./wallet-context";

/** Direcciones ya fondeadas en esta pestaña (Friendbot solo da una vez). */
const funded = new Set<string>();

/**
 * Puesta a punto de la wallet en testnet (lecciones de AstrOS): 1) Friendbot
 * PRIMERO (crea la cuenta con XLM de prueba), 2) abrir el bolsillo de USDC
 * (trustline), 3) conseguir USDC de prueba cambiando XLM en el DEX.
 */
export function WalletSetup() {
  const { address, balances, signTransaction, updateBalances, connector } = useWallet();
  const [busy, setBusy] = useState<null | "fund" | "trust" | "swap">(null);
  const started = useRef(false);

  // Una cuenta nueva no existe en la red hasta recibir XLM: se fondea sola.
  useEffect(() => {
    if (!address || balances.exists || funded.has(address) || started.current) return;
    started.current = true;
    funded.add(address);
    void (async () => {
      setBusy("fund");
      const ok = (await fundWithFriendbot(address)) || (await fetchBalances(address)).exists;
      await updateBalances();
      setBusy(null);
      if (ok) toast.success("Tu wallet recibió XLM de prueba para pagar comisiones");
      else toast.error("Friendbot está ocupado: inténtalo de nuevo en un rato");
    })();
  }, [address, balances.exists, updateBalances]);

  if (!address) return null;

  const steps = [
    { done: balances.exists, label: "Combustible", detail: "XLM de prueba para pagar comisiones" },
    { done: balances.usdc !== null, label: "Bolsillo USDC", detail: "Abrir tu bolsillo de dólares digitales" },
    { done: Number(balances.usdc ?? 0) > 0, label: "USDC de prueba", detail: "Conseguir dólares de prueba" },
  ];
  const current = steps.findIndex((s) => !s.done);
  if (current < 0) return null;

  async function run(kind: "trust" | "swap") {
    if (!address) return;
    setBusy(kind);
    try {
      if (kind === "trust") await addUsdcTrustline(address, signTransaction);
      else await swapXlmForUsdc(address, signTransaction);
      await updateBalances();
      toast.success(kind === "trust" ? "Bolsillo de dólares abierto" : "Recibiste USDC de prueba");
    } catch (e) {
      toast.error(explainStellarError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="surface flex flex-col gap-4 p-5">
      <div>
        <h2 className="font-semibold">Prepara tu wallet</h2>
        <p className="text-sm text-muted-foreground">
          Tres pasos, una sola vez. {connector === "cavos" ? "Puede aparecer una ventana para confirmar." : "Tu wallet te pedirá firmar."}
        </p>
      </div>
      {/* 3.1.0 · ley de conexión: los tres pasos se ven unidos. */}
      <Stepper steps={steps.map((s) => s.label)} current={current} />
      <p className="text-sm text-muted-foreground">
        Paso {current + 1}: {steps[current].detail}.
      </p>
      <div className="flex flex-wrap gap-2">
        {!balances.exists ? (
          <Button disabled>
            <LoaderCircle className="size-4 animate-spin" /> Cargando combustible…
          </Button>
        ) : balances.usdc === null ? (
          <Button onClick={() => void run("trust")} disabled={busy !== null}>
            {busy === "trust" ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Abrir mi bolsillo de dólares
          </Button>
        ) : (
          <Button onClick={() => void run("swap")} disabled={busy !== null}>
            {busy === "swap" ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Conseguir USDC de prueba
          </Button>
        )}
        {balances.usdc !== null ? (
          <a
            href="https://faucet.circle.com"
            target="_blank"
            rel="noreferrer"
            className="self-center text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            o el faucet de Circle ↗
          </a>
        ) : null}
      </div>
    </div>
  );
}
