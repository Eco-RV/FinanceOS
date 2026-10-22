"use client";

import { useMemo, useState, type ReactNode } from "react";
import { FilterX, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/form-field";
import { PaginationFooter } from "@/components/pagination-footer";
import { formatCurrency } from "@/lib/format";
import { usePagination } from "@/lib/use-pagination";
import type { CategoryIconKey } from "@/lib/category-icon-keys";
import type { Account, CreditCard, DebitCard, Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";
import { displayAmount, TransactionList } from "./transaction-list";

/** Qué tipos de movimiento se filtran en cada historial. */
const KINDS = {
  card: [
    ["charge", "Cargos"],
    ["installment", "Cuotas"],
    ["payment", "Pagos"],
    ["opening", "Saldo inicial"],
  ],
  account: [
    ["expense", "Gastos"],
    ["income", "Ingresos"],
    ["transfer", "Transferencias"],
    ["payment", "Pagos de tarjeta"],
    ["opening", "Saldo inicial"],
  ],
} as const;

type Kind = (typeof KINDS)[keyof typeof KINDS][number][0];

function kindOf(t: Transaction): Kind {
  if (t.type === "opening_balance") return "opening";
  if (t.type === "card_payment") return "payment";
  if (t.type === "transfer") return "transfer";
  if (t.type === "income") return "income";
  return t.financing_id ? "installment" : t.card_id ? "charge" : "expense";
}

/** Sin tildes ni mayúsculas, para buscar "cafe" y encontrar "Café". */
export function normalizeSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

type Filters = { q: string; kind: string; from: string; to: string; currency: string; future: boolean };
const EMPTY: Filters = { q: "", kind: "", from: "", to: "", currency: "", future: false };

/**
 * Historial con filtros y paginación (3.1.0) para el detalle de una tarjeta o
 * de una cuenta. Por defecto muestra solo hasta hoy; "Incluir futuras" suma
 * las cuotas programadas de financiamientos y todo lo que tiene fecha > hoy
 * (M7). Filtra en el cliente: la página ya trajo todos los movimientos.
 */
export function MovementExplorer({
  context,
  transactions,
  accounts,
  cards,
  debitCards,
  categories,
  categoryIcons,
  accountId,
  cancelledFinancingIds,
  todayISO,
  emptyLabel,
  emptyAction,
  sharedLinks,
  shareable,
}: {
  context: "card" | "account";
  transactions: Transaction[];
  accounts: Account[];
  cards: CreditCard[];
  debitCards?: DebitCard[];
  categories?: string[];
  categoryIcons?: Record<string, CategoryIconKey>;
  accountId?: string;
  cancelledFinancingIds?: string[];
  todayISO: string;
  emptyLabel: string;
  /** 3.2.0: el paso que sigue cuando no hay movimientos (sin filtros). */
  emptyAction?: ReactNode;
  /** 3.1.0: movimiento → gasto compartido. */
  sharedLinks?: Record<string, string>;
  /** 3.2.0 (E2): ofrecer "Compartir" (función "Gastos compartidos"). */
  shareable?: boolean;
}) {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [more, setMore] = useState(false);

  const futureCount = useMemo(
    () => transactions.filter((t) => t.occurred_on > todayISO).length,
    [transactions, todayISO],
  );
  const currencies = useMemo(() => [...new Set(transactions.map((t) => t.currency))].sort(), [transactions]);

  const filtered = useMemo(() => {
    const q = normalizeSearch(filters.q.trim());
    return transactions.filter((t) => {
      if (!filters.future && t.occurred_on > todayISO) return false;
      if (filters.kind && kindOf(t) !== filters.kind) return false;
      if (filters.from && t.occurred_on < filters.from) return false;
      if (filters.to && t.occurred_on > filters.to) return false;
      if (filters.currency && t.currency !== filters.currency) return false;
      if (q) {
        const text = normalizeSearch(
          [t.category, t.note, t.counterparty_name, t.counterparty_phone, String(t.amount)]
            .filter(Boolean)
            .join(" "),
        );
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, filters, todayISO]);

  const pager = usePagination(filtered, `filas:${context}`);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    pager.reset();
  };

  // Totales de lo filtrado: en una tarjeta, cargos vs. pagos; en una cuenta, entradas vs. salidas.
  const totals = useMemo(() => {
    const up: Record<string, number> = {};
    const down: Record<string, number> = {};
    for (const t of filtered) {
      const { amount, currency } = displayAmount(t, context, accountId);
      const bucket = amount >= 0 ? up : down;
      bucket[currency] = (bucket[currency] ?? 0) + Math.abs(amount);
    }
    const fmt = (b: Record<string, number>) =>
      Object.entries(b)
        .map(([cur, sum]) => formatCurrency(sum, cur))
        .join(" + ");
    return { up: fmt(up), down: fmt(down) };
  }, [filtered, context, accountId]);

  const active = Boolean(
    filters.q || filters.kind || filters.from || filters.to || filters.currency || filters.future,
  );
  const labels = context === "card" ? ["Cargos", "Pagos"] : ["Entradas", "Salidas"];

  return (
    <div className="flex flex-col gap-4">
      <div className="surface flex flex-col gap-3 p-3 sm:p-4">
        {/* 06 · Pocas opciones a la vista: buscar, tipo y futuras; el resto en "Más filtros". */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
          <label className="col-span-2 flex flex-col gap-1 md:col-span-1">
            <span className="text-xs text-muted-foreground">Buscar</span>
            <span className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filters.q}
                onChange={(e) => set("q", e.target.value)}
                placeholder="Nota, categoría, monto…"
                className="pl-8"
              />
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Tipo</span>
            <Select value={filters.kind} onChange={(e) => set("kind", e.target.value)}>
              <option value="">Todos</option>
              {KINDS[context].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setMore((m) => !m)}
              aria-expanded={more}
              className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-muted px-3 text-sm text-muted-foreground transition-[background-color,color,scale] duration-150 hover:text-foreground motion-safe:active:scale-95"
            >
              <Plus className={cn("size-4 transition-transform duration-200 ease-fluid", more && "rotate-45")} />
              {more ? "Menos filtros" : "Más filtros"}
            </button>
          </div>
        </div>

        {more ? (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Desde</span>
              <Input type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Hasta</span>
              <Input type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} />
            </label>
            {currencies.length > 1 ? (
              <label className="col-span-2 flex flex-col gap-1 md:col-span-1">
                <span className="text-xs text-muted-foreground">Moneda</span>
                <Select value={filters.currency} onChange={(e) => set("currency", e.target.value)}>
                  <option value="">Todas</option>
                  {currencies.map((c) => (
                    <option key={c} value={c}>
                      {c === "USD" ? "Dólares ($)" : "Colones (₡)"}
                    </option>
                  ))}
                </Select>
              </label>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={filters.future}
              onChange={(e) => set("future", e.target.checked)}
              className="size-4 accent-foreground"
            />
            {context === "card" ? "Incluir futuras (cuotas programadas)" : "Incluir futuras"} ({futureCount})
          </label>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-muted-foreground">
              {filtered.length} movimiento{filtered.length === 1 ? "" : "s"}
              {totals.up ? (
                <>
                  {" · "}
                  {labels[0]}{" "}
                  <span className="font-semibold text-foreground tabular-nums">{totals.up}</span>
                </>
              ) : null}
              {totals.down ? (
                <>
                  {" · "}
                  {labels[1]}{" "}
                  <span className="font-semibold text-foreground tabular-nums">{totals.down}</span>
                </>
              ) : null}
            </span>
            {active ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilters(EMPTY);
                  pager.reset();
                }}
              >
                <FilterX className="size-4" /> Limpiar
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <TransactionList
        transactions={pager.visible}
        accounts={accounts}
        cards={cards}
        debitCards={debitCards}
        categories={categories}
        categoryIcons={categoryIcons}
        context={context}
        accountId={accountId}
        cancelledFinancingIds={cancelledFinancingIds}
        sharedLinks={sharedLinks}
        shareable={shareable}
        emptyLabel={active ? "Ningún movimiento coincide con los filtros." : emptyLabel}
        emptyAction={active ? undefined : emptyAction}
      />

      <PaginationFooter state={pager.footer} />
    </div>
  );
}
