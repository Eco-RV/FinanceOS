import { cn } from "@/lib/utils";

/**
 * Isotipo de Finance OS (2.5.0): bloques que suben en escalera, el mismo
 * lenguaje del fondo animado. Usa `currentColor`; el bloque de arriba es el
 * acento. `animated` los hace entrar uno por uno (bienvenida y login).
 */
export function LogoMark({
  className,
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  // [columna, fila] de abajo hacia arriba: 1, 2 y 3 bloques.
  const blocks: [number, number][] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 0],
    [2, 1],
    [2, 2],
  ];
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden className={className}>
      {blocks.map(([col, row], i) => {
        const top = row === 2 && col === 2;
        return (
          <rect
            key={i}
            x={3.5 + col * 9}
            y={21.5 - row * 9}
            width={7}
            height={7}
            rx={2}
            opacity={top ? 1 : 0.38 + row * 0.22}
            data-motion={animated ? "" : undefined}
            style={
              animated
                ? {
                    transformBox: "fill-box",
                    transformOrigin: "center",
                    animation: `pop-in 420ms var(--ease-spring) ${i * 70}ms both`,
                  }
                : undefined
            }
          />
        );
      })}
    </svg>
  );
}

/** Logo en su tile (barra superior, login, bienvenida). */
export function LogoTile({
  className,
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <span
      className={cn(
        "grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground shadow-xs",
        className,
      )}
    >
      <LogoMark animated={animated} className="size-[70%]" />
    </span>
  );
}
