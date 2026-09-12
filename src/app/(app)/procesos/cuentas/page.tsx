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
import { DeleteButton } from "@/components/delete-button";
import { MobileCard, MobileField, MobileList } from "@/components/mobile-list";
import { AccountFormDialog } from "./account-form";
import { deleteAccount } from "./actions";

const TYPE_LABELS: Record<AccountType, string> = {
  checking: "Débito",
  savings: "Ahorro",
  cash: "Efectivo",
};

export default async function CuentasPage() {
  await requireUser();

  const supabase = await createClient();
  const { data } = await supabase
    .from("accounts")
    .select("*")
    .eq("archived", false)
    .order("created_at", { ascending: true });

  const accounts = (data ?? []) as Account[];
  const totalCrc = accounts
    .filter((a) => a.currency === "CRC")
    .reduce((sum, a) => sum + Number(a.current_balance), 0);

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/procesos" label="Procesos" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Cuentas</h1>
          <p className="text-sm text-muted-foreground">
            Saldos de débito, ahorro y efectivo.
          </p>
        </div>
        <AccountFormDialog />
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-lg border">
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
          <div className="hidden rounded-lg border sm:block">
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
                        <AccountFormDialog account={account} />
                        <DeleteButton
                          id={account.id}
                          action={deleteAccount}
                          confirmLabel={`¿Eliminar la cuenta "${account.name}"?`}
                        />
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
                    <AccountFormDialog account={account} />
                    <DeleteButton
                      id={account.id}
                      action={deleteAccount}
                      confirmLabel={`¿Eliminar la cuenta "${account.name}"?`}
                    />
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
    </div>
  );
}
