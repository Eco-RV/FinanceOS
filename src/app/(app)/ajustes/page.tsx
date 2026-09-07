import Link from "next/link";
import { LogOut, Tags } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { signOutAction } from "@/lib/session-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const SOON: { title: string; description: string }[] = [
  { title: "Cuenta", description: "Cambiar contraseña y correo." },
  { title: "App", description: "Tema, moneda base y formato de fecha." },
];

export default async function AjustesPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Ajustes</h1>
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
        <Link
          href="/ajustes/categorias"
          className="rounded-xl transition-colors hover:bg-muted/40"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tags className="size-4 text-muted-foreground" />
                Categorías
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Categorías de gastos e ingresos.
            </CardContent>
          </Card>
        </Link>

        {SOON.map(({ title, description }) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                {title}
                <Badge variant="secondary">Próximamente</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {description}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
