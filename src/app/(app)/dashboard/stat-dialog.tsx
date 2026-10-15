"use client";

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FOCUS_OUTLINE, PRESSABLE_SURFACE } from "@/lib/interactive";
import { cn } from "@/lib/utils";

export type StatTone = "default" | "positive" | "warning" | "negative";

const TONE_TEXT: Record<StatTone, string> = {
  default: "",
  positive: "text-success",
  warning: "text-warning",
  negative: "text-destructive",
};

/** Contenido de una card de estadística (título con ícono, valor y nota). */
export function StatBody({
  title,
  icon,
  value,
  hint,
  tone = "default",
  size = "md",
  trailing,
}: {
  title: string;
  icon?: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: StatTone;
  size?: "md" | "lg";
  trailing?: ReactNode;
}) {
  return (
    <>
      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        {icon}
        <span className="truncate">{title}</span>
        {trailing ? <span className="ml-auto">{trailing}</span> : null}
      </div>
      <p
        className={cn(
          "font-semibold tracking-tight tabular-nums",
          size === "lg" ? "text-4xl sm:text-5xl" : "text-2xl",
          TONE_TEXT[tone],
        )}
      >
        {value}
      </p>
      {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
    </>
  );
}

/**
 * Card de estadística del Resumen que abre un modal con su detalle (2.5.0):
 * toda la card es el botón; el detalle (`children`) lo arma el servidor.
 */
export function StatDialog({
  title,
  description,
  icon,
  value,
  hint,
  tone,
  size,
  className,
  style,
  children,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: StatTone;
  size?: "md" | "lg";
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger
        className={cn(
          "surface flex w-full flex-col gap-2 p-4 text-left sm:p-5",
          PRESSABLE_SURFACE,
          FOCUS_OUTLINE,
          className,
        )}
        style={style}
      >
        <StatBody
          title={title}
          icon={icon}
          value={value}
          hint={hint}
          tone={tone}
          size={size}
          trailing={
            <ChevronRight className="size-4 text-muted-foreground/60 transition-[translate] duration-200 ease-fluid motion-safe:group-hover/link:translate-x-0.5" />
          }
        />
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
