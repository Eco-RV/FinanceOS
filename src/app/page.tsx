import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, CircleCheck, CreditCard, Landmark, ShieldCheck } from "lucide-react";
import { getUser } from "@/lib/auth";
import { AppBackdrop } from "@/components/app-backdrop";
import { LogoMark } from "@/components/brand-logo";
import { buttonVariants } from "@/components/ui/button";
import { FOCUS_OUTLINE } from "@/lib/interactive";
import { cn } from "@/lib/utils";

const rise = (i: number) => ({ "--rise-i": i }) as CSSProperties;

const STEPS = [
  {
    icon: CreditCard,
    title: "Agrega tu tarjeta",
    text: "El día de corte, el día de pago y el saldo de hoy.",
    mock: (
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Visa Platinum</p>
          <p className="text-xs text-muted-foreground">Corte día 18 · pago día 3</p>
        </div>
        <span className="h-6 w-9 rounded-md bg-gradient-to-br from-amber-300 to-amber-500" aria-hidden />
      </div>
    ),
  },
  {
    icon: Landmark,
    title: "Agrega la cuenta con la que pagas",
    text: "Tu cuenta de débito o de ahorro, con su saldo.",
    mock: (
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Cuenta de ahorro</p>
        <p className="text-sm font-semibold tabular-nums">₡450 000</p>
      </div>
    ),
  },
  {
    icon: CalendarClock,
    title: "Mira cuánto pagar y si te alcanza",
    text: "El monto de contado, la fecha límite y si tu cuenta cubre los pagos que vienen.",
    mock: (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">A pagar de contado · en 5 días</p>
          <p className="text-sm font-semibold tabular-nums">₡228 880</p>
        </div>
        <p className="flex items-center gap-1.5 text-xs font-medium text-success">
          <CircleCheck className="size-3.5" /> Tu cuenta alcanza
        </p>
      </div>
    ),
  },
];

/**
 * 3.2.0 · Fase 2: página pública con la promesa de la app. Con sesión, va
 * directo al Resumen.
 */
export default async function Home() {
  if (await getUser()) redirect("/dashboard");

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBackdrop />

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2.5">
          <LogoMark className="size-7" />
          <span className="text-lg font-semibold tracking-tight">
            Finance<span className="text-muted-foreground"> OS</span>
          </span>
        </div>
        <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), FOCUS_OUTLINE)}>
          Entrar
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-4 pt-8 pb-16 sm:px-6 sm:pt-16">
        <section className="flex max-w-2xl flex-col gap-5">
          <h1 className="rise text-4xl leading-tight font-semibold tracking-tight sm:text-5xl" style={rise(0)}>
            No vuelvas a pagar intereses en tus tarjetas.
          </h1>
          <p className="rise text-lg text-muted-foreground" style={rise(1)}>
            Finance OS te dice cuánto pagar de contado, para cuándo y si tu cuenta alcanza. En español y pensado
            para las tarjetas de Costa Rica, en colones y dólares.
          </p>
          <div className="rise flex flex-wrap gap-3" style={rise(2)}>
            <Link href="/login?modo=crear" className={cn(buttonVariants({ size: "lg" }), FOCUS_OUTLINE)}>
              Crear cuenta
            </Link>
            <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "lg" }), FOCUS_OUTLINE)}>
              Ya tengo cuenta
            </Link>
          </div>
        </section>

        <section className="flex flex-col gap-5" aria-labelledby="como-funciona">
          <h2 id="como-funciona" className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Cómo funciona
          </h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text, mock }, i) => (
              <li key={title} className="surface rise flex flex-col gap-4 p-5" style={rise(i + 3)}>
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-[18px]" />
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">Paso {i + 1}</span>
                </div>
                <div>
                  <h3 className="font-semibold tracking-tight">{title}</h3>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </div>
                <div className="mt-auto rounded-xl bg-muted/60 p-3">{mock}</div>
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted-foreground">
            Y cuando lo necesites: tu salario y gastos fijos, metas de ahorro, préstamos, compras a cuotas y gastos
            compartidos. Se activan en el camino, sin llenar la pantalla desde el día 1.
          </p>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-8 text-xs text-muted-foreground sm:px-6">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="size-3.5" /> Privado: cada usuario ve solo sus datos.
        </span>
        <Link href="/privacidad" className={cn("underline-offset-2 hover:underline", FOCUS_OUTLINE)}>
          Política de privacidad
        </Link>
      </footer>
    </div>
  );
}
