import type { ComponentType } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Banknote,
  CreditCard,
  HandHeart,
  HandCoins,
  Inbox,
  Landmark,
  Receipt,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { crToday, toISODate } from "@/domain";
import { loadFinancingBoard } from "@/lib/financing-board";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Item = {
  href: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  badge?: number;
};

const ITEMS: Item[] = [
  {
    href: "/procesos/cuentas",
    label: "Cuentas",
    description: "Saldos de débito, ahorro y efectivo.",
    icon: Landmark,
  },
  {
    href: "/procesos/tarjetas",
    label: "Tarjetas",
    description: "Saldo, corte, pago y movimientos de cada tarjeta.",
    icon: CreditCard,
  },
  {
    href: "/procesos/gastos",
    label: "Gastos",
    description: "Pagos desde una cuenta o cargos a una tarjeta.",
    icon: Receipt,
  },
  {
    href: "/procesos/ingresos",
    label: "Ingresos",
    description: "Depósitos y entradas a tus cuentas.",
    icon: Banknote,
  },
  {
    href: "/procesos/prestamos",
    label: "Préstamos",
    description: "Cuota fija, calendario de pagos e intereses.",
    icon: HandCoins,
  },
  {
    href: "/procesos/cobros",
    label: "Cobros a miembros",
    description: "Avisos de cuota y lo que tu familia te debe de financiamientos.",
    icon: HandHeart,
  },
  {
    href: "/procesos/transferencias",
    label: "Transferencias",
    description: "Entre tus cuentas; no cuentan como gasto.",
    icon: ArrowLeftRight,
  },
];

export default async function ProcesosPage() {
  await requireUser();

  const supabase = await createClient();
  const [{ count }, board] = await Promise.all([
    supabase
      .from("pending_transactions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("archived", false),
    loadFinancingBoard(supabase, toISODate(crToday())),
  ]);
  const noticesToSend = board.groups.filter((g) => g.needsNotice).length;

  const items: Item[] = [
    ...ITEMS.map((item) =>
      item.href === "/procesos/cobros" ? { ...item, badge: noticesToSend } : item,
    ),
    {
      href: "/procesos/pendientes",
      label: "Por confirmar",
      description: "Compras detectadas en los correos de tu banco.",
      icon: Inbox,
      badge: count ?? 0,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Procesos</h1>
        <p className="text-sm text-muted-foreground">
          Registrá y consultá tus movimientos.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {items.map(({ href, label, description, icon: Icon, badge }) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl transition-colors hover:bg-muted/40"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="size-4 text-muted-foreground" />
                  {label}
                  {badge ? <Badge>{badge}</Badge> : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {description}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
