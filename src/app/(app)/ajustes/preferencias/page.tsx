import type { ComponentType, ReactNode } from "react";
import { CalendarDays, Coins, DollarSign, Landmark, Palette, Tags } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { BackLink } from "@/components/back-link";
import { Badge } from "@/components/ui/badge";
import { NavCard, NavCardDisabled } from "@/components/nav-card";
import { ThemeChoicePicker } from "./theme-choice";

type IconType = ComponentType<{ className?: string }>;

/** Configuraciones que ya existen en la app y viven en su propia pantalla. */
const APP_SETTINGS: { href: string; label: string; description: string; icon: IconType }[] = [
  { href: "/ajustes/categorias", label: "Categorías", description: "Las de gastos e ingresos, con su ícono.", icon: Tags },
  { href: "/ajustes/tipo-cambio", label: "Tipo de cambio", description: "Colones por dólar para tarjetas bimoneda.", icon: DollarSign },
  { href: "/ajustes/bancos", label: "Bancos", description: "Correos de compras con tarjeta.", icon: Landmark },
];

/** Lo que viene: el lugar ya existe para sumarlas sin cambiar la pantalla. */
const COMING: { label: string; description: string; icon: IconType }[] = [
  { label: "Moneda base", description: "Colones hoy; elegir otra para el Resumen.", icon: Coins },
  { label: "Formato de fecha", description: "Cómo se muestran las fechas.", icon: CalendarDays },
];

/** Preferencias de la app (2.6.0). */
export default async function PreferenciasPage() {
  await requireUser();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/ajustes" label="Ajustes" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Preferencias</h1>
        <p className="text-sm text-muted-foreground">Cómo se ve y se comporta Finance OS.</p>
      </div>

      <Section icon={Palette} title="Apariencia" description="Se guarda en este dispositivo.">
        <ThemeChoicePicker />
      </Section>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Datos de la app</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {APP_SETTINGS.map((s) => (
            <NavCard key={s.href} href={s.href} icon={s.icon} label={s.label} description={s.description} />
          ))}
          {COMING.map((s) => (
            <NavCardDisabled
              key={s.label}
              icon={s.icon}
              label={s.label}
              description={s.description}
              badge={<Badge variant="secondary">Próximamente</Badge>}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: IconType;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="surface flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground/80">
          <Icon className="size-[18px]" />
        </span>
        <div>
          <h2 className="font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
