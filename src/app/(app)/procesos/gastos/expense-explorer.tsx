"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, FilterX, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/form-field";
import { formatCurrency } from "@/lib/format";
import type { CategoryIconKey } from "@/lib/category-icon-keys";
import type { Account, CreditCard, Transaction } from "@/lib/types";
import { TransactionList } from "../_transactions/transaction-list";

const PAGE_SIZES = [5, 10, 20, 50] as const;
type PageSize = (typeof PAGE_SIZES)[number] | "all";

type Filters = {
  from: string;
  to: string;
  category: string;
  origin: string;
  q: string;
  scheduled: boolean;
};

const EMPTY: Filters = { from: "", to: "", category: "", origin: "", q: "", scheduled: false };

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Gastos con filtros (2.5.0): fecha, categoría, origen (tarjeta, cuenta o
 * SINPE), texto libre y cuotas programadas; la tabla crece según el tamaño
 * de página elegido. Filtra en el cliente sobre los gastos ya leídos.
 */
export function ExpenseExplorer({
  transactions,
  accounts,
  cards,
  categories,
  categoryIcons,
  todayISO,
  initial,
}: {
  transactions: Transaction[];
  accounts: Account[];
  cards: CreditCard[];
  categories: string[];
  categoryIcons: Record<string, CategoryIconKey>;
  todayISO: string;
  /** Filtros iniciales desde la URL (`?desde=&hasta=&categoria=`). */
  initial?: Partial<Pick<Filters, "from" | "to" | "category">>;
}) {
  const [filters, setFilters] = useState<Filters>({ ...EMPTY, ...initial });
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [page, setPage] = useState(0);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(0);
  };

  const scheduledCount = useMemo(
    () => transactions.filter((t) => t.occurred_on > todayISO).length,
    [transactions, todayISO],
  );

  // Las categorías usadas en el historial también se pueden filtrar.
  const categoryList = useMemo(() => {
    const names = new Set(categories);
    for (const t of transactions) if (t.category) names.add(t.category);
    return [...names].sort((a, b) => a.localeCompare(b, "es"));
  }, [categories, transactions]);

  const filtered = useMemo(() => {
    const q = normalize(filters.q.trim());
    return transactions.filter((t) => {
      if (!filters.scheduled && t.occurred_on > todayISO) return false;
      if (filters.from && t.occurred_on < filters.from) return false;
      if (filters.to && t.occurred_on > filters.to) return false;
      if (filters.category && t.category !== filters.category) return false;
      if (filters.origin === "sinpe" && t.channel !== "sinpe") return false;
      if (filters.origin.startsWith("card:") && `card:${t.card_id}` !== filters.origin) return false;
      if (filters.origin.startsWith("account:") && `account:${t.account_id}` !== filters.origin)
        return false;
      if (q) {
        const text = normalize(
          [t.category, t.note, t.counterparty_name, t.counterparty_phone].filter(Boolean).join(" "),
        );
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, filters, todayISO]);

  const totals = useMemo(() => {
    const by: Record<string, number> = {};
    for (const t of filtered) by[t.currency] = (by[t.currency] ?? 0) + Number(t.amount);
    return Object.entries(by);
  }, [filtered]);

  const size = pageSize === "all" ? Math.max(filtered.length, 1) : pageSize;
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * size, current * size + size);
  const active =
    filters.from || filters.to || filters.category || filters.origin || filters.q || filters.scheduled;

  return (
    <div className="flex flex-col gap-4">
      <div className="surface flex flex-col gap-3 p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <label className="col-span-2 flex flex-col gap-1 md:col-span-3 xl:col-span-2">
            <span className="text-xs text-muted-foreground">Buscar</span>
            <span className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filters.q}
                onChange={(e) => set("q", e.target.value)}
                placeholder="Nota, categoría, destinatario…"
                className="pl-8"
              />
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Desde</span>
            <Input type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Hasta</span>
            <Input type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Categoría</span>
            <Select value={filters.category} onChange={(e) => set("category", e.target.value)}>
              <option value="">Todas</option>
              {categoryList.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Origen</span>
            <Select value={filters.origin} onChange={(e) => set("origin", e.target.value)}>
              <option value="">Todos</option>
              {cards.length > 0 ? (
                <optgroup label="Tarjetas">
                  {cards.map((c) => (
                    <option key={c.id} value={`card:${c.id}`}>
                      {c.name}
                      {c.archived ? " (desactivada)" : ""}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {accounts.length > 0 ? (
                <optgroup label="Cuentas">
                  {accounts.map((a) => (
                    <option key={a.id} value={`account:${a.id}`}>
                      {a.name}
                      {a.archived ? " (desactivada)" : ""}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              <option value="sinpe">Solo SINPE</option>
            </Select>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={filters.scheduled}
              onChange={(e) => set("scheduled", e.target.checked)}
              className="size-4 accent-foreground"
            />
            Ver cuotas programadas ({scheduledCount})
          </label>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {filtered.length} gasto{filtered.length === 1 ? "" : "s"}
              {totals.length > 0 ? " · " : ""}
              <span className="font-semibold text-foreground tabular-nums">
                {totals.map(([cur, sum]) => formatCurrency(sum, cur)).join(" + ")}
              </span>
            </span>
            {active ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilters(EMPTY);
                  setPage(0);
                }}
              >
                <FilterX className="size-4" /> Limpiar
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <TransactionList
        transactions={visible}
        accounts={accounts}
        cards={cards}
        categories={categories}
        categoryIcons={categoryIcons}
        emptyLabel={active ? "Ningún gasto coincide con los filtros." : "Aún no registrás gastos."}
      />

      {filtered.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <label className="flex items-center gap-2 text-muted-foreground">
            Filas
            <Select
              value={String(pageSize)}
              onChange={(e) => {
                const v = e.target.value;
                setPageSize(v === "all" ? "all" : (Number(v) as PageSize));
                setPage(0);
              }}
              className="w-24"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value="all">Todas</option>
            </Select>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground tabular-nums">
              {current * size + 1}–{Math.min(filtered.length, current * size + size)} de{" "}
              {filtered.length}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Página anterior"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Página siguiente"
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
