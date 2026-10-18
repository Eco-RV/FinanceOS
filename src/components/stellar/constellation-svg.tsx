"use client";

import { cn } from "@/lib/utils";

export type ConstellationStar = {
  address: string;
  label: string;
  /** 0.25..1 según lo que aportó a la bóveda. */
  brightness: number;
  isMe: boolean;
  isGuardian: boolean;
};

/**
 * La familia como constelación (3.0.0): "Tú" al centro, cada familiar una
 * estrella unida a ti (su brillo = lo que aportó) y la bóveda como planeta con
 * un anillo de progreso hacia la meta. SVG puro, sin librerías; respeta
 * "reducir movimiento" (las animaciones viven en CSS con `motion-safe`).
 */
export function ConstellationSvg({
  stars,
  progress,
  onSelect,
}: {
  stars: ConstellationStar[];
  /** Avance de la meta 0..1, o `null` sin meta. */
  progress: number | null;
  onSelect?: (address: string) => void;
}) {
  const W = 360;
  const H = 300;
  const cx = W / 2;
  const cy = 170;
  const me = stars.find((s) => s.isMe);
  const others = stars.filter((s) => !s.isMe);
  const radius = 108;
  const placed = others.map((s, i) => {
    // Repartidas en un arco inferior y laterales (deja arriba para la bóveda).
    const n = others.length;
    const start = Math.PI * 0.05;
    const end = Math.PI * 0.95;
    const angle = n === 1 ? Math.PI / 2 : start + ((end - start) * i) / (n - 1);
    const r = radius * (i % 2 === 0 ? 1 : 0.82);
    return { ...s, x: cx + Math.cos(angle + Math.PI) * -r, y: cy + Math.sin(angle) * r * 0.62 };
  });
  const ring = 2 * Math.PI * 30;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full max-w-md select-none"
      role="img"
      aria-label={`Constelación con ${stars.length} estrellas`}
    >
      <defs>
        <radialGradient id="star-glow">
          <stop offset="0%" stopColor="#FFD66B" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#FFD66B" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="planet" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#7B61FF" />
          <stop offset="100%" stopColor="#3DD6F5" />
        </linearGradient>
      </defs>

      {/* Bóveda: planeta con anillo de progreso */}
      <g transform={`translate(${cx} 48)`}>
        <circle r="30" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="5" />
        {progress !== null ? (
          <circle
            r="30"
            fill="none"
            stroke="#FFD66B"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${ring * progress} ${ring}`}
            transform="rotate(-90)"
          />
        ) : null}
        <circle r="20" fill="url(#planet)" />
        <text y="48" textAnchor="middle" className="fill-muted-foreground text-[10px]">
          {progress !== null ? `Bóveda · ${Math.round(progress * 100)} %` : "Bóveda"}
        </text>
      </g>

      {/* Líneas desde mí a cada estrella y a la bóveda */}
      <line x1={cx} y1={cy} x2={cx} y2={78} stroke="currentColor" strokeOpacity="0.2" strokeDasharray="3 4" />
      {placed.map((s) => (
        <line
          key={`l-${s.address}`}
          x1={cx}
          y1={cy}
          x2={s.x}
          y2={s.y}
          stroke="currentColor"
          strokeOpacity="0.25"
        />
      ))}

      {placed.map((s, i) => (
        <Star key={s.address} star={s} x={s.x} y={s.y} delay={i * 90} onSelect={onSelect} />
      ))}
      {me ? <Star star={me} x={cx} y={cy} delay={0} big onSelect={onSelect} /> : null}
    </svg>
  );
}

function Star({
  star,
  x,
  y,
  delay,
  big = false,
  onSelect,
}: {
  star: ConstellationStar;
  x: number;
  y: number;
  delay: number;
  big?: boolean;
  onSelect?: (address: string) => void;
}) {
  const r = (big ? 9 : 6) + star.brightness * (big ? 4 : 5);
  return (
    <g transform={`translate(${x} ${y})`}>
    <g
      className={cn("motion-safe:animate-[pop-in_0.5s_ease-out_both]", onSelect && "cursor-pointer")}
      style={{ animationDelay: `${delay}ms`, transformBox: "fill-box", transformOrigin: "center" }}
      onClick={onSelect ? () => onSelect(star.address) : undefined}
      role={onSelect ? "button" : undefined}
      aria-label={onSelect ? star.label : undefined}
    >
      <circle r={r * 2.4} fill="url(#star-glow)" opacity={0.35 + star.brightness * 0.5} />
      <path
        d={`M0 ${-r} L${r * 0.28} ${-r * 0.28} L${r} 0 L${r * 0.28} ${r * 0.28} L0 ${r} L${-r * 0.28} ${r * 0.28} L${-r} 0 L${-r * 0.28} ${-r * 0.28} Z`}
        fill={star.isGuardian ? "#FFD66B" : "#F5F1E3"}
        stroke="#B8860B"
        strokeOpacity="0.4"
      />
      <text y={r + 14} textAnchor="middle" className="fill-foreground text-[11px] font-medium">
        {star.label}
      </text>
    </g>
    </g>
  );
}
