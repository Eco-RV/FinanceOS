import type { CSSProperties } from "react";

/**
 * Fondo de la app (2.5.0): una cuadrícula tenue que se desvanece hacia los
 * bordes y bloques redondeados que flotan despacio, en el tono del tema. Es
 * decorativo (`aria-hidden`, sin eventos) y con "reducir movimiento" queda
 * quieto.
 */

type Block = {
  top: string;
  left: string;
  size: number;
  r: number;
  dx: number;
  dy: number;
  duration: number;
  delay: number;
};

// Posiciones fijas (no aleatorias) para que servidor y cliente coincidan.
const BLOCKS: Block[] = [
  { top: "8%", left: "6%", size: 56, r: 8, dx: 14, dy: -26, duration: 18, delay: 0 },
  { top: "18%", left: "82%", size: 88, r: -10, dx: -18, dy: 22, duration: 24, delay: -6 },
  { top: "46%", left: "92%", size: 40, r: 14, dx: -10, dy: -18, duration: 16, delay: -3 },
  { top: "62%", left: "4%", size: 72, r: -6, dx: 16, dy: 20, duration: 22, delay: -9 },
  { top: "78%", left: "70%", size: 52, r: 4, dx: -14, dy: -20, duration: 20, delay: -12 },
  { top: "34%", left: "38%", size: 28, r: 20, dx: 10, dy: 14, duration: 14, delay: -4 },
  { top: "88%", left: "26%", size: 36, r: -16, dx: 12, dy: -16, duration: 17, delay: -7 },
  { top: "4%", left: "54%", size: 32, r: 10, dx: -8, dy: 18, duration: 19, delay: -2 },
];

export function AppBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(var(--backdrop-grid) 1px, transparent 1px), linear-gradient(90deg, var(--backdrop-grid) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, black 30%, transparent 75%)",
        }}
      />
      {BLOCKS.map((b, i) => (
        <span
          key={i}
          data-motion
          className="absolute rounded-[28%] border border-foreground/[0.06] bg-[var(--backdrop-block)]"
          style={
            {
              top: b.top,
              left: b.left,
              width: b.size,
              height: b.size,
              "--r": `${b.r}deg`,
              "--dx": `${b.dx}px`,
              "--dy": `${b.dy}px`,
              animation: `float-block ${b.duration}s ease-in-out ${b.delay}s infinite, block-pulse ${b.duration / 2}s ease-in-out ${b.delay}s infinite`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
