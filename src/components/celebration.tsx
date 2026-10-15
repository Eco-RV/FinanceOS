"use client";

import { useEffect, useRef, useState } from "react";
import { CELEBRATE_EVENT, type CelebrateDetail } from "@/lib/celebrate";

/**
 * Confirmación animada al centro de la pantalla (2.5.0): un check que se
 * dibuja con un anillo que se expande y el mensaje ("Gasto registrado").
 * Se monta una vez en el layout raíz y escucha `celebrate()`. No tapa el
 * botón flotante y se cierra solo (o al tocarla).
 */
export function Celebration() {
  const [shown, setShown] = useState<CelebrateDetail & { key: number } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    function clear() {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    }
    function onCelebrate(e: Event) {
      const detail = (e as CustomEvent<CelebrateDetail>).detail;
      clear();
      setLeaving(false);
      setShown({ ...detail, key: Date.now() });
      timers.current.push(window.setTimeout(() => setLeaving(true), 1500));
      timers.current.push(window.setTimeout(() => setShown(null), 1750));
    }
    window.addEventListener(CELEBRATE_EVENT, onCelebrate);
    return () => {
      clear();
      window.removeEventListener(CELEBRATE_EVENT, onCelebrate);
    };
  }, []);

  if (!shown) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={() => setShown(null)}
      className="fixed inset-0 z-[60] grid place-items-center p-6"
    >
      <div
        key={shown.key}
        className={
          "flex flex-col items-center gap-3 rounded-3xl bg-popover/95 px-10 py-8 text-popover-foreground shadow-2xl ring-1 ring-foreground/10 backdrop-blur-xl transition-[opacity,scale] duration-200 ease-fluid " +
          (leaving ? "scale-95 opacity-0" : "scale-100 opacity-100")
        }
        style={{ animation: "pop-in 380ms var(--ease-spring) both" }}
        data-motion
      >
        <span className="relative grid size-16 place-items-center">
          <span
            data-motion
            className="absolute inset-0 rounded-full bg-success/30"
            style={{ animation: "ring-out 900ms var(--ease-fluid) 120ms both" }}
          />
          <span className="relative grid size-16 place-items-center rounded-full bg-success text-white shadow-lg">
            <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path
                d="M5 12.5l4.5 4.5L19 7.5"
                strokeDasharray={24}
                strokeDashoffset={24}
                data-motion
                style={{ animation: "draw-check 420ms var(--ease-fluid) 180ms forwards" }}
              />
            </svg>
          </span>
        </span>
        <p className="text-base font-semibold tracking-tight">{shown.message}</p>
        {shown.detail ? (
          <p className="-mt-2 text-sm text-muted-foreground tabular-nums">{shown.detail}</p>
        ) : null}
      </div>
    </div>
  );
}
