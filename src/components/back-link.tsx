import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FOCUS_OUTLINE } from "@/lib/interactive";
import { cn } from "@/lib/utils";

/** Enlace de "regresar" para las sub-páginas (arriba a la izquierda). */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "group/back -ml-1.5 flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-sm text-muted-foreground transition-[color,opacity] duration-150 hover:text-foreground active:opacity-60",
        FOCUS_OUTLINE,
      )}
    >
      <ArrowLeft className="size-4 transition-[translate] duration-200 ease-fluid motion-safe:group-hover/back:-translate-x-0.5" />
      {label}
    </Link>
  );
}
