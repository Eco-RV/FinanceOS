"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/form-field";
import { PAGE_SIZES, type PageSize, type PaginationState } from "@/lib/use-pagination";

/** Pie de una lista paginada (3.1.0): "Filas" 5/10/20/50/Todas, "a–b de N" y flechas. */
export function PaginationFooter({ state }: { state: PaginationState }) {
  if (state.total === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <label className="flex items-center gap-2 text-muted-foreground">
        Filas
        <Select
          value={String(state.pageSize)}
          onChange={(e) => {
            const v = e.target.value;
            state.setPageSize(v === "all" ? "all" : (Number(v) as PageSize));
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
          {state.from}–{state.to} de {state.total}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Página anterior"
          disabled={!state.canPrev}
          onClick={state.prev}
        >
          <ChevronLeft />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Página siguiente"
          disabled={!state.canNext}
          onClick={state.next}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
