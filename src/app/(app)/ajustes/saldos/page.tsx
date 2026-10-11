import { CheckCircle2, TriangleAlert } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/format";
import { checkBalances } from "@/application";
import { repositories } from "@/infrastructure/container";
import { BackLink } from "@/components/back-link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RecomputeButton } from "./recompute-button";

type Named = { id: string; name: string; currency: string };

/**
 * G1: compara el saldo guardado de cada cuenta y tarjeta con el que dicen sus
 * movimientos. Si no coinciden, ofrece recalcular desde los movimientos.
 */
export default async function SaldosPage() {
  await requireUser();

  const supabase = await createClient();
  const [result, { data: accData }, { data: cardData }] = await Promise.all([
    repositories().then(checkBalances),
    supabase.from("accounts").select("id, name, currency"),
    supabase.from("credit_cards").select("id, name, currency"),
  ]);

  const names = new Map<string, Named>(
    [...((accData ?? []) as Named[]), ...((cardData ?? []) as Named[])].map((r) => [r.id, r]),
  );

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/ajustes" label="Ajustes" />
      <div>
        <h1 className="text-2xl font-semibold">Verificar saldos</h1>
        <p className="text-sm text-muted-foreground">
          El saldo de cada cuenta y tarjeta se calcula desde sus movimientos (incluido el
          saldo inicial). Aquí se comprueba que el saldo guardado coincida.
        </p>
      </div>

      {!result.ok ? (
        <p className="text-sm text-destructive">{result.message}</p>
      ) : result.value.drift.length === 0 ? (
        <div className="flex items-start gap-3 rounded-lg border p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <p className="text-sm">
            Todo cuadra: {result.value.checked} cuenta(s) y tarjeta(s) verificadas.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
            <p className="text-sm">
              {result.value.drift.length} saldo(s) no coinciden con sus movimientos.
              Recalcular deja el saldo igual a lo que dicen los movimientos.
            </p>
          </div>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta / tarjeta</TableHead>
                  <TableHead className="text-right">Guardado</TableHead>
                  <TableHead className="text-right">Según movimientos</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.value.drift.map((d) => {
                  const row = names.get(d.id);
                  // En tarjetas cada moneda es un saldo aparte (T1).
                  const currency = d.currency ?? row?.currency ?? "CRC";
                  return (
                    <TableRow key={`${d.target}:${d.id}`}>
                      <TableCell>
                        {row?.name ?? d.id}{" "}
                        <span className="text-xs text-muted-foreground">
                          {d.target === "account" ? "cuenta" : `tarjeta · ${currency}`}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(d.stored, currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(d.derived, currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(d.difference, currency)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <RecomputeButton />
        </div>
      )}
    </div>
  );
}
