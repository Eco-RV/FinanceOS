import Link from "next/link";
import { Compass } from "lucide-react";
import { LogoMark } from "@/components/brand-logo";
import { buttonVariants } from "@/components/ui/button";

/** 3.2.0 · Fase 4: página que no existe (o que no te corresponde ver). */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-5 px-4 py-16 text-center">
      <LogoMark className="size-8" />
      <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Compass className="size-6" />
      </span>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">No encontramos esta página</h1>
        <p className="text-sm text-muted-foreground">
          Puede que el enlace esté mal escrito o que la página ya no exista.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/dashboard" className={buttonVariants()}>
          Ir al Resumen
        </Link>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Inicio
        </Link>
      </div>
    </main>
  );
}
