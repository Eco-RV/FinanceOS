import { Check } from "lucide-react";
import type { CreditCard } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Degradados de las tarjetas (estables por tarjeta). */
const SKINS = [
  "from-zinc-800 via-zinc-900 to-black",
  "from-indigo-500 via-indigo-700 to-violet-900",
  "from-emerald-500 via-teal-700 to-teal-950",
  "from-rose-500 via-rose-700 to-orange-900",
  "from-sky-500 via-blue-700 to-blue-950",
  "from-amber-400 via-orange-600 to-orange-900",
  "from-fuchsia-500 via-purple-700 to-purple-950",
];

function skinFor(card: Pick<CreditCard, "id" | "name">): string {
  let h = 0;
  for (const ch of card.id + card.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SKINS[h % SKINS.length];
}

type CardFace = Pick<CreditCard, "id" | "name" | "last_four" | "institution" | "currency">;

/**
 * Una tarjeta con el aspecto de una tarjeta física (proporción ISO 7810),
 * con el mismo degradado en el carrusel del gasto y en el detalle (2.5.0).
 */
export function WalletCard({
  card,
  selected,
  size = "md",
  className,
}: {
  card: CardFace;
  selected?: boolean;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex aspect-[1.586] w-full flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br text-white shadow-lg ring-1 ring-white/10",
        size === "lg" ? "p-5 shadow-2xl" : "p-4",
        skinFor(card),
        className,
      )}
    >
      {/* Brillo diagonal y círculos decorativos. */}
      <span className="pointer-events-none absolute -top-1/2 -right-1/4 size-[120%] rounded-full bg-white/[0.07]" />
      <span className="pointer-events-none absolute -bottom-1/3 -left-1/4 size-3/4 rounded-full bg-black/10" />

      <div className="relative flex items-start justify-between gap-2">
        <span
          className={cn(
            "truncate font-semibold tracking-tight drop-shadow-sm",
            size === "lg" ? "text-base" : "text-sm",
          )}
        >
          {card.name}
        </span>
        {selected ? (
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-black shadow-md">
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        ) : null}
      </div>

      <span
        className={cn(
          "relative rounded-md bg-gradient-to-br from-amber-200 to-amber-400/80 shadow-inner ring-1 ring-black/10",
          size === "lg" ? "h-8 w-11" : "h-6 w-8",
        )}
      />

      <div className="relative flex items-end justify-between gap-2">
        <span
          className={cn(
            "font-mono tracking-[0.18em] opacity-90",
            size === "lg" ? "text-base" : "text-sm",
          )}
        >
          •••• {card.last_four ?? "····"}
        </span>
        <span
          className={cn(
            "truncate font-bold tracking-wide uppercase italic opacity-90",
            size === "lg" ? "text-sm" : "text-xs",
          )}
        >
          {card.institution ?? card.currency}
        </span>
      </div>
    </div>
  );
}

/**
 * La tarjeta grande arriba del detalle (2.5.0): entra desde abajo con un giro
 * 3D, se asienta y le pasa un brillo. Con "reducir movimiento", queda quieta.
 */
export function WalletCardHero({ card }: { card: CardFace }) {
  return (
    <div className="w-full max-w-sm shrink-0 [perspective:1200px] sm:w-80">
      <div
        data-motion
        className="relative"
        style={{ animation: "card-enter 750ms var(--ease-spring) both" }}
      >
        <WalletCard card={card} size="lg" />
        <span
          aria-hidden
          data-motion
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
        >
          <span
            data-motion
            className="absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0"
            style={{ animation: "card-shine 1100ms var(--ease-fluid) 650ms both" }}
          />
        </span>
      </div>
    </div>
  );
}
