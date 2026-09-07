import type { ReactNode } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  CreditCard,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formatCurrency,
  formatDate,
  daysUntil,
  relativeDayLabel,
} from "@/lib/format";
import {
  cardStatement,
  nextCutoffDate,
  type CardStatement,
} from "@/lib/cards";
import { crToday } from "@/lib/dates";
import type {
  Account,
  CreditCard as CreditCardType,
  Transaction,
} from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Level = "overdue" | "urgent" | "soon" | "ok";

function levelFor(days: number, overdue: boolean): Level {
  if (overdue) return "overdue";
  if (days <= 0) return "overdue";
  if (days <= 3) return "urgent";
  if (days <= 10) return "soon";
  return "ok";
}

const LEVEL_BORDER: Record<Level, string> = {
  overdue: "border-l-destructive",
  urgent: "border-l-destructive/60",
  soon: "border-l-amber-500",
  ok: "border-l-border",
};

const LEVEL_BAR: Record<Level, string> = {
  overdue: "bg-destructive",
  urgent: "bg-destructive/70",
  soon: "bg-amber-500",
  ok: "bg-muted-foreground/30",
};

type CardTxn = Pick<Transaction, "card_id" | "type" | "amount" | "occurred_on">;

type Payment = {
  card: CreditCardType;
  st: CardStatement;
  amount: number;
  cumulative: number;
  covered: boolean;
};

export default async function DashboardPage() {
  await requireUser();

  const supabase = await createClient();
  const [{ data: accountsData }, { data: cardsData }, { data: cardTxData }] =
    await Promise.all([
      supabase.from("accounts").select("*").eq("archived", false),
      supabase.from("credit_cards").select("*").eq("archived", false),
      supabase
        .from("transactions")
        .select("card_id, type, amount, occurred_on")
        .eq("archived", false)
        .not("card_id", "is", null),
    ]);

  const accounts = (accountsData ?? []) as Account[];
  const cards = (cardsData ?? []) as CreditCardType[];
  const cardTxns = (cardTxData ?? []) as CardTxn[];
  const today = crToday();

  const txByCard = new Map<string, CardTxn[]>();
  for (const t of cardTxns) {
    if (!t.card_id) continue;
    const list = txByCard.get(t.card_id);
    if (list) list.push(t);
    else txByCard.set(t.card_id, [t]);
  }

  const statements = new Map<string, CardStatement>(
    cards.map((c) => [c.id, cardStatement(c, txByCard.get(c.id) ?? [], today)]),
  );

  // Solo débito en colones cuenta como dinero para pagar tarjetas.
  const availableDebit = accounts
    .filter((a) => a.type === "checking" && a.currency === "CRC")
    .reduce((s, a) => s + Number(a.current_balance), 0);

  const netWorth =
    accounts.reduce((s, a) => s + Number(a.current_balance), 0) -
    cards.reduce((s, c) => s + Number(c.current_balance), 0);

  // Tarjetas con saldo de contado pendiente, del más urgente al que tiene más tiempo.
  const pending = cards
    .map((card) => ({ card, st: statements.get(card.id)! }))
    .filter(
      ({ st }) => st.status === "pendiente" || st.status === "atrasada",
    )
    .sort((a, b) => a.st.daysToDue - b.st.daysToDue);

  // Cobertura acumulada contra el débito (solo tarjetas en CRC entran a la suma).
  const payments: Payment[] = pending.reduce<Payment[]>((rows, p) => {
    const prev = rows.at(-1)?.cumulative ?? 0;
    const amount = p.st.dueAmount;
    const cumulative = p.card.currency === "CRC" ? prev + amount : prev;
    return [
      ...rows,
      { ...p, amount, cumulative, covered: cumulative <= availableDebit },
    ];
  }, []);

  const overdue = payments.filter((p) => p.st.status === "atrasada");
  const overdueTotal = overdue
    .filter((p) => p.card.currency === "CRC")
    .reduce((s, p) => s + p.amount, 0);

  const totalCrcDue = payments
    .filter((p) => p.card.currency === "CRC")
    .reduce((s, p) => s + p.amount, 0);
  const dueSoon = payments
    .filter((p) => p.card.currency === "CRC" && p.st.daysToDue <= 10)
    .reduce((s, p) => s + p.amount, 0);
  const newChargesCrc = cards
    .filter((c) => c.currency === "CRC")
    .reduce((s, c) => s + (statements.get(c.id)?.newCharges ?? 0), 0);

  const coversSoon = availableDebit >= dueSoon;
  const coverageRatio =
    availableDebit > 0
      ? Math.min(dueSoon / availableDebit, 1)
      : dueSoon > 0
        ? 1
        : 0;
  const firstUncovered = payments.findIndex((p) => !p.covered);

  const cutoffs = cards
    .map((card) => {
      const st = statements.get(card.id)!;
      const cutoff = nextCutoffDate(card.cutoff_day, today);
      return { card, st, cutoff, days: daysUntil(cutoff, today) };
    })
    .sort((a, b) => a.days - b.days);

  const upcoming = payments.filter((p) => p.st.status !== "atrasada");

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Resumen</h1>

      {overdue.length > 0 ? (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-destructive">
              {overdue.length === 1
                ? "1 tarjeta atrasada"
                : `${overdue.length} tarjetas atrasadas`}
              {overdueTotal > 0
                ? ` · ${formatCurrency(overdueTotal)} sin pagar`
                : ""}{" "}
              — genera intereses
            </p>
            <p className="text-xs text-muted-foreground">
              {overdue
                .map(
                  (p) =>
                    `${p.card.name} (venció ${relativeDayLabel(p.st.daysToDue)})`,
                )
                .join(" · ")}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            title="Disponible en débito"
            value={formatCurrency(availableDebit)}
            icon={<Wallet className="size-4" />}
          />
          <Stat
            title="A pagar de contado"
            value={formatCurrency(totalCrcDue)}
            negative={totalCrcDue > availableDebit && totalCrcDue > 0}
            icon={<CalendarClock className="size-4" />}
          />
          <Stat
            title="Consumo sin cortar"
            value={formatCurrency(newChargesCrc)}
            icon={<CreditCard className="size-4" />}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Patrimonio neto (todas las cuentas − deuda): {formatCurrency(netWorth)}
        </p>
      </div>

      {dueSoon > 0 ? (
        <div
          className={cn(
            "flex items-start gap-3 rounded-lg border p-4",
            coversSoon ? "border-border" : "border-destructive/40 bg-destructive/5",
          )}
        >
          {coversSoon ? (
            <CheckCircle2 className="mt-0.5 size-5 text-foreground/70" />
          ) : (
            <TriangleAlert className="mt-0.5 size-5 text-destructive" />
          )}
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-sm font-medium">
              {coversSoon
                ? "Tu débito cubre los pagos de contado de los próximos 10 días."
                : `Con tu débito te faltan ${formatCurrency(
                    dueSoon - availableDebit,
                  )} para los pagos de los próximos 10 días.`}
            </p>
            <Bar
              value={coverageRatio}
              className={coversSoon ? "bg-foreground/70" : "bg-destructive"}
            />
            <p className="text-xs tabular-nums text-muted-foreground">
              A pagar {formatCurrency(dueSoon)} · Disponible{" "}
              {formatCurrency(availableDebit)}
            </p>
          </div>
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Pagos de contado</h2>
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay tarjetas registradas.{" "}
            <Link href="/procesos/tarjetas" className="underline">
              Agrega una
            </Link>
            .
          </p>
        ) : payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ninguna tarjeta tiene saldo de contado pendiente. Estás al día.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {overdue.length > 0 ? (
              <PaymentGroup title="Atrasadas" payments={overdue} />
            ) : null}
            {upcoming.length > 0 ? (
              <PaymentGroup
                title="Por vencer"
                payments={upcoming}
                dividerAt={
                  firstUncovered >= 0
                    ? firstUncovered - overdue.length
                    : undefined
                }
              />
            ) : null}
          </div>
        )}
      </section>

      {cutoffs.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Próximos cortes</h2>
          <p className="text-sm text-muted-foreground">
            El corte fija el saldo de contado que vas a tener que pagar.
          </p>
          <div className="overflow-hidden rounded-lg border">
            {cutoffs.map(({ card, st, cutoff, days }) => (
              <CutoffRow
                key={card.id}
                card={card}
                st={st}
                cutoff={cutoff}
                days={days}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function cardSubtitle(card: CreditCardType) {
  return (
    [card.institution, card.last_four && `•••• ${card.last_four}`]
      .filter(Boolean)
      .join(" · ") || null
  );
}

function PaymentGroup({
  title,
  payments,
  dividerAt,
}: {
  title: string;
  payments: Payment[];
  dividerAt?: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="overflow-hidden rounded-lg border">
        {payments.map((p, i) => (
          <div key={p.card.id}>
            {dividerAt === i && i > 0 ? (
              <p className="border-y bg-muted/40 px-4 py-1.5 text-xs text-muted-foreground">
                Desde aquí los pagos superan tu disponible en débito
              </p>
            ) : null}
            <PaymentRow p={p} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentRow({ p }: { p: Payment }) {
  const { card, st, amount } = p;
  const days = st.daysToDue;
  const overdue = st.status === "atrasada";
  const level = levelFor(days, overdue);
  const badgeText = overdue
    ? `venció ${relativeDayLabel(days)}`
    : days === 0
      ? "vence hoy"
      : `vence ${relativeDayLabel(days)}`;
  const proximity = Math.max(0, Math.min(1, 1 - days / 30));
  const subtitle = cardSubtitle(card);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-l-4 px-4 py-3",
        LEVEL_BORDER[level],
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">{card.name}</p>
          {subtitle ? (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="tabular-nums font-medium">
            {formatCurrency(amount, card.currency)}
            {card.currency !== "CRC" ? (
              <span className="ml-1 text-xs text-muted-foreground">
                ({card.currency})
              </span>
            ) : null}
          </span>
          <UrgencyBadge level={level}>{badgeText}</UrgencyBadge>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Bar value={proximity} className={LEVEL_BAR[level]} />
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatDate(st.dueDate)}
        </span>
      </div>
    </div>
  );
}

function CutoffRow({
  card,
  st,
  cutoff,
  days,
}: {
  card: CreditCardType;
  st: CardStatement;
  cutoff: Date;
  days: number;
}) {
  const soon = days <= 1;
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium">{card.name}</p>
        <p className="text-xs text-muted-foreground">
          {st.newCharges > 0
            ? `${formatCurrency(st.newCharges, card.currency)} sin cortar`
            : "Sin consumo nuevo"}
        </p>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-sm tabular-nums">{formatDate(cutoff)}</span>
        <span
          className={cn(
            "text-xs",
            soon ? "font-medium text-destructive" : "text-muted-foreground",
          )}
        >
          {days === 0 ? "corta hoy" : `corta ${relativeDayLabel(days)}`}
        </span>
      </div>
    </div>
  );
}

function UrgencyBadge({
  level,
  children,
}: {
  level: Level;
  children: ReactNode;
}) {
  if (level === "overdue" || level === "urgent") {
    return <Badge variant="destructive">{children}</Badge>;
  }
  if (level === "soon") {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
      >
        {children}
      </Badge>
    );
  }
  return <Badge variant="secondary">{children}</Badge>;
}

function Bar({ value, className }: { value: number; className?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full", className)}
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  );
}

function Stat({
  title,
  value,
  negative,
  icon,
}: {
  title: string;
  value: string;
  negative?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            "text-2xl font-semibold tabular-nums",
            negative && "text-destructive",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
