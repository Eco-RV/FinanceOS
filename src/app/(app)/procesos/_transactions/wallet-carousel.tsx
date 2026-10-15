"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CreditCard } from "@/lib/types";
import { cn } from "@/lib/utils";
import { WalletCard } from "@/components/wallet-card";

/** Delta de rueda acumulado que equivale a pasar una tarjeta. */
const WHEEL_STEP = 40;

/**
 * Carrusel de tarjetas tipo billetera (2.5.0). Empieza en la primera tarjeta
 * (a la izquierda); se cambia con las flechas, tocando una tarjeta, con la
 * rueda del ratón (cursor encima) o deslizando con el dedo. La elegida queda
 * al centro; las demás se ven atenuadas y más pequeñas.
 */
export function WalletCarousel({
  cards,
  value,
  onChange,
}: {
  cards: CreditCard[];
  value: string;
  onChange: (cardId: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const settle = useRef<number | undefined>(undefined);
  const programmatic = useRef(false);

  // Las props más recientes, para el listener nativo de la rueda.
  const latest = useRef({ cards, value, onChange });
  useEffect(() => {
    latest.current = { cards, value, onChange };
  });

  const index = Math.max(0, cards.findIndex((c) => c.id === value));
  const go = (i: number) => {
    const next = cards[Math.max(0, Math.min(cards.length - 1, i))];
    if (next && next.id !== value) onChange(next.id);
  };

  // Lleva la elegida al centro (sin animar la primera vez).
  const first = useRef(true);
  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-card="${value}"]`);
    if (!el || !scroller.current) return;
    programmatic.current = true;
    const box = scroller.current;
    box.scrollTo({
      left: el.offsetLeft - (box.clientWidth - el.clientWidth) / 2,
      behavior: first.current ? "instant" : "smooth",
    });
    first.current = false;
    const t = window.setTimeout(() => (programmatic.current = false), 400);
    return () => window.clearTimeout(t);
  }, [value]);

  // Al deslizar con el dedo, queda elegida la tarjeta que se asienta al centro.
  function onScroll() {
    if (programmatic.current) return;
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const box = scroller.current;
      if (!box) return;
      const center = box.scrollLeft + box.clientWidth / 2;
      let best: { id: string; d: number } | null = null;
      for (const el of box.querySelectorAll<HTMLElement>("[data-card]")) {
        const d = Math.abs(el.offsetLeft + el.clientWidth / 2 - center);
        if (!best || d < best.d) best = { id: el.dataset.card!, d };
      }
      if (best && best.id !== value) onChange(best.id);
    }, 120);
  }

  // Rueda del ratón con el cursor encima: una tarjeta por "muesca". El
  // listener es nativo y no pasivo para que la rueda no mueva el diálogo.
  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    let acc = 0;
    let lock = 0;
    function onWheel(e: WheelEvent) {
      const { cards, value, onChange } = latest.current;
      if (cards.length < 2) return;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta === 0) return;
      e.preventDefault();
      if (Date.now() < lock) return;
      acc += delta;
      if (Math.abs(acc) < WHEEL_STEP) return;
      const i = cards.findIndex((c) => c.id === value);
      const next = cards[Math.max(0, Math.min(cards.length - 1, i + (acc > 0 ? 1 : -1)))];
      acc = 0;
      lock = Date.now() + 160;
      if (next && next.id !== value) onChange(next.id);
    }
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => box.removeEventListener("wheel", onWheel);
  }, []);

  const arrow =
    "absolute top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-popover/90 text-foreground shadow-md ring-1 ring-foreground/10 backdrop-blur transition-[opacity,scale,background-color] duration-150 ease-fluid hover:bg-popover motion-safe:active:scale-90 disabled:pointer-events-none disabled:opacity-0";

  return (
    <div className="relative">
      <div
        ref={scroller}
        onScroll={onScroll}
        role="radiogroup"
        aria-label="Tarjeta"
        className="no-scrollbar -mx-4 flex w-[calc(100%+2rem)] snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-[calc(50%-7.5rem)] py-3 lg:mx-0 lg:w-full"
      >
        {cards.map((card) => {
          const selected = card.id === value;
          return (
            <button
              key={card.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={card.name}
              data-card={card.id}
              onClick={() => onChange(card.id)}
              className={cn(
                "w-60 shrink-0 snap-center rounded-2xl transition-[opacity,scale,translate,filter] duration-300 ease-fluid outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                selected
                  ? "scale-100 opacity-100 motion-safe:-translate-y-1"
                  : "scale-[0.92] opacity-55 saturate-[0.7] hover:opacity-80",
              )}
            >
              <WalletCard card={card} selected={selected} />
            </button>
          );
        })}
      </div>

      {cards.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Tarjeta anterior"
            disabled={index === 0}
            onClick={() => go(index - 1)}
            className={cn(arrow, "left-0")}
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Tarjeta siguiente"
            disabled={index === cards.length - 1}
            onClick={() => go(index + 1)}
            className={cn(arrow, "right-0")}
          >
            <ChevronRight className="size-5" />
          </button>
          <div className="mt-1 flex justify-center gap-1.5" aria-hidden>
            {cards.map((c, i) => (
              <span
                key={c.id}
                className={cn(
                  "h-1.5 rounded-full transition-[width,background-color] duration-200 ease-fluid",
                  i === index ? "w-4 bg-foreground/70" : "w-1.5 bg-foreground/20",
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
