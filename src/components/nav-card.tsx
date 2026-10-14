import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { LinkChevron } from "@/components/link-pending";
import { FOCUS_OUTLINE, PRESSABLE_SURFACE } from "@/lib/interactive";
import { cn } from "@/lib/utils";

type IconType = ComponentType<{ className?: string }>;

const SURFACE =
  "surface flex h-full flex-col gap-2 p-4";

function Heading({
  icon: Icon,
  label,
  badge,
  trailing,
}: {
  icon?: IconType;
  label: string;
  badge?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      {Icon ? (
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground/80">
          <Icon className="size-[18px]" />
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate font-semibold tracking-tight">
        {label}
      </span>
      {badge}
      {trailing}
    </div>
  );
}

/**
 * Card que representa una navegación: toda la superficie es el enlace, con
 * hover (eleva), presión (se hunde), foco visible y spinner mientras carga.
 * Solo para cards sin acciones internas.
 */
export function NavCard({
  href,
  icon,
  label,
  description,
  badge,
}: {
  href: string;
  icon?: IconType;
  label: string;
  description: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        SURFACE,
        PRESSABLE_SURFACE,
        FOCUS_OUTLINE,
      )}
    >
      <Heading
        icon={icon}
        label={label}
        badge={badge}
        trailing={<LinkChevron />}
      />
      <p className="text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}

/** Variante no disponible (p. ej. "Próximamente"): misma forma, sin interacción. */
export function NavCardDisabled({
  icon,
  label,
  description,
  badge,
}: {
  icon?: IconType;
  label: string;
  description: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div
      aria-disabled="true"
      className={cn(
        SURFACE,
        "cursor-not-allowed border border-dashed border-foreground/15 bg-transparent opacity-75 shadow-none ring-0 dark:ring-0",
      )}
    >
      <Heading icon={icon} label={label} badge={badge} />
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
