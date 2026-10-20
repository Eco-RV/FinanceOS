"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/form-field";
import { PaginationFooter } from "@/components/pagination-footer";
import { usePagination } from "@/lib/use-pagination";
import type { Account, CreditCard, Transaction } from "@/lib/types";
import { normalizeSearch } from "../../../procesos/_transactions/movement-explorer";
import { TransactionList } from "../../../procesos/_transactions/transaction-list";

const TYPES = [
  ["", "Todos"],
  ["expense", "Gastos"],
  ["income", "Ingresos"],
  ["card_payment", "Pagos de tarjeta"],
  ["transfer", "Transferencias"],
  ["opening_balance", "Saldos iniciales"],
] as const;

/** Consulta de lo archivado (3.1.0): solo ver, con búsqueda, tipo, año y filas por página. */
export function ArchivedExplorer({
  transactions,
  accounts,
  cards,
}: {
  transactions: Transaction[];
  accounts: Account[];
  cards: CreditCard[];
}) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [year, setYear] = useState("");
  const years = useMemo(
    () => [...new Set(transactions.map((t) => t.occurred_on.slice(0, 4)))].sort().reverse(),
    [transactions],
  );
  const filtered = useMemo(() => {
    const needle = normalizeSearch(q.trim());
    return transactions.filter((t) => {
      if (type && t.type !== type) return false;
      if (year && !t.occurred_on.startsWith(year)) return false;
      if (needle) {
        const text = normalizeSearch([t.category, t.note, t.counterparty_name, String(t.amount)].filter(Boolean).join(" "));
        if (!text.includes(needle)) return false;
      }
      return true;
    });
  }, [transactions, q, type, year]);
  const pager = usePagination(filtered, "filas:archivados");

  return (
    <div className="flex flex-col gap-4">
      <div className="surface grid grid-cols-2 gap-2 p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] sm:p-4">
        <label className="col-span-2 flex flex-col gap-1 sm:col-span-1">
          <span className="text-xs text-muted-foreground">Buscar</span>
          <span className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                pager.reset();
              }}
              placeholder="Nota, categoría, monto…"
              className="pl-8"
            />
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Tipo</span>
          <Select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              pager.reset();
            }}
          >
            {TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Año</span>
          <Select
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              pager.reset();
            }}
          >
            <option value="">Todos</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <p className="text-sm text-muted-foreground">
        {filtered.length} movimiento{filtered.length === 1 ? "" : "s"} archivado{filtered.length === 1 ? "" : "s"}
      </p>
      <TransactionList
        transactions={pager.visible}
        accounts={accounts}
        cards={cards}
        readOnly
        emptyLabel="No hay movimientos archivados con esos filtros."
      />
      <PaginationFooter state={pager.footer} />
    </div>
  );
}
