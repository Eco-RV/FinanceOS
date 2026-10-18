import { CandlestickChart, GraduationCap, HandCoins, Landmark, Sparkles, Users, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { latestExchangeRate } from "@/lib/stellar/exchange-rate";
import { NavCard, NavCardDisabled } from "@/components/nav-card";
import { Badge } from "@/components/ui/badge";
import { WalletBar, WalletGate } from "@/components/stellar/wallet-gate";
import { WalletSetup } from "@/components/stellar/wallet-setup";
import { PocketSummary } from "./pocket-summary";
import { PendingInviteBanner } from "./pending-invite";

const READY = [
  {
    href: "/trading/bolsillo",
    icon: Wallet,
    label: "Mi bolsillo",
    description: "Tu saldo en USDC: enviar, recibir y conseguir USDC de prueba.",
  },
  {
    href: "/trading/familia",
    icon: Users,
    label: "Mi familia",
    description: "Tu constelación: cada familiar es una estrella. Invita y administra.",
  },
  {
    href: "/trading/boveda",
    icon: Landmark,
    label: "Bóveda familiar",
    description: "Ahorro común con meta; los retiros los aprueba otro guardián.",
  },
];

const SOON = [
  {
    icon: HandCoins,
    label: "Apoyos",
    description: "Pagos con condición: se liberan cuando se cumple lo acordado.",
  },
  {
    icon: GraduationCap,
    label: "Academia",
    description: "Wallet, blockchain y USDC explicados con palabras sencillas.",
  },
  {
    icon: CandlestickChart,
    label: "Portafolio",
    description: "Tus inversiones aparte de las finanzas del día a día.",
  },
];

/** Constelación (2.9.0, beta): ahorro familiar en USDC sobre Stellar testnet. */
export default async function ConstellationPage() {
  await requireUser();
  const rate = await latestExchangeRate(await createClient());

  return (
    <div className="flex flex-col gap-8">
      <div className="rise flex flex-col items-start gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-violet-500/12 text-violet-600 dark:text-violet-400">
          <Sparkles className="size-6" />
        </span>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Constelación</h1>
          <Badge className="bg-violet-500 text-white uppercase">beta</Badge>
        </div>
        <p className="max-w-prose text-sm text-muted-foreground">
          Ahorra en dólares digitales y apoya a tu familia. Cada persona es una estrella. Funciona
          sobre Stellar en la red de prueba: el dinero no es real.
        </p>
      </div>

      <WalletGate signInHere>
        <div className="flex flex-col gap-4">
          <WalletBar />
          <PendingInviteBanner />
          <PocketSummary rate={rate} />
          <WalletSetup />
        </div>
      </WalletGate>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {READY.map((item, i) => (
          <div key={item.href} className="rise" style={{ ["--rise-i" as string]: i + 1 }}>
            <NavCard href={item.href} icon={item.icon} label={item.label} description={item.description} />
          </div>
        ))}
        {SOON.map((item, i) => (
          <div key={item.label} className="rise" style={{ ["--rise-i" as string]: i + READY.length + 1 }}>
            <NavCardDisabled
              icon={item.icon}
              label={item.label}
              description={item.description}
              badge={<Badge variant="secondary">Próximamente</Badge>}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
