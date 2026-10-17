"use client";

import { useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { displayStellarBalance } from "@/domain";
import { formatCurrency } from "@/lib/format";
import { explorerAccount } from "@/lib/stellar/env";
import { formatUsdc } from "@/lib/stellar/format";
import { cn } from "@/lib/utils";
import { useWallet } from "./wallet-context";
import { ReceiveDialog } from "./receive-dialog";
import { SendDialog } from "./send-dialog";
import { WalletSetup } from "./wallet-setup";

export type ExchangeRateView = { usd_crc: number; rate_on: string } | null;

/** Saldo en USDC con su equivalente aproximado en colones. */
export function PocketBalance({ rate, compact = false }: { rate: ExchangeRateView; compact?: boolean }) {
  const { balances } = useWallet();
  const usdc = displayStellarBalance(balances.usdc);
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">Mi ahorro en dólares digitales</p>
      <p className={cn("font-semibold tracking-tight tabular-nums", compact ? "text-3xl" : "text-5xl")}>
        {formatUsdc(usdc)}
      </p>
      <p className="text-sm text-muted-foreground tabular-nums">
        {rate
          ? `≈ ${formatCurrency(Math.trunc(usdc * rate.usd_crc * 100) / 100, "CRC")} con $1 = ${formatCurrency(rate.usd_crc, "CRC")}`
          : "Registra el tipo de cambio en Ajustes para ver el equivalente en colones."}
      </p>
    </div>
  );
}

/** Mi bolsillo (2.9.0): saldo, enviar, recibir y la puesta a punto de la wallet. */
export function Pocket({ rate }: { rate: ExchangeRateView }) {
  const { address, balances, updateBalances } = useWallet();
  const [refreshing, setRefreshing] = useState(false);
  if (!address) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="surface rise flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <PocketBalance rate={rate} />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Actualizar saldo"
            disabled={refreshing}
            onClick={async () => {
              setRefreshing(true);
              await updateBalances();
              setRefreshing(false);
            }}
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          </Button>
        </div>
        <div className="flex gap-3">
          <SendDialog />
          <ReceiveDialog address={address} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {balances.xlm ? `${displayStellarBalance(balances.xlm)} XLM de prueba para comisiones` : "Sin XLM todavía"}
          </span>
          <a
            href={explorerAccount(address)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
          >
            Ver en el explorador <ExternalLink className="size-3" />
          </a>
        </div>
      </div>
      <WalletSetup />
    </div>
  );
}
