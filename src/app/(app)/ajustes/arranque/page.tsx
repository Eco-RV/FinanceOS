import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { BackLink } from "@/components/back-link";
import { crToday, toISODate } from "@/domain";
import { scheduledInterestByCard, withoutScheduledInterest } from "@/lib/card-balances";
import { FreshStartForm, type FreshStartRow } from "./fresh-start-form";

type AccountRow = { id: string; name: string; currency: string; current_balance: number };
type CardRow = { id: string; name: string; current_balance: number; usd_balance: number | null };

export default async function ArranquePage() {
  await requireUser();

  const supabase = await createClient();
  const count = (table: "transactions" | "financings" | "loans") =>
    supabase.from(table).select("id", { count: "exact", head: true }).eq("archived", false);
  const [
    { data: accData },
    { data: cardData },
    { data: lastData },
    { count: movements },
    { count: financings },
    { count: loans },
  ] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, currency, current_balance")
      .eq("archived", false)
      .order("created_at", { ascending: true }),
    supabase
      .from("credit_cards")
      .select("id, name, current_balance, usd_balance")
      .eq("archived", false)
      .order("created_at", { ascending: true }),
    supabase
      .from("fresh_starts")
      .select("started_on, archived_movements")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    count("transactions"),
    count("financings"),
    count("loans"),
  ]);

  // F5: el interés de cuotas que no han llegado no es deuda; se borra con el plan.
  const interest = await scheduledInterestByCard(supabase, toISODate(crToday()));
  const cards = ((cardData ?? []) as CardRow[]).map((c) => withoutScheduledInterest(c, interest));

  // Por defecto cada saldo inicial nuevo es el saldo de hoy: solo se corrige lo que no cuadre.
  const rows: FreshStartRow[] = [
    ...((accData ?? []) as AccountRow[]).map((a) => ({
      field: `opening:account:${a.id}:${a.currency === "USD" ? "USD" : "CRC"}`,
      name: a.name,
      detail: "Cuenta",
      currency: a.currency === "USD" ? "USD" : "CRC",
      current: Number(a.current_balance),
    })),
    ...cards.flatMap((c) => [
      {
        field: `opening:card:${c.id}:CRC`,
        name: c.name,
        detail: "Tarjeta · deuda en colones",
        currency: "CRC",
        current: Number(c.current_balance),
      },
      {
        field: `opening:card:${c.id}:USD`,
        name: c.name,
        detail: "Tarjeta · deuda en dólares",
        currency: "USD",
        current: Number(c.usd_balance ?? 0),
      },
    ]),
  ];
  const last = lastData as { started_on: string; archived_movements: number } | null;

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/ajustes" label="Ajustes" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Arranque de 0</h1>
        <p className="text-sm text-muted-foreground">
          Empezar de nuevo: la historia se archiva y cada cuenta y tarjeta arranca con un
          saldo inicial nuevo.{" "}
          {last ? (
            <Link href="/ajustes/arranque/archivados" className="underline underline-offset-2">
              Ver lo archivado
            </Link>
          ) : null}
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 dark:bg-destructive/10 text-sm">
        <p className="font-medium text-destructive">Qué pasa al arrancar</p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            Se archivan los <strong>{movements ?? 0}</strong> movimientos activos (gastos,
            ingresos, abonos, transferencias, saldos iniciales, cuotas ya cobradas). Dejan de
            verse y de contar en los saldos.
          </li>
          <li>
            Se eliminan los <strong>{financings ?? 0}</strong> financiamientos y los{" "}
            <strong>{loans ?? 0}</strong> préstamos, con sus cuotas pendientes. Sus cuotas ya
            cobradas quedan archivadas.
          </li>
          <li>Se crea un saldo inicial nuevo por cada cuenta y tarjeta (lo único visible).</li>
          <li>
            Se conservan cuentas, tarjetas, bancos, categorías, el correo conectado, los
            pendientes por confirmar y el tipo de cambio.
          </li>
          <li>No se puede deshacer desde la app.</li>
        </ul>
      </div>

      {last ? (
        <p className="text-xs text-muted-foreground">
          Último arranque: {formatDate(last.started_on)} ({last.archived_movements} movimientos
          archivados).
        </p>
      ) : null}

      <FreshStartForm rows={rows} />
    </div>
  );
}
