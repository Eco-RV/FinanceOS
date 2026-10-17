"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Fuel, LoaderCircle, PiggyBank, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
    { done: balances.exists, label: "Combustible (XLM de prueba)", icon: Fuel },
    { done: balances.usdc !== null, label: "Bolsillo de dólares abierto (USDC)", icon: Wallet },
    { done: Number(balances.usdc ?? 0) > 0, label: "Tienes USDC de prueba", icon: PiggyBank },
  ];
  if (steps.every((s) => s.done)) return null;

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
      <ol className="flex flex-col gap-2">
        {steps.map(({ done, label, icon: Icon }, i) => (
          <li key={label} className="flex items-center gap-3 text-sm">
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full",
                done ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check className="size-4" /> : <Icon className="size-4" />}
            </span>
            <span className={cn(done && "text-muted-foreground line-through")}>
              {i + 1}. {label}
            </span>
          </li>
        ))}
      </ol>
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
