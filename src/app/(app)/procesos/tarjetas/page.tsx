import Link from "next/link";
import { Eye } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import {
  cardStatementsByCurrency,
  crToday,
  isCurrency,
  nextCutoffDate,
  toISODate,
  type Currency,
} from "@/domain";
import type { Bank, CreditCard, Transaction } from "@/lib/types";
import { EmptyRows, RowActions, RowItem, RowList } from "@/components/row-list";
import { buttonVariants } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";
import { InactiveList, RemoveOrDeactivate } from "@/components/catalog-actions";
import { idsWithHistory } from "@/lib/catalog-history";
import { repositories } from "@/infrastructure/container";
import { MobileCard, MobileField, MobileList } from "@/components/mobile-list";
import { CardFormDialog } from "./card-form";
import { cardOpeningsById } from "@/lib/transactions";
import { scheduledInterestByCard, withoutScheduledInterest } from "@/lib/card-balances";
import { CardBalances, CardOwed, urgentDaysToDue } from "./card-money";
import { CardStatusBadge } from "./card-status";
import { deleteCard, setCardActive } from "./actions";

type CardTxn = Pick<Transaction, "card_id" | "type" | "amount" | "occurred_on" | "currency">;

export default async function TarjetasPage() {
  await requireUser();

  const supabase = await createClient();
  const [{ data: cardData }, { data: txData }, { data: bankData }] =
    await Promise.all([
    supabase
      .from("credit_cards")
      .select("*")
      .order("created_at", { ascending: true }),
    supabase
      .from("transactions")
      .select("card_id, type, amount, occurred_on, currency")
      .eq("archived", false)
      .not("card_id", "is", null),
    supabase
      .from("banks")
      .select("id, name, archived")
      .order("name", { ascending: true }),
  ]);

  const today = crToday();
  // F5: solo el capital de los financiamientos cuenta desde el día 1.
  const interest = await scheduledInterestByCard(supabase, toISODate(today));
  const allCards = ((cardData ?? []) as CreditCard[]).map((c) =>
    withoutScheduledInterest(c, interest),
  );
  const withHistory = await idsWithHistory(
    (await repositories()).cards,
    allCards.map((c) => c.id),
  );
  const cards = allCards.filter((c) => !c.archived);
  const inactive = allCards.filter((c) => c.archived);
  const hasDebt = (c: CreditCard) =>
    Number(c.current_balance) !== 0 || Number(c.usd_balance ?? 0) !== 0;
  const removeAction = (card: CreditCard) => (
    <RemoveOrDeactivate
      id={card.id}
      label={`la tarjeta "${card.name}"`}
      hasHistory={withHistory.has(card.id)}
      onDelete={deleteCard}
      onSetActive={setCardActive}
      deactivateNote={
        hasDebt(card)
          ? "Todavía tiene saldo: deja de contar en el resumen y en los pagos de contado."
          : undefined
      }
    />
  );
  const banks = (bankData ?? []) as Pick<Bank, "id" | "name" | "archived">[];
  const txns = (txData ?? []) as CardTxn[];
  const openings = cardOpeningsById(
    txns
      .filter((t) => t.type === "opening_balance")
      .map((t) => ({ ...t, account_id: null })),
  );

  const byCard = new Map<string, CardTxn[]>();
  for (const t of txns) {
    if (!t.card_id) continue;
    const list = byCard.get(t.card_id);
    if (list) list.push(t);
    else byCard.set(t.card_id, [t]);
  }

  const rows = cards.map((card) => {
    const limitCurrency: Currency = isCurrency(card.currency) ? card.currency : "CRC";
    const m = cardStatementsByCurrency(
      { ...card, currency: limitCurrency },
      (byCard.get(card.id) ?? []).map((t) => ({
        ...t,
        currency: isCurrency(t.currency) ? t.currency : "CRC",
      })),
      today,
    );
    const cutoff = nextCutoffDate(card.cutoff_day, today);
    return { card, m, cutoff };
  });

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/procesos" label="Procesos" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tarjetas de crédito</h1>
          <p className="text-sm text-muted-foreground">
            Estado del corte y fecha límite de pago de cada tarjeta.
          </p>
        </div>
        <CardFormDialog banks={banks} />
      </div>

      {cards.length === 0 ? (
        <EmptyRows>Aún no tienes tarjetas. Agrega la primera.</EmptyRows>
      ) : (
        <>
          {/* 2.5.0: toda la fila abre el detalle; los botones hacen lo suyo. */}
          <RowList
            columns="minmax(0,1.6fr) minmax(0,1.1fr) minmax(0,1fr) minmax(0,1.3fr) minmax(0,1fr) 8rem"
            headers={[
              { label: "Tarjeta" },
              { label: "Estado" },
              { label: "Saldo actual", align: "right" },
              { label: "Falta pagar", align: "right" },
              { label: "Próximo corte" },
              {},
            ]}
          >
            {rows.map(({ card, m, cutoff }, i) => (
              <RowItem
                key={card.id}
                index={i}
                href={`/procesos/tarjetas/${card.id}`}
                label={`Ver detalle de ${card.name}`}
              >
                <div className="min-w-0">
                  <span className="block truncate font-medium">{card.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {cardMeta(card) ?? "—"}
                  </span>
                </div>
                <div>
                  <CardStatusBadge status={m.status} daysToDue={urgentDaysToDue(m)} />
                </div>
                <div className="text-right font-medium tabular-nums">
                  <CardBalances card={card} />
                </div>
                <div className="text-right tabular-nums">
                  <CardOwed m={m} />
                </div>
                <div>
                  día {card.cutoff_day}
                  <span className="block text-xs text-muted-foreground">
                    {formatDate(cutoff)}
                  </span>
                </div>
                <RowActions>
                  <Link
                    href={`/procesos/tarjetas/${card.id}`}
                    aria-label="Ver detalle"
                    className={buttonVariants({ variant: "ghost", size: "icon" })}
                  >
                    <Eye className="size-4" />
                  </Link>
                  <CardFormDialog card={card} openings={openings.get(card.id)} banks={banks} />
                  {removeAction(card)}
                </RowActions>
              </RowItem>
            ))}
          </RowList>

          <MobileList>
            {rows.map(({ card, m, cutoff }, i) => (
              <MobileCard
                key={card.id}
                index={i}
                href={`/procesos/tarjetas/${card.id}`}
                label={`Ver detalle de ${card.name}`}
                title={card.name}
                meta={cardMeta(card) ?? undefined}
                actions={
                  <>
                    <CardFormDialog card={card} openings={openings.get(card.id)} banks={banks} />
                    {removeAction(card)}
                  </>
                }
              >
                <MobileField
                  label="Estado"
                  value={<CardStatusBadge status={m.status} daysToDue={urgentDaysToDue(m)} />}
                />
                <MobileField label="Saldo actual" value={<CardBalances card={card} />} />
                <MobileField label="Falta pagar" value={<CardOwed m={m} />} />
                <MobileField
                  label="Próximo corte"
                  value={`día ${card.cutoff_day} · ${formatDate(cutoff)}`}
                />
              </MobileCard>
            ))}
          </MobileList>
        </>
      )}

      <InactiveList
        items={inactive.map((c) => ({
          id: c.id,
          name: c.name,
          detail: c.last_four ? `•••• ${c.last_four}` : undefined,
          hasHistory: withHistory.has(c.id),
        }))}
        noun="la tarjeta"
        onDelete={deleteCard}
        onSetActive={setCardActive}
      />
    </div>
  );
}

function cardMeta(card: CreditCard): string | null {
  return (
    [card.institution, card.last_four && `•••• ${card.last_four}`].filter(Boolean).join(" · ") ||
    null
  );
}
