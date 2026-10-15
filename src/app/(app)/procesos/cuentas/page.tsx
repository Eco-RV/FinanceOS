import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/format";
import type { Account, AccountType } from "@/lib/types";
import { EmptyRows, RowActions, RowItem, RowList } from "@/components/row-list";
import { BackLink } from "@/components/back-link";
import { InactiveList, RemoveOrDeactivate } from "@/components/catalog-actions";
import { idsWithHistory } from "@/lib/catalog-history";
import { repositories } from "@/infrastructure/container";
import { MobileCard, MobileField, MobileList } from "@/components/mobile-list";
import { openingsById } from "@/lib/transactions";
import { AccountFormDialog } from "./account-form";
import { deleteAccount, setAccountActive } from "./actions";

const TYPE_LABELS: Record<AccountType, string> = {
  checking: "Débito",
  savings: "Ahorro",
  cash: "Efectivo",
};

export default async function CuentasPage() {
  await requireUser();

  const supabase = await createClient();
  const [{ data }, { data: openingData }] = await Promise.all([
    supabase
      .from("accounts")
      .select("*")
      .order("created_at", { ascending: true }),
    supabase
      .from("transactions")
      .select("account_id, card_id, amount, occurred_on")
      .eq("type", "opening_balance")
      .eq("archived", false)
      .not("account_id", "is", null),
  ]);

  const all = (data ?? []) as Account[];
  const withHistory = await idsWithHistory(
    (await repositories()).accounts,
    all.map((a) => a.id),
  );
  const accounts = all.filter((a) => !a.archived);
  const inactive = all.filter((a) => a.archived);
  const removeAction = (account: Account) => (
    <RemoveOrDeactivate
      id={account.id}
      label={`la cuenta "${account.name}"`}
      hasHistory={withHistory.has(account.id)}
      onDelete={deleteAccount}
      onSetActive={setAccountActive}
      deactivateNote={
        Number(account.current_balance) !== 0
          ? `Su saldo (${formatCurrency(Number(account.current_balance), account.currency)}) deja de contar en el resumen.`
          : undefined
      }
    />
  );
  const openings = openingsById(openingData);
  const totalCrc = accounts
    .filter((a) => a.currency === "CRC")
    .reduce((sum, a) => sum + Number(a.current_balance), 0);

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/procesos" label="Procesos" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cuentas</h1>
          <p className="text-sm text-muted-foreground">
            Saldos de débito, ahorro y efectivo.
          </p>
        </div>
        <AccountFormDialog />
      </div>

      {accounts.length === 0 ? (
        <EmptyRows>Aún no tienes cuentas. Agrega la primera.</EmptyRows>
      ) : (
        <>
          <RowList
            columns="minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1.2fr) 5.5rem"
            headers={[
              { label: "Nombre" },
              { label: "Tipo" },
              { label: "Institución" },
              { label: "Saldo", align: "right" },
              {},
            ]}
          >
            {accounts.map((account, i) => (
              <RowItem key={account.id} index={i}>
                <span className="truncate font-medium">{account.name}</span>
                <span>{TYPE_LABELS[account.type]}</span>
                <span className="truncate text-muted-foreground">
                  {account.institution ?? "—"}
                </span>
                <span className="text-right font-medium tabular-nums">
                  {formatCurrency(Number(account.current_balance), account.currency)}
                </span>
                <RowActions>
                  <AccountFormDialog account={account} opening={openings.get(account.id)} />
                  {removeAction(account)}
                </RowActions>
              </RowItem>
            ))}
          </RowList>

          <MobileList>
            {accounts.map((account, i) => (
              <MobileCard
                key={account.id}
                index={i}
                title={account.name}
                meta={account.institution ?? undefined}
                actions={
                  <>
                    <AccountFormDialog account={account} opening={openings.get(account.id)} />
                    {removeAction(account)}
                  </>
                }
              >
                <MobileField label="Tipo" value={TYPE_LABELS[account.type]} />
                <MobileField
                  label="Saldo"
                  value={formatCurrency(
                    Number(account.current_balance),
                    account.currency,
                  )}
                />
              </MobileCard>
            ))}
          </MobileList>
        </>
      )}

      {accounts.length > 0 ? (
        <p className="text-right text-sm text-muted-foreground">
          Total en colones:{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {formatCurrency(totalCrc)}
          </span>
        </p>
      ) : null}

      <InactiveList
        items={inactive.map((a) => ({
          id: a.id,
          name: a.name,
          detail: `${TYPE_LABELS[a.type]} · ${formatCurrency(Number(a.current_balance), a.currency)}`,
          hasHistory: withHistory.has(a.id),
        }))}
        noun="la cuenta"
        onDelete={deleteAccount}
        onSetActive={setAccountActive}
      />
    </div>
  );
}
