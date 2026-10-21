import Link from "next/link";
import {
  DollarSign,
  Landmark,
  LayoutGrid,
  RotateCcw,
  Scale,
  SlidersHorizontal,
  Tags,
  UserRound,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";
import { requireUser } from "@/lib/auth";
import { initialsOf, isRouteVisible } from "@/domain";
import { getProfile } from "@/lib/preferences";
import { getEnabledFeatures } from "@/lib/features";
import { NavCard } from "@/components/nav-card";
import { Avatar } from "@/components/user-menu";
import { LinkChevron } from "@/components/link-pending";
import { FOCUS_OUTLINE, PRESSABLE_SURFACE } from "@/lib/interactive";
import { flagOf } from "@/lib/countries";
import { cn } from "@/lib/utils";

type IconType = ComponentType<{ className?: string }>;

const ACCOUNT: { href: string; label: string; description: string; icon: IconType }[] = [
  { href: "/ajustes/cuenta", label: "Mi cuenta", description: "Perfil, foto, correo y contraseña.", icon: UserRound },
  { href: "/ajustes/preferencias", label: "Preferencias", description: "Tema y configuraciones de la app.", icon: SlidersHorizontal },
];

const LINKS: { href: string; label: string; description: string; icon: IconType }[] = [
  { href: "/procesos/funciones", label: "Funciones", description: "Activa o apaga partes de la app.", icon: LayoutGrid },
  { href: "/ajustes/categorias", label: "Categorías", description: "Categorías de gastos e ingresos.", icon: Tags },
  { href: "/ajustes/bancos", label: "Bancos", description: "Correos de compras con tarjeta.", icon: Landmark },
  { href: "/ajustes/miembros", label: "Miembros", description: "Familia que paga parte de tus financiamientos.", icon: Users },
  { href: "/ajustes/saldos", label: "Verificar saldos", description: "Que cada saldo cuadre con sus movimientos.", icon: Scale },
  { href: "/ajustes/tipo-cambio", label: "Tipo de cambio", description: "Colones por dólar, para tarjetas bimoneda.", icon: DollarSign },
  { href: "/ajustes/arranque", label: "Arranque de 0", description: "Empezar de nuevo con saldos iniciales nuevos.", icon: RotateCcw },
];

export default async function AjustesPage() {
  const [user, profile, enabled] = await Promise.all([requireUser(), getProfile(), getEnabledFeatures()]);
  // 3.2.0 (E2): lo de una función apagada no se muestra (su URL sigue funcionando).
  const links = LINKS.filter((l) => isRouteVisible(enabled, l.href));
  const email = user.email ?? "";
  const name = profile?.full_name ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
        <p className="text-sm text-muted-foreground">Tu cuenta, tus preferencias y los datos de la app.</p>
      </div>

      {/* 2.6.0: tarjeta del perfil; abre Mi cuenta. */}
      <Link
        href="/ajustes/cuenta"
        className={cn("surface rise flex items-center gap-4 p-4 sm:p-5", PRESSABLE_SURFACE, FOCUS_OUTLINE)}
      >
        <Avatar
          account={{ avatarUrl: profile?.avatar_url ?? null, initials: initialsOf(name, email) }}
          className="size-14 text-lg"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold tracking-tight">{name ?? "Completa tu perfil"}</p>
          <p className="truncate text-sm text-muted-foreground">
            {[profile?.username ? `@${profile.username}` : null, email].filter(Boolean).join(" · ")}
            {profile?.country ? ` · ${flagOf(profile.country)}` : ""}
          </p>
        </div>
        <LinkChevron />
      </Link>

      <div className="grid gap-4 sm:grid-cols-2">
        {ACCOUNT.map(({ href, label, description, icon }) => (
          <NavCard key={href} href={href} icon={icon} label={label} description={description} />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Datos de la app</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {links.map(({ href, label, description, icon }) => (
            <NavCard key={href} href={href} icon={icon} label={label} description={description} />
          ))}
        </div>
      </div>
    </div>
  );
}
