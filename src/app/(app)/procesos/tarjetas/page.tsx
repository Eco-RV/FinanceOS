import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formatCurrency,
  formatDate,
  daysUntil,
  relativeDayLabel,
} from "@/lib/format";
import { nextCutoffDate, nextPaymentDate } from "@/lib/cards";
import type { CreditCard } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteButton } from "@/components/delete-button";
import { CardFormDialog } from "./card-form";
import { deleteCard } from "./actions";

export default async function TarjetasPage() {
  await requireUser();

  const supabase = await createClient();
  const { data } = await supabase
    .from("credit_cards")
    .select("*")
    .eq("archived", false)
    .order("created_at", { ascending: true });

  const cards = (data ?? []) as CreditCard[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Tarjetas de crédito</h1>
          <p className="text-sm text-muted-foreground">
            Saldo, corte y fecha límite de pago de cada tarjeta.
          </p>
        </div>
        <CardFormDialog />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarjeta</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead className="text-right">Límite</TableHead>
              <TableHead>Próximo corte</TableHead>
              <TableHead>Pago límite</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {cards.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  Aún no tienes tarjetas. Agrega la primera.
                </TableCell>
              </TableRow>
            ) : (
              cards.map((card) => {
                const cutoff = nextCutoffDate(card.cutoff_day);
                const payment = nextPaymentDate(
                  card.cutoff_day,
                  card.payment_due_day,
                );
                const paymentIn = daysUntil(payment);
                return (
                  <TableRow key={card.id}>
                    <TableCell>
                      <Link
                        href={`/procesos/tarjetas/${card.id}`}
                        className="font-medium hover:underline"
                      >
                        {card.name}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {[card.institution, card.last_four && `•••• ${card.last_four}`]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(
                        Number(card.current_balance),
                        card.currency,
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {card.credit_limit != null
                        ? formatCurrency(Number(card.credit_limit), card.currency)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      día {card.cutoff_day}
                      <span className="block text-xs text-muted-foreground">
                        {formatDate(cutoff)}
                      </span>
                    </TableCell>
                    <TableCell>
                      día {card.payment_due_day}
                      <span className="block text-xs text-muted-foreground">
                        {formatDate(payment)} · {relativeDayLabel(paymentIn)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <CardFormDialog card={card} />
                        <DeleteButton
                          id={card.id}
                          action={deleteCard}
                          confirmLabel={`¿Eliminar la tarjeta "${card.name}"?`}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
