import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { AppBackdrop } from "@/components/app-backdrop";
import { LogoTile } from "@/components/brand-logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetForm } from "./reset-form";

/**
 * Crear una contraseña nueva (2.6.0). Se llega desde el enlace de "¿la
 * olvidaste?", que abre una sesión de recuperación en `/auth/confirm`.
 */
export default async function RestablecerPage() {
  const user = await getUser();
  if (!user) redirect("/login?aviso=enlace-invalido");

  return (
    <div className="relative flex flex-1 items-center justify-center p-6">
      <AppBackdrop />
      <Card className="w-full max-w-sm bg-card/90 shadow-2xl backdrop-blur-xl [--card-spacing:--spacing(6)]">
        <CardHeader className="gap-1.5">
          <LogoTile className="mb-3 size-11 rounded-xl" />
          <CardTitle className="text-2xl">Contraseña nueva</CardTitle>
          <CardDescription>
            Para <span className="font-medium text-foreground">{user.email}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResetForm />
        </CardContent>
      </Card>
    </div>
  );
}
