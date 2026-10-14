import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/format";
import type { Account, AccountType } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
        <div className="surface overflow-hidden">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="py-10 text-center text-muted-foreground">
                  Aún no tienes cuentas. Agrega la primera.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      ) : (
        <>
          <div className="surface hidden overflow-hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Institución</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">{account.name}</TableCell>
                    <TableCell>{TYPE_LABELS[account.type]}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {account.institution ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(
                        Number(account.current_balance),
                        account.currency,
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <AccountFormDialog account={account} opening={openings.get(account.id)} />
                        {removeAction(account)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <MobileList>
            {accounts.map((account) => (
              <MobileCard
                key={account.id}
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
