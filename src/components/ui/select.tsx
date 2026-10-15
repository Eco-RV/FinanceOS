"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Combo propio (2.5.0) en lugar del `<select>` nativo, que en cada sistema se
 * ve distinto (y en oscuro se leía mal). Acepta la misma forma que un
 * `<select>`: hijos `<option>` / `<optgroup>`, `name`, `value` / `defaultValue`,
 * `onChange(e)` con `e.target.value`, `id`, `required`, `disabled`. Envía el
 * valor en un input oculto, así que sirve igual dentro de un `<form action>`.
 */

type Option = { value: string; label: React.ReactNode; text: string; disabled?: boolean };
type Group = { label: string | null; options: Option[] };

function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

function toOption(el: React.ReactElement<React.ComponentProps<"option">>): Option {
  const label = el.props.children;
  const value = el.props.value != null ? String(el.props.value) : textOf(label);
  return { value, label, text: textOf(label), disabled: el.props.disabled };
}

/** `<option>` / `<optgroup>` (también dentro de fragmentos) → grupos de opciones. */
function parse(children: React.ReactNode): Group[] {
  const groups: Group[] = [];
  let loose: Group | null = null;
  const visit = (nodes: React.ReactNode) => {
    React.Children.forEach(nodes, (child) => {
      if (!React.isValidElement(child)) return;
      if (child.type === React.Fragment) {
        visit((child.props as { children?: React.ReactNode }).children);
      } else if (child.type === "optgroup") {
        const props = child.props as React.ComponentProps<"optgroup">;
        const options: Option[] = [];
        React.Children.forEach(props.children, (o) => {
          if (React.isValidElement(o) && o.type === "option")
            options.push(toOption(o as React.ReactElement<React.ComponentProps<"option">>));
        });
        groups.push({ label: props.label ?? null, options });
        loose = null;
      } else if (child.type === "option") {
        if (!loose) {
          loose = { label: null, options: [] };
          groups.push(loose);
        }
        loose.options.push(toOption(child as React.ReactElement<React.ComponentProps<"option">>));
      }
    });
  };
  visit(children);
  return groups;
}

export function Select({
  children,
  className,
  value,
  defaultValue,
  onChange,
  name,
  id,
  required,
  disabled,
  ...rest
}: React.ComponentProps<"select">) {
  const groups = React.useMemo(() => parse(children), [children]);
  const options = groups.flatMap((g) => g.options);
  // Igual que el nativo: sin valor inicial queda elegida la primera opción.
  const initial = defaultValue != null ? String(defaultValue) : (options[0]?.value ?? "");
  const [inner, setInner] = React.useState(initial);
  const controlled = value != null;
  const current = controlled ? String(value) : inner;
  const selected = options.find((o) => o.value === current);
  const placeholder = selected?.value === "" ? selected.text : undefined;

  return (
    <SelectPrimitive.Root
      id={id}
      name={name}
      required={required}
      disabled={disabled}
      value={current}
      onValueChange={(next) => {
        const v = next == null ? "" : String(next);
        if (!controlled) setInner(v);
        onChange?.({
          target: { value: v, name },
          currentTarget: { value: v, name },
        } as unknown as React.ChangeEvent<HTMLSelectElement>);
      }}
    >
      <SelectPrimitive.Trigger
        aria-invalid={rest["aria-invalid"]}
        aria-label={rest["aria-label"]}
        className={cn(
          "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-card pr-2 pl-3 text-left text-base transition-[color,background-color,border-color,box-shadow] duration-150 ease-fluid outline-none select-none hover:border-ring/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:border-ring data-popup-open:ring-3 data-popup-open:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 data-disabled:cursor-not-allowed data-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30",
          className,
        )}
      >
        <SelectPrimitive.Value
          className={cn("truncate", placeholder != null && "text-muted-foreground")}
        >
          {() => selected?.label ?? ""}
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon className="shrink-0 text-muted-foreground">
          <ChevronsUpDown className="size-4" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner
          className="z-[60] outline-none select-none"
          sideOffset={6}
          alignItemWithTrigger={false}
        >
          <SelectPrimitive.Popup className="group min-w-[var(--anchor-width)] max-w-[min(24rem,calc(100vw-2rem))] origin-[var(--transform-origin)] overflow-hidden rounded-xl bg-popover/95 text-popover-foreground shadow-xl ring-1 ring-foreground/10 backdrop-blur-xl transition-[scale,opacity] duration-150 ease-fluid outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <SelectPrimitive.ScrollUpArrow className="flex h-5 w-full cursor-default items-center justify-center text-muted-foreground">
              <ChevronUp className="size-4" />
            </SelectPrimitive.ScrollUpArrow>
            <SelectPrimitive.List className="max-h-[min(20rem,var(--available-height))] overflow-y-auto overscroll-contain p-1 scroll-py-1">
              {groups.map((g, gi) => {
                const items = g.options.map((o) => (
                  <SelectPrimitive.Item
                    key={o.value}
                    value={o.value}
                    disabled={o.disabled}
                    className={cn(
                      "relative flex min-h-9 cursor-default items-center gap-2 rounded-lg py-1.5 pr-8 pl-2.5 text-sm outline-none select-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground",
                      o.value === "" && "text-muted-foreground",
                    )}
                  >
                    <SelectPrimitive.ItemText className="truncate">{o.label}</SelectPrimitive.ItemText>
                    <SelectPrimitive.ItemIndicator className="absolute right-2.5 text-foreground">
                      <Check className="size-4" />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                ));
                return g.label ? (
                  <SelectPrimitive.Group
                    key={`g${gi}`}
                    className={cn(gi > 0 && "mt-1 border-t pt-1")}
                  >
                    <SelectPrimitive.GroupLabel className="px-2.5 py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {g.label}
                    </SelectPrimitive.GroupLabel>
                    {items}
                  </SelectPrimitive.Group>
                ) : (
                  <React.Fragment key={`g${gi}`}>{items}</React.Fragment>
                );
              })}
            </SelectPrimitive.List>
            <SelectPrimitive.ScrollDownArrow className="flex h-5 w-full cursor-default items-center justify-center text-muted-foreground">
              <ChevronDown className="size-4" />
            </SelectPrimitive.ScrollDownArrow>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
