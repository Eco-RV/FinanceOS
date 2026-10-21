import { notFound } from "next/navigation";
import { getEnabledFeatures } from "@/lib/features";
import { Banknote, Landmark, PiggyBank, WalletCards } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/schema";
import { categoryOptions, iconsByName } from "@/lib/categories";
import { loadDebitCards } from "@/lib/debit-cards";
import { openingsById } from "@/lib/transactions";
import { idsWithHistory } from "@/lib/catalog-history";
import { repositories } from "@/infrastructure/container";
import { crToday, DEBIT_CARD_ACCOUNT_TYPES, toISODate } from "@/domain";
import type { Account, AccountType, Category, CreditCard, Transaction } from "@/lib/types";
import { BackLink } from "@/components/back-link";
import { Panel } from "@/components/panel";
import { InactiveList, RemoveOrDeactivate } from "@/components/catalog-actions";
import { MovementExplorer } from "../../_transactions/movement-explorer";
import { allRows } from "@/lib/supabase/all-rows";
import { loadSharedLinks } from "@/lib/shared-board";
import { AccountFormDialog } from "../account-form";
import { DebitCardFormDialog } from "../debit-card-form";
import { deleteDebitCard, setDebitCardActive } from "../actions";

const TYPE_LABELS: Record<AccountType, string> = {
  checking: "Cuenta de débito",
  savings: "Cuenta de ahorro",
  cash: "Efectivo",
};

const TYPE_ICONS = { checking: Landmark, savings: PiggyBank, cash: Banknote } as const;

/**
 * Detalle de una cuenta (2.8.0): saldo, su tarjeta de débito (C3) y todos sus
 * movimientos (como origen o destino).
 */
export default async function AccountDetailPage({ params }: PageProps<"/procesos/cuentas/[id]">) {
  const [, { id }, enabled] = await Promise.all([requireUser(), params, getEnabledFeatures()]);

  const supabase = await createClient();
  const [
    { data: accountData },
    { data: txData },
    { data: accData },
    { data: cardData },
    { data: catData },
    { data: openingData },
    debitCards,
  ] = await Promise.all([
    supabase.from("accounts").select("*").eq("id", id).maybeSingle(),
    // 3.1.0: todos (antes, los 500 más recientes); la vista filtra y pagina.
    allRows<Transaction>((from, to) =>
      supabase
        .from("transactions")
        .select("*")
        .eq("archived", false)
        .or(`account_id.eq.${id},to_account_id.eq.${id}`)
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to),
    ).then((data) => ({ data })),
    supabase.from("accounts").select("*").order("created_at", { ascending: true }),
    supabase.from("credit_cards").select("*").order("created_at", { ascending: true }),
    supabase
      .from("categories")
      .select("*")
      .eq("kind", "expense")
      .eq("archived", false)
      .order("name", { ascending: true }),
    supabase
      .from("transactions")
      .select("account_id, card_id, amount, occurred_on")
      .eq("type", "opening_balance")
      .eq("archived", false)
      .eq("account_id", id),
    loadDebitCards(supabase, { includeArchived: true }),
  ]);

  if (!accountData) notFound();
  const account = accountData as Account;
  const transactions = (txData ?? []) as Transaction[];
  const accounts = (accData ?? []) as Account[];
  const cards = (cardData ?? []) as CreditCard[];
  const options = categoryOptions((catData ?? []) as Category[], EXPENSE_CATEGORIES);

  const ownCards = debitCards.filter((d) => d.account_id === account.id);
  const activeCard = ownCards.find((d) => !d.archived);
  const inactiveCards = ownCards.filter((d) => d.archived);
  const withHistory = await idsWithHistory(
    (await repositories()).debitCards,
    ownCards.map((d) => d.id),
  );
  const canHaveCard = (DEBIT_CARD_ACCOUNT_TYPES as readonly string[]).includes(account.type);
  const Icon = TYPE_ICONS[account.type] ?? Landmark;
  const subtitle = [TYPE_LABELS[account.type], account.institution, account.currency]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/procesos/cuentas" label="Cuentas" />

      <div className="rise flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-muted text-foreground">
            <Icon className="size-6" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{account.name}</h1>
            <p className="text-sm text-muted-foreground">
              {subtitle}
              {account.archived ? " · desactivada" : ""}
            </p>
          </div>
        </div>
        {account.archived ? null : (
          <AccountFormDialog account={account} opening={openingsById(openingData).get(account.id)} />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel className="rise flex flex-col gap-1 p-5" style={{ ["--rise-i" as string]: 1 }}>
          <p className="text-sm text-muted-foreground">Saldo</p>
          <p className="text-3xl font-semibold tracking-tight tabular-nums">
            {formatCurrency(Number(account.current_balance), account.currency)}
          </p>
        </Panel>

        <Panel className="rise flex flex-col gap-3 p-5" style={{ ["--rise-i" as string]: 2 }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Tarjeta de débito</p>
            {activeCard && !account.archived ? (
              <div className="flex gap-1">
                <DebitCardFormDialog accountId={account.id} card={activeCard} />
                <RemoveOrDeactivate
                  id={activeCard.id}
                  label={`la tarjeta de débito "${activeCard.name}"`}
                  hasHistory={withHistory.has(activeCard.id)}
                  onDelete={deleteDebitCard}
                  onSetActive={setDebitCardActive}
                />
              </div>
            ) : null}
          </div>
          {!canHaveCard ? (
            <p className="text-sm text-muted-foreground">
              Las cuentas de efectivo no tienen tarjeta de débito.
            </p>
          ) : activeCard ? (
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-success/15 text-success">
                <WalletCards className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{activeCard.name}</p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {activeCard.last_four ? `•••• ${activeCard.last_four}` : "Sin últimos dígitos"}
                </p>
              </div>
            </div>
          ) : account.archived ? (
            <p className="text-sm text-muted-foreground">Sin tarjeta de débito.</p>
          ) : (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-muted-foreground">
                Agrégala para registrar gastos con ella desde “Nuevo gasto”.
              </p>
              <DebitCardFormDialog accountId={account.id} />
            </div>
          )}
          <InactiveList
            title="Tarjetas desactivadas"
            items={inactiveCards.map((d) => ({
              id: d.id,
              name: d.last_four ? `${d.name} ••${d.last_four}` : d.name,
              hasHistory: withHistory.has(d.id),
            }))}
            noun="la tarjeta de débito"
            onDelete={deleteDebitCard}
            onSetActive={setDebitCardActive}
          />
        </Panel>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Movimientos</h2>
          <span className="text-sm text-muted-foreground">{transactions.length} en total</span>
        </div>
        <MovementExplorer
          context="account"
          transactions={transactions}
          accounts={accounts}
          cards={cards}
          debitCards={debitCards}
          accountId={account.id}
          categories={options.map((o) => o.name)}
          categoryIcons={iconsByName(options)}
          todayISO={toISODate(crToday())}
          emptyLabel="Esta cuenta todavía no tiene movimientos hasta hoy. Los gastos con débito, SINPE o efectivo se anotan con el botón rojo de la flecha hacia arriba."
          sharedLinks={await loadSharedLinks(supabase)}
          shareable={enabled.has("compartidos")}
        />
      </section>
    </div>
  );
}
