import { CandlestickChart, LineChart, NotebookPen, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { NavCardDisabled } from "@/components/nav-card";
import { Badge } from "@/components/ui/badge";

const PLANNED = [
  {
    icon: Wallet,
    label: "Portafolio",
    description: "Posiciones, costo promedio y valor de cada activo.",
  },
  {
    icon: NotebookPen,
    label: "Bitácora de operaciones",
    description: "Entradas y salidas con su resultado y notas.",
  },
  {
    icon: LineChart,
    label: "Rendimiento",
    description: "Ganancia o pérdida realizada y por realizar en el tiempo.",
  },
];

/** Trading (2.5.0, beta): la pestaña existe; el módulo se construye por pasos. */
export default async function TradingPage() {
  await requireUser();

  return (
    <div className="flex flex-col gap-8">
      <div className="rise flex flex-col items-start gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-violet-500/12 text-violet-600 dark:text-violet-400">
          <CandlestickChart className="size-6" />
        </span>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Trading</h1>
          <Badge className="bg-violet-500 text-white uppercase">beta</Badge>
        </div>
        <p className="max-w-prose text-sm text-muted-foreground">
          Este módulo está en construcción. Aquí vas a llevar tus inversiones
          aparte de las finanzas del día a día.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {PLANNED.map((item, i) => (
          <div key={item.label} className="rise" style={{ ["--rise-i" as string]: i + 1 }}>
            <NavCardDisabled
              icon={item.icon}
              label={item.label}
              description={item.description}
              badge={<Badge variant="secondary">Próximamente</Badge>}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
