"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PocketBalance, type ExchangeRateView } from "@/components/stellar/pocket";

/** Saldo del bolsillo en el hub, con acceso directo. */
export function PocketSummary({ rate }: { rate: ExchangeRateView }) {
  return (
    <div className="surface rise flex flex-wrap items-end justify-between gap-4 p-5">
      <PocketBalance rate={rate} compact />
      <Link href="/trading/bolsillo" className={buttonVariants({ size: "lg" })}>
        Abrir mi bolsillo <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
