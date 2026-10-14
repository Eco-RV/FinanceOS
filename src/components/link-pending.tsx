"use client";

import { useLinkStatus } from "next/link";
import { ChevronRight, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Chevron de un enlace-card que se vuelve spinner mientras la navegación está
 * pendiente. Debe renderizarse dentro del <Link>.
 */
export function LinkChevron({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return pending ? (
    <LoaderCircle
      aria-hidden
      className={cn("size-4 shrink-0 animate-spin text-muted-foreground", className)}
    />
  ) : (
    <ChevronRight
      aria-hidden
      className={cn(
        "size-4 shrink-0 text-muted-foreground/70 transition-[translate,color] duration-200 ease-fluid group-hover/link:text-foreground motion-safe:group-hover/link:translate-x-0.5",
        className,
      )}
    />
  );
}
