import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate, daysUntil } from "@/lib/format";
import { nextCutoffDate, nextPaymentDate } from "@/lib/cards";
import type { Account, CreditCard } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  await requireUser();

  const supabase = await createClient();
  const [{ data: accountsData }, { data: cardsData }] = await Promise.all([
    supabase.from("accounts").select("*").eq("archived", false),
    supabase.from("credit_cards").select("*").eq("archived", false),
  ]);

  const accounts = (accountsData ?? []) as Account[];
  const cards = (cardsData ?? []) as CreditCard[];

  // Note: sums mix currencies naively; refine once multi-currency matters.
  const cash = accounts.reduce((s, a) => s + Number(a.current_balance), 0);
  const debt = cards.reduce((s, c) => s + Number(c.current_balance), 0);

  const payments = cards
    .map((card) => ({
      card,
      cutoff: nextCutoffDate(card.cutoff_day),
      payment: nextPaymentDate(card.cutoff_day, card.payment_due_day),
    }))
    .sort((a, b) => a.payment.getTime() - b.payment.getTime());

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Resumen</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat title="En cuentas" value={formatCurrency(cash)} />
        <Stat
          title="Deuda en tarjetas"
          value={formatCurrency(debt)}
          negative
        />
        <Stat title="Patrimonio neto" value={formatCurrency(cash - debt)} />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Próximos pagos de tarjeta</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay tarjetas registradas.{" "}
            <a href="/tarjetas" className="underline">
              Agrega una
            </a>
            .
          </p>
        ) : (
          <div className="divide-y rounded-lg border">
            {payments.map(({ card, cutoff, payment }) => {
              const paymentIn = daysUntil(payment);
              return (
                <div
                  key={card.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{card.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Corte {formatDate(cutoff)} · Pago {formatDate(payment)}
                      {paymentIn <= 7 ? (
                        <span className="text-destructive">
                          {" "}
                          ·{" "}
                          {paymentIn <= 0
                            ? "vence hoy"
                            : `en ${paymentIn} día${paymentIn === 1 ? "" : "s"}`}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <span className="tabular-nums font-medium">
                    {formatCurrency(Number(card.current_balance), card.currency)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  title,
  value,
  negative,
}: {
  title: string;
  value: string;
  negative?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={`text-2xl font-semibold tabular-nums ${
            negative ? "text-destructive" : ""
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
