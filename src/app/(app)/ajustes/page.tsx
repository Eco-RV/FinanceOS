import { LogOut } from "lucide-react";
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
  {
    title: "Parámetros",
    description: "Catálogo de categorías y cuentas por defecto.",
  },
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
