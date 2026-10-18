import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { repositories } from "@/infrastructure/container";
import { latestExchangeRate } from "@/lib/stellar/exchange-rate";
import { BackLink } from "@/components/back-link";
import { WalletBar, WalletGate } from "@/components/stellar/wallet-gate";
import { VaultBoard } from "./vault-board";

/** Bóveda familiar (3.0.0): ahorro común con meta; retiros con aprobación (K4). */
export default async function VaultPage() {
  await requireUser();
  const [stars, rate] = await Promise.all([
    repositories().then((r) => r.stars.list()),
    createClient().then(latestExchangeRate),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <BackLink href="/trading" label="Constelación" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bóveda familiar</h1>
        <p className="text-sm text-muted-foreground">
          Ahorro común en USDC. Todos depositan; para sacar, otro guardián aprueba. Así nadie, ni un
          estafador, la vacía solo.
        </p>
      </div>
      <WalletGate>
        <WalletBar />
        <VaultBoard stars={stars} rate={rate} />
      </WalletGate>
    </div>
  );
}
