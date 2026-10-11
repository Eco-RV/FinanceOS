import Link from "next/link";
import { Eye } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  cardStatement,
  crToday,
  nextCutoffDate,
  type CardStatement,
} from "@/domain";
import type { Bank, CreditCard, Transaction } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";
import { DeleteButton } from "@/components/delete-button";
import { MobileCard, MobileField, MobileList } from "@/components/mobile-list";
import { CardFormDialog } from "./card-form";
import { openingsById } from "@/lib/transactions";
import { CardStatusBadge } from "./card-status";
import { deleteCard } from "./actions";

type CardTxn = Pick<Transaction, "card_id" | "type" | "amount" | "occurred_on">;

export default async function TarjetasPage() {
  await requireUser();

  const supabase = await createClient();
  const [{ data: cardData }, { data: txData }, { data: bankData }] =
    await Promise.all([
    supabase
      .from("credit_cards")
      .select("*")
      .eq("archived", false)
      .order("created_at", { ascending: true }),
    supabase
      .from("transactions")
      .select("card_id, type, amount, occurred_on")
      .eq("archived", false)
      .not("card_id", "is", null),
    supabase
      .from("banks")
      .select("id, name")
      .eq("archived", false)
      .order("name", { ascending: true }),
  ]);

  const cards = (cardData ?? []) as CreditCard[];
  const banks = (bankData ?? []) as Pick<Bank, "id" | "name">[];
  const txns = (txData ?? []) as CardTxn[];
  const openings = openingsById(
    txns
      .filter((t) => t.type === "opening_balance")
      .map((t) => ({ ...t, account_id: null })),
  );
  const today = crToday();

  const byCard = new Map<string, CardTxn[]>();
  for (const t of txns) {
    if (!t.card_id) continue;
    const list = byCard.get(t.card_id);
    if (list) list.push(t);
    else byCard.set(t.card_id, [t]);
  }

  const rows = cards.map((card) => {
    const st: CardStatement = cardStatement(card, byCard.get(card.id) ?? [], today);
    const cutoff = nextCutoffDate(card.cutoff_day, today);
    const owes = st.status === "pendiente" || st.status === "atrasada";
    return { card, st, cutoff, owes };
  });

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/procesos" label="Procesos" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Tarjetas de crédito</h1>
          <p className="text-sm text-muted-foreground">
            Estado del corte y fecha límite de pago de cada tarjeta.
          </p>
        </div>
        <CardFormDialog banks={banks} />
      </div>

      {cards.length === 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="py-10 text-center text-muted-foreground">
                  Aún no tienes tarjetas. Agrega la primera.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      ) : (
        <>
          <div className="hidden rounded-lg border sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarjeta</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Saldo actual</TableHead>
                  <TableHead className="text-right">Falta pagar</TableHead>
                  <TableHead>Próximo corte</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ card, st, cutoff, owes }) => (
                  <TableRow key={card.id}>
                    <TableCell>
                      <Link
                        href={`/procesos/tarjetas/${card.id}`}
                        className="font-medium hover:underline"
                      >
                        {card.name}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {[
                          card.institution,
                          card.last_four && `•••• ${card.last_four}`,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <CardStatusBadge
                        status={st.status}
                        daysToDue={st.daysToDue}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(Number(card.current_balance), card.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {owes ? (
                        <>
                          {formatCurrency(st.dueAmount, card.currency)}
                          <span className="block text-xs text-muted-foreground">
                            {formatDate(st.dueDate)}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      día {card.cutoff_day}
                      <span className="block text-xs text-muted-foreground">
                        {formatDate(cutoff)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/procesos/tarjetas/${card.id}`}
                          aria-label="Ver detalle"
                          className={buttonVariants({
                            variant: "ghost",
                            size: "icon",
                          })}
                        >
                          <Eye className="size-4" />
                        </Link>
                        <CardFormDialog card={card} opening={openings.get(card.id)} banks={banks} />
                        <DeleteButton
                          id={card.id}
                          action={deleteCard}
                          confirmLabel={`¿Eliminar la tarjeta "${card.name}"?`}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <MobileList>
            {rows.map(({ card, st, cutoff, owes }) => (
              <MobileCard
                key={card.id}
                title={
                  <Link href={`/procesos/tarjetas/${card.id}`} className="hover:underline">
                    {card.name}
                  </Link>
                }
                meta={
                  [card.institution, card.last_four && `•••• ${card.last_four}`]
                    .filter(Boolean)
                    .join(" · ") || undefined
                }
                actions={
                  <>
                    <Link
                      href={`/procesos/tarjetas/${card.id}`}
                      aria-label="Ver detalle"
                      className={buttonVariants({ variant: "ghost", size: "icon" })}
                    >
                      <Eye className="size-4" />
                    </Link>
                    <CardFormDialog card={card} opening={openings.get(card.id)} banks={banks} />
                    <DeleteButton
                      id={card.id}
                      action={deleteCard}
                      confirmLabel={`¿Eliminar la tarjeta "${card.name}"?`}
                    />
                  </>
                }
              >
                <MobileField
                  label="Estado"
                  value={<CardStatusBadge status={st.status} daysToDue={st.daysToDue} />}
                />
                <MobileField
                  label="Saldo actual"
                  value={formatCurrency(Number(card.current_balance), card.currency)}
                />
                <MobileField
                  label="Falta pagar"
                  value={
                    owes
                      ? `${formatCurrency(st.dueAmount, card.currency)} (${formatDate(st.dueDate)})`
                      : "—"
                  }
                />
                <MobileField
                  label="Próximo corte"
                  value={`día ${card.cutoff_day} · ${formatDate(cutoff)}`}
                />
              </MobileCard>
            ))}
          </MobileList>
        </>
      )}
    </div>
  );
}
