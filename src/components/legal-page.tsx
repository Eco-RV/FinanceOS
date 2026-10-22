import type { ReactNode } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/brand-logo";

/**
 * 3.2.0 · Fase 4: marco común de Términos y Privacidad (páginas públicas).
 * Los textos son un borrador redactado para la salida a producción: los debe
 * revisar una persona antes de anunciar la app (ver docs/produccion/).
 */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-10 text-sm leading-relaxed [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_li]:ml-5 [&_li]:list-disc">
      <Link href="/" className="mb-2 flex w-fit items-center gap-2 font-semibold tracking-tight">
        <LogoMark className="size-6" /> Finance<span className="-ml-1 text-muted-foreground"> OS</span>
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">Última actualización: {updated}</p>
      {children}
      <p className="mt-6 flex gap-4 text-muted-foreground">
        <Link href="/terminos" className="underline-offset-2 hover:underline">
          Términos de uso
        </Link>
        <Link href="/privacidad" className="underline-offset-2 hover:underline">
          Política de privacidad
        </Link>
      </p>
    </main>
  );
}
