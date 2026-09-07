import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Enlace de "regresar" para las sub-páginas (arriba a la izquierda). */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      {label}
    </Link>
  );
}
