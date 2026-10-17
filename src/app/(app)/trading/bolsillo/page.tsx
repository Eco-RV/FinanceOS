import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { latestExchangeRate } from "@/lib/stellar/exchange-rate";
import { BackLink } from "@/components/back-link";
import { WalletBar, WalletGate } from "@/components/stellar/wallet-gate";
import { Pocket } from "@/components/stellar/pocket";

/** Mi bolsillo (2.9.0): mi wallet de USDC en Stellar testnet. */
export default async function PocketPage() {
  await requireUser();
  const rate = await latestExchangeRate(await createClient());

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <BackLink href="/trading" label="Constelación" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mi bolsillo</h1>
        <p className="text-sm text-muted-foreground">
          Tus dólares digitales (USDC) en Stellar. Red de prueba: el dinero no es real.
        </p>
      </div>
      <WalletGate>
        <WalletBar />
        <Pocket rate={rate} />
      </WalletGate>
    </div>
  );
}
