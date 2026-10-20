import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Pasos de un flujo conectados por una línea (3.1.0, ley de conexión: los
 * pasos de un mismo flujo se ven unidos). El paso actual se resalta y los
 * anteriores llevan check; si `onStep` está, se puede volver a uno anterior.
 */
export function Stepper({
  steps,
  current,
  onStep,
}: {
  steps: string[];
  current: number;
  onStep?: (index: number) => void;
}) {
  return (
    <ol className="flex items-start" aria-label="Pasos">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const clickable = Boolean(onStep) && done;
        const Dot = clickable ? "button" : "span";
        return (
          <li key={label} className="relative flex flex-1 flex-col items-center gap-1.5">
            {i > 0 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute top-4 right-1/2 left-[-50%] h-0.5 -translate-y-1/2 rounded-full transition-colors duration-300",
                  i <= current ? "bg-foreground" : "bg-border",
                )}
              />
            ) : null}
            <Dot
              {...(clickable ? { type: "button" as const, onClick: () => onStep!(i) } : {})}
              aria-current={active ? "step" : undefined}
              className={cn(
                "relative z-10 grid size-8 place-items-center rounded-full text-sm font-semibold ring-4 ring-background transition-[background-color,color,scale] duration-200",
                done && "bg-foreground text-background",
                active && "bg-foreground text-background motion-safe:scale-110",
                !done && !active && "bg-muted text-muted-foreground",
                clickable && "cursor-pointer hover:opacity-90",
              )}
            >
              {done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
            </Dot>
            <span
              className={cn(
                "text-center text-xs",
                active ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
