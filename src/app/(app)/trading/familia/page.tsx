import { requireUser } from "@/lib/auth";
import { repositories } from "@/infrastructure/container";
import { BackLink } from "@/components/back-link";
import { WalletBar, WalletGate } from "@/components/stellar/wallet-gate";
import { FamilyBoard } from "./family-board";

/** Mi familia (3.0.0): la constelación, sus estrellas e invitaciones. */
export default async function FamilyPage() {
  await requireUser();
  const repos = await repositories();
  const [stars, invites] = await Promise.all([repos.stars.list(), repos.invites.listMine()]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <BackLink href="/trading" label="Constelación" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mi familia</h1>
        <p className="text-sm text-muted-foreground">
          Cada persona es una estrella. En la blockchain solo quedan direcciones y roles; los apodos
          los guardas tú en Finance OS.
        </p>
      </div>
      <WalletGate>
        <WalletBar />
        <FamilyBoard stars={stars} invites={invites} />
      </WalletGate>
    </div>
  );
}
