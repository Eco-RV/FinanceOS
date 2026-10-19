import type { ComponentType } from "react";
import {
  ArrowLeftRight,
  Banknote,
  CreditCard,
  HandHeart,
  HandCoins,
  Inbox,
  Landmark,
  PiggyBank,
  Receipt,
  Repeat,
  Users,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { crToday, toISODate } from "@/domain";
import { loadFinancingBoard } from "@/lib/financing-board";
import { loadSharedBoard } from "@/lib/shared-board";
import { Badge } from "@/components/ui/badge";
import { NavCard } from "@/components/nav-card";

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
    href: "/procesos/planes",
    label: "Planes",
    description: "Salario, suscripciones y seguros; línea base de gastos fijos.",
    icon: Repeat,
  },
  {
    href: "/procesos/ahorros",
    label: "Ahorros y metas",
    description: "Metas con objetivo, avance y aportes.",
    icon: PiggyBank,
  },
  {
    href: "/procesos/prestamos",
    label: "Préstamos",
    description: "Cuota fija, calendario de pagos e intereses.",
    icon: HandCoins,
  },
  {
    href: "/procesos/compartidos",
    label: "Gastos compartidos",
    description: "Pagas el total, divides entre varios y controlas quién te pagó.",
    icon: Users,
  },
  {
    href: "/procesos/cobros",
    label: "Cobros a miembros",
    description: "Avisos y lo que te deben de cuotas y gastos compartidos.",
    icon: HandHeart,
  },
  {
    href: "/procesos/transferencias",
    label: "Transferencias",
    description: "Entre tus cuentas; no cuentan como gasto.",
    icon: ArrowLeftRight,
  },
];

/** Lo que se usa todos los días (siempre arriba). */
const FREQUENT = new Set(["/procesos/gastos", "/procesos/ingresos", "/procesos/tarjetas", "/procesos/cuentas"]);

export default async function ProcesosPage() {
  await requireUser();

  const supabase = await createClient();
  const todayISO = toISODate(crToday());
  const [{ count }, board, shared] = await Promise.all([
    supabase
      .from("pending_transactions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("archived", false),
    loadFinancingBoard(supabase, todayISO),
    loadSharedBoard(supabase, todayISO),
  ]);
  const sharedNotices = shared.groups.filter((g) => g.needsNotice).length;
  const noticesToSend = board.groups.filter((g) => g.needsNotice).length + sharedNotices;

  const items: Item[] = [
    ...ITEMS.map((item) =>
      item.href === "/procesos/cobros"
        ? { ...item, badge: noticesToSend }
        : item.href === "/procesos/compartidos"
          ? { ...item, badge: sharedNotices }
          : item,
    ),
    {
      href: "/procesos/pendientes",
      label: "Por confirmar",
      description: "Compras detectadas en los correos de tu banco.",
      icon: Inbox,
      badge: count ?? 0,
    },
  ];

  // 3.0.1 · ley 06 (exceso de opciones): primero lo de todos los días y lo que
  // pide atención (con badge); el resto queda debajo, en "Más procesos".
  const primary = items.filter((i) => FREQUENT.has(i.href) || (i.badge ?? 0) > 0);
  const secondary = items.filter((i) => !primary.includes(i));
  const card = ({ href, label, description, icon, badge }: Item) => (
    <NavCard
      key={href}
      href={href}
      icon={icon}
      label={label}
      description={description}
      badge={badge ? <Badge>{badge}</Badge> : null}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Procesos</h1>
        <p className="text-sm text-muted-foreground">
          Registrá y consultá tus movimientos.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {primary.map(card)}
      </div>

      {secondary.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Más procesos</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{secondary.map(card)}</div>
        </section>
      ) : null}
    </div>
  );
}
