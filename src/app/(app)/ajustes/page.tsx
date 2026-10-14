import { DollarSign, Landmark, LogOut, MonitorCog, RotateCcw, Scale, Tags, UserCog, Users } from "lucide-react";
import type { ComponentType } from "react";
import { requireUser } from "@/lib/auth";
import { signOutAction } from "@/lib/session-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NavCard, NavCardDisabled } from "@/components/nav-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type IconType = ComponentType<{ className?: string }>;

const LINKS: { href: string; label: string; description: string; icon: IconType }[] = [
  { href: "/ajustes/categorias", label: "Categorías", description: "Categorías de gastos e ingresos.", icon: Tags },
  { href: "/ajustes/bancos", label: "Bancos", description: "Correos de compras con tarjeta.", icon: Landmark },
  { href: "/ajustes/miembros", label: "Miembros", description: "Familia que paga parte de tus financiamientos.", icon: Users },
  { href: "/ajustes/saldos", label: "Verificar saldos", description: "Que cada saldo cuadre con sus movimientos.", icon: Scale },
  { href: "/ajustes/tipo-cambio", label: "Tipo de cambio", description: "Colones por dólar, para tarjetas bimoneda.", icon: DollarSign },
  { href: "/ajustes/arranque", label: "Arranque de 0", description: "Empezar de nuevo con saldos iniciales nuevos.", icon: RotateCcw },
];

const SOON: { title: string; description: string; icon: IconType }[] = [
  { title: "Cuenta", description: "Cambiar contraseña y correo.", icon: UserCog },
  { title: "App", description: "Moneda base y formato de fecha.", icon: MonitorCog },
];

export default async function AjustesPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
        <p className="text-sm text-muted-foreground">
          Preferencias de tu cuenta y de la app.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sesión</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signOutAction}>
            <Button type="submit" variant="destructive" size="sm">
              <LogOut className="size-4" /> Cerrar sesión
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {LINKS.map(({ href, label, description, icon }) => (
          <NavCard
            key={href}
            href={href}
            icon={icon}
            label={label}
            description={description}
          />
        ))}

        {SOON.map(({ title, description, icon }) => (
          <NavCardDisabled
            key={title}
            icon={icon}
            label={title}
            description={description}
            badge={<Badge variant="secondary">Próximamente</Badge>}
          />
        ))}
      </div>
    </div>
  );
}
