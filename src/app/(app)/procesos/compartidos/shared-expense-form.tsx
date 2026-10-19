"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Equal, LoaderCircle, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, Select } from "@/components/form-field";
import { Stepper } from "@/components/stepper";
import {
  crToday,
  defaultSharedDueDate,
  sharedDueDate,
  suggestSplit,
  toISODate,
  type CardCycle,
} from "@/domain";
import { formatCurrency, formatDate } from "@/lib/format";
import type { CategoryIconKey } from "@/lib/category-icon-keys";
import type { FormResult } from "@/lib/forms";
import type { Account, CreditCard, DebitCard } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CategoryPicker } from "../_transactions/category-picker";
import { addPerson, saveSharedExpense } from "./actions";

type Currency = "CRC" | "USD";
type Person = { id: string; name: string; archived?: boolean };

/** Gasto ya registrado que se comparte (o el de un compartido que se edita). */
export type SharedSourceView = {
  movement_id: string;
  amount: number;
  currency: Currency;
  occurred_on: string;
  originLabel: string;
  category: string | null;
  note: string | null;
  card: CardCycle | null;
};

export type ExistingShared = {
  id: string;
  description: string;
  due_on: string;
  parts: { member_id: string; amount: number; paid: boolean }[];
};

const STEPS = ["Gasto", "Personas", "Revisar"];

/**
 * Asistente de gasto compartido (3.0.1) en 3 pasos conectados: el gasto (nuevo
 * o uno ya registrado), las personas con su parte (sugerida en partes
 * iguales, X2) y la revisión con la fecha límite de cobro (X3).
 */
export function SharedExpenseForm({
  source,
  existing,
  people: initialPeople,
  accounts = [],
  cards = [],
  debitCards = [],
  categories = [],
  categoryIcons,
}: {
  source?: SharedSourceView;
  existing?: ExistingShared;
  people: Person[];
  accounts?: Account[];
  cards?: CreditCard[];
  debitCards?: DebitCard[];
  categories?: string[];
  categoryIcons?: Record<string, CategoryIconKey>;
}) {
  const router = useRouter();
  const today = toISODate(crToday());
  const [step, setStep] = useState(source ? 1 : 0);
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  // Paso 1 · el gasto (solo si es nuevo).
  const [description, setDescription] = useState(existing?.description ?? source?.note ?? "");
  const [amountRaw, setAmountRaw] = useState("");
  const [origin, setOrigin] = useState(cards[0] ? `card:${cards[0].id}` : accounts[0] ? `account:${accounts[0].id}` : "");
  const [cardCurrency, setCardCurrency] = useState<Currency>((cards[0]?.currency as Currency) ?? "CRC");
  const [category, setCategory] = useState("");
  const [occurredOn, setOccurredOn] = useState(today);

  const [kind, originId] = origin.split(":");
  const originCard = kind === "card" ? cards.find((c) => c.id === originId) : undefined;
  const originAccount =
    kind === "account"
      ? accounts.find((a) => a.id === originId)
      : kind === "debit"
        ? accounts.find((a) => a.id === debitCards.find((d) => d.id === originId)?.account_id)
        : undefined;

  const total = source ? source.amount : Number(amountRaw.replace(",", ".")) || 0;
  const currency: Currency = source
    ? source.currency
    : originCard
      ? cardCurrency
      : ((originAccount?.currency as Currency) ?? "CRC");
  const date = source ? source.occurred_on : occurredOn;
  const cycle: CardCycle | null = source
    ? source.card
    : originCard
      ? {
          cutoff_day: originCard.cutoff_day,
          payment_due_day: originCard.payment_due_day,
          cutoff_day_rolls_over: originCard.cutoff_day_rolls_over ?? false,
        }
      : null;

  // Paso 2 · personas y partes. 04: se sugiere partes iguales.
  const [people, setPeople] = useState(initialPeople);
  const paid = useMemo(() => new Set(existing?.parts.filter((p) => p.paid).map((p) => p.member_id)), [existing]);
  const [selected, setSelected] = useState<string[]>(existing?.parts.map((p) => p.member_id) ?? []);
  const [includeMe, setIncludeMe] = useState(true);
  const [amounts, setAmounts] = useState<Record<string, string>>(
    Object.fromEntries(existing?.parts.map((p) => [p.member_id, String(p.amount)]) ?? []),
  );

  function resplit(ids: string[], me: boolean, t = total) {
    // Las partes ya pagadas no se tocan (X6); el resto se reparte en partes iguales.
    const paidCents = ids.filter((id) => paid.has(id)).reduce((s, id) => s + Math.round(Number(amounts[id]) * 100), 0);
    const free = ids.filter((id) => !paid.has(id));
    const split = suggestSplit(Math.max(0, t - paidCents / 100), free, me);
    setAmounts((prev) => ({
      ...prev,
      ...Object.fromEntries(split.map((s) => [s.member_id, s.amount ? String(s.amount) : ""])),
    }));
  }

  function toggle(id: string) {
    if (paid.has(id)) return;
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    setSelected(next);
    resplit(next, includeMe);
  }

  const membersCents = selected.reduce((s, id) => s + Math.round((Number(amounts[id]) || 0) * 100), 0);
  const ownCents = Math.round(total * 100) - membersCents;

  // Paso 3 · fecha límite (X3).
  const [dueChosen, setDueChosen] = useState(existing?.due_on ?? defaultSharedDueDate(date));
  let dueOn: string | null = null;
  try {
    dueOn = sharedDueDate({ occurred_on: date, card: cycle, chosen: cycle ? null : dueChosen });
  } catch {
    dueOn = null;
  }

  // Agregar una persona sin salir del asistente.
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [adding, startAdding] = useTransition();
  function addNewPerson() {
    const fd = new FormData();
    fd.set("name", newName);
    fd.set("phone", newPhone);
    startAdding(async () => {
      const r = await addPerson(fd);
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      setPeople((p) => [...p, r.member]);
      setNewName("");
      setNewPhone("");
      const next = [...selected, r.member.id];
      setSelected(next);
      resplit(next, includeMe);
    });
  }

  function validateStep(i: number): boolean {
    const e: Record<string, string> = {};
    if (i === 0 && !source) {
      if (!(total > 0)) e.amount = "Monto mayor que 0";
      if (!origin) e.origin = "Elige con qué pagaste";
      if (!category) e.category = "Elige una categoría";
    }
    if (i === 1) {
      if (selected.length === 0) e.people = "Elige al menos una persona";
      else if (selected.some((id) => !(Number(amounts[id]) > 0))) e.people = "Cada persona necesita un monto mayor que 0";
      else if (ownCents < 0) e.people = "Las partes pasan el total del gasto";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (!validateStep(step)) return;
    // Si cambió el total, se vuelve a sugerir el reparto en partes iguales.
    if (step === 0 && selected.length > 0) resplit(selected, includeMe);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function submit() {
    if (!validateStep(1)) return setStep(1);
    const fd = new FormData();
    if (existing) fd.set("id", existing.id);
    if (source && !existing) fd.set("movement_id", source.movement_id);
    fd.set("description", description);
    if (!cycle) fd.set("due_on", dueChosen);
    if (!source) {
      fd.set("amount", String(total));
      fd.set("origin", origin);
      if (originCard) fd.set("currency", cardCurrency);
      fd.set("category", category);
      fd.set("occurred_on", occurredOn);
    }
    for (const id of selected) fd.set(`share:${id}`, amounts[id] ?? "");
    setMessage(null);
    start(async () => {
      const r: FormResult = await saveSharedExpense(undefined, fd);
      if (r && !r.ok) {
        setMessage(r.message ?? Object.values(r.errors ?? {})[0] ?? "No se pudo guardar");
        return;
      }
      if (existing) {
        toast.success("Reparto actualizado");
        router.push(`/procesos/compartidos/${existing.id}`);
      }
    });
  }

  const money = (n: number) => formatCurrency(n, currency);

  return (
    <div className="surface flex flex-col gap-6 p-4 sm:p-6">
      <Stepper steps={STEPS} current={step} onStep={(i) => (source && i === 0 ? null : setStep(i))} />

      {step === 0 ? (
        source ? (
          <SourceSummary source={source} />
        ) : (
          <div className="flex flex-col gap-4">
            <FormField label="Descripción" htmlFor="description">
              <Input
                id="description"
                value={description}
                maxLength={80}
                placeholder="Cena del viernes, súper, regalo…"
                onChange={(e) => setDescription(e.target.value)}
                autoFocus
              />
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Con qué pagaste" htmlFor="origin" error={errors.origin}>
                <Select id="origin" value={origin} onChange={(e) => setOrigin(e.target.value)}>
                  {cards.length > 0 ? (
                    <optgroup label="Tarjetas de crédito">
                      {cards.map((c) => (
                        <option key={c.id} value={`card:${c.id}`}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {debitCards.length > 0 ? (
                    <optgroup label="Tarjetas de débito">
                      {debitCards.map((d) => (
                        <option key={d.id} value={`debit:${d.id}`}>
                          {d.last_four ? `${d.name} ••${d.last_four}` : d.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {accounts.length > 0 ? (
                    <optgroup label="Cuentas">
                      {accounts.map((a) => (
                        <option key={a.id} value={`account:${a.id}`}>
                          {a.name} · {a.currency}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </Select>
              </FormField>
              <FormField label="Fecha" htmlFor="occurred_on">
                <Input
                  id="occurred_on"
                  type="date"
                  value={occurredOn}
                  onChange={(e) => setOccurredOn(e.target.value)}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
              <FormField label="Total que pagaste" htmlFor="amount" error={errors.amount}>
                <Input
                  id="amount"
                  inputMode="decimal"
                  value={amountRaw}
                  placeholder="0"
                  onChange={(e) => setAmountRaw(e.target.value.replace(/[^\d.,]/g, ""))}
                />
              </FormField>
              {originCard ? (
                <FormField label="Moneda" htmlFor="currency">
                  <Select
                    id="currency"
                    value={cardCurrency}
                    onChange={(e) => setCardCurrency(e.target.value as Currency)}
                    className="w-24"
                  >
                    <option value="CRC">CRC</option>
                    <option value="USD">USD</option>
                  </Select>
                </FormField>
              ) : (
                <div className="flex items-end pb-2 text-sm text-muted-foreground">{currency}</div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium">Categoría</p>
              <CategoryPicker
                name="category_ui"
                categories={categories}
                icons={categoryIcons}
                value={category}
                onChange={setCategory}
                error={errors.category}
              />
            </div>
          </div>
        )
      ) : null}

      {step === 1 ? (
        <div className="flex flex-col gap-4">
          {source ? <SourceSummary source={source} compact /> : null}
          {!source ? (
            <p className="text-sm text-muted-foreground">
              Total {money(total)}
              {description ? ` · ${description}` : ""}
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">¿Con quién lo compartes?</p>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
                <input
                  type="checkbox"
                  checked={includeMe}
                  onChange={(e) => {
                    setIncludeMe(e.target.checked);
                    resplit(selected, e.target.checked);
                  }}
                  className="size-4 accent-foreground"
                />
                Yo también pago una parte
              </label>
            </div>
            {people.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no tienes personas. Agrega la primera aquí abajo.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {people
                  .filter((p) => !p.archived || selected.includes(p.id))
                  .map((p) => {
                    const on = selected.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggle(p.id)}
                        aria-pressed={on}
                        disabled={paid.has(p.id)}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-sm transition-[background-color,color,box-shadow,scale] duration-150 motion-safe:active:scale-95 disabled:opacity-80",
                          on
                            ? "bg-foreground text-background"
                            : "bg-muted text-muted-foreground ring-1 ring-transparent hover:text-foreground",
                        )}
                      >
                        {p.name}
                        {paid.has(p.id) ? " · pagó" : ""}
                      </button>
                    );
                  })}
              </div>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <FormField label="Nueva persona" htmlFor="new_name">
                <Input
                  id="new_name"
                  value={newName}
                  maxLength={60}
                  placeholder="Nombre"
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-40"
                />
              </FormField>
              <FormField label="WhatsApp" htmlFor="new_phone">
                <Input
                  id="new_phone"
                  value={newPhone}
                  inputMode="tel"
                  placeholder="8888-8888"
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-36"
                />
              </FormField>
              <Button
                type="button"
                variant="outline"
                disabled={adding || !newName.trim() || !newPhone.trim()}
                onClick={addNewPerson}
              >
                {adding ? <LoaderCircle className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                Agregar
              </Button>
            </div>
          </div>

          {selected.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Cuánto paga cada uno ({currency})</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => resplit(selected, includeMe)}>
                  <Equal className="size-4" /> Partes iguales
                </Button>
              </div>
              <ul className="flex flex-col divide-y rounded-xl bg-muted/40">
                {selected.map((id) => {
                  const person = people.find((p) => p.id === id);
                  return (
                    <li key={id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="min-w-0 truncate text-sm">{person?.name ?? "Persona"}</span>
                      <Input
                        aria-label={`Parte de ${person?.name ?? "la persona"}`}
                        inputMode="decimal"
                        value={amounts[id] ?? ""}
                        disabled={paid.has(id)}
                        onChange={(e) =>
                          setAmounts((a) => ({ ...a, [id]: e.target.value.replace(/[^\d.,]/g, "").replace(",", ".") }))
                        }
                        className="w-32 text-right tabular-nums"
                      />
                    </li>
                  );
                })}
                <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Tu parte</span>
                  <span className={cn("font-semibold tabular-nums", ownCents < 0 && "text-destructive")}>
                    {money(ownCents / 100)}
                  </span>
                </li>
              </ul>
            </div>
          ) : null}
          {errors.people ? <p className="text-sm text-destructive">{errors.people}</p> : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Gasto</dt>
            <dd className="text-right">
              {description || source?.note || "Gasto compartido"} · {money(total)}
            </dd>
            {selected.map((id) => (
              <div key={id} className="contents">
                <dt className="text-muted-foreground">{people.find((p) => p.id === id)?.name ?? "Persona"}</dt>
                <dd className="text-right tabular-nums">{money(Number(amounts[id]) || 0)}</dd>
              </div>
            ))}
            <dt className="text-muted-foreground">Tu parte</dt>
            <dd className="text-right font-semibold tabular-nums">{money(ownCents / 100)}</dd>
          </dl>
          {cycle ? (
            <p className="rounded-xl bg-muted/60 px-3 py-2 text-sm">
              Te deben pagar antes del <span className="font-medium">{dueOn ? formatDate(dueOn) : "—"}</span>: la
              fecha límite del estado de cuenta en que cae este cargo.
            </p>
          ) : (
            <FormField label="Te deben pagar antes del" htmlFor="due_on">
              <Input
                id="due_on"
                type="date"
                min={date}
                value={dueChosen}
                onChange={(e) => setDueChosen(e.target.value)}
              />
            </FormField>
          )}
          {source || existing ? (
            <FormField label="Descripción" htmlFor="description_review">
              <Input
                id="description_review"
                value={description}
                maxLength={80}
                placeholder="Cena del viernes, súper, regalo…"
                onChange={(e) => setDescription(e.target.value)}
              />
            </FormField>
          ) : null}
          {message ? <p className="text-sm text-destructive">{message}</p> : null}
        </div>
      ) : null}

      <div className="flex justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          disabled={step === 0 || (Boolean(source) && step === 1)}
          onClick={() => setStep((s) => s - 1)}
        >
          Atrás
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next}>
            Siguiente
          </Button>
        ) : (
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {existing ? "Guardar cambios" : "Compartir gasto"}
          </Button>
        )}
      </div>
    </div>
  );
}

function SourceSummary({ source, compact }: { source: SharedSourceView; compact?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-xl bg-muted/50", compact ? "px-3 py-2" : "p-4")}>
      <div className="min-w-0">
        <p className="truncate font-medium">{source.note || source.category || "Gasto"}</p>
        <p className="truncate text-xs text-muted-foreground">
          {formatDate(source.occurred_on)} · {source.originLabel}
          {source.category ? ` · ${source.category}` : ""}
        </p>
      </div>
      <p className="shrink-0 font-semibold tabular-nums">{formatCurrency(source.amount, source.currency)}</p>
    </div>
  );
}
