"use client";

import { useEffect, useRef, useState, type ComponentProps, type ComponentType } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TransactionForm as TransactionFormType } from "./procesos/_transactions/transaction-form";

type FormProps = ComponentProps<typeof TransactionFormType>;
type Kind = "expense" | "income";

const loadForm = () => import("./procesos/_transactions/transaction-form").then((m) => m.TransactionForm);

const FAB_CLASS =
  "size-14 rounded-2xl shadow-lg transition-[background-color,box-shadow,scale,filter] hover:shadow-xl hover:brightness-105 motion-safe:active:scale-90";

/**
 * 3.1.0 · 3.2.0 (Fase 1.2): botones flotantes de Nuevo gasto y Nuevo ingreso.
 * El código de los formularios ya no viene en la carga inicial de cada
 * página: se baja cuando el navegador queda libre (o al tocar) y, si se tocó
 * antes de que llegara, el diálogo se abre en cuanto está. Mientras tanto se
 * pinta un botón idéntico.
 */
export function QuickAdd({ expense, income }: { expense: FormProps; income: FormProps | null }) {
  const [Form, setForm] = useState<ComponentType<FormProps> | null>(null);
  const openWhenReady = useRef<Kind | null>(null);
  const slots = useRef<Record<Kind, HTMLDivElement | null>>({ expense: null, income: null });

  function load() {
    loadForm().then((component) => setForm(() => component));
  }

  // Cuando el navegador queda libre, baja el formulario sin esperar el toque.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1500));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = idle(() => load());
    return () => cancel(id);
  }, []);

  // Se tocó antes de que llegara: abrir con el botón real (así corre su lógica
  // de apertura, como proponer la última cuenta y categoría).
  useEffect(() => {
    const kind = openWhenReady.current;
    if (!Form || !kind) return;
    openWhenReady.current = null;
    slots.current[kind]?.querySelector("button")?.click();
  }, [Form]);

  function press(kind: Kind) {
    openWhenReady.current = kind;
    load();
  }

  return (
    <>
      <div ref={(el) => void (slots.current.expense = el)} className="contents">
        {Form ? <Form {...expense} /> : <FabPlaceholder kind="expense" onPress={press} />}
      </div>
      {income ? (
        <div ref={(el) => void (slots.current.income = el)} className="contents">
          {Form ? <Form {...income} /> : <FabPlaceholder kind="income" onPress={press} />}
        </div>
      ) : null}
    </>
  );
}

/** Mismo aspecto que el botón real del formulario, mientras se baja. */
function FabPlaceholder({ kind, onPress }: { kind: Kind; onPress: (kind: Kind) => void }) {
  const isExpense = kind === "expense";
  const label = isExpense ? "Nuevo gasto" : "Nuevo ingreso";
  return (
    <Button
      size="icon-lg"
      aria-label={label}
      title={label}
      className={cn(
        FAB_CLASS,
        isExpense ? "bg-expense text-expense-foreground hover:bg-expense" : "bg-income text-income-foreground hover:bg-income",
      )}
      onClick={() => onPress(kind)}
    >
      {isExpense ? <ArrowUp className="size-6" strokeWidth={2.5} /> : <ArrowDown className="size-6" strokeWidth={2.5} />}
    </Button>
  );
}
