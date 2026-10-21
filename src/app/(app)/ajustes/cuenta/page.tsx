import { LogOut, ShieldCheck } from "lucide-react";
import { getAuthUser, requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { signOutAction } from "@/lib/session-actions";
import { getProfile } from "@/lib/preferences";
import { initialsOf } from "@/domain";
import { BackLink } from "@/components/back-link";
import { Button } from "@/components/ui/button";
import { ProfileSection } from "./profile-section";
import { EmailSection, PasswordSection } from "./security-section";
import { DeleteAccountSection } from "./delete-account-section";

/** Mi cuenta (2.6.0): perfil, foto, correo, contraseña y sesión. */
export default async function CuentaPage() {
  // La fecha de alta y el último ingreso no van en el token: aquí sí se consulta a
  // Auth. Si Auth no responde, la página sigue (sin esas fechas) en vez de sacarte.
  const [session, authUser, profile] = await Promise.all([requireUser(), getAuthUser(), getProfile()]);
  const email = session.email ?? authUser?.email ?? "";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/ajustes" label="Ajustes" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mi cuenta</h1>
        <p className="text-sm text-muted-foreground">Tu perfil, tu correo y tu contraseña.</p>
      </div>

      {profile === null ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Para guardar tu perfil falta correr el SQL de la versión 2.6.0 en Supabase
          (<code>supabase/Versionamiento/2.6.0/</code>). El correo y la contraseña ya se pueden cambiar.
        </p>
      ) : null}

      <ProfileSection
        email={email}
        profile={{
          full_name: profile?.full_name ?? null,
          username: profile?.username ?? null,
          country: profile?.country ?? null,
          avatar_url: profile?.avatar_url ?? null,
          initials: initialsOf(profile?.full_name, email),
        }}
      />
      <EmailSection email={email} />
      <PasswordSection />
      <DeleteAccountSection />

      <section className="surface flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground/80">
            <ShieldCheck className="size-[18px]" />
          </span>
          <div className="text-sm">
            <h2 className="text-base font-semibold tracking-tight">Sesión</h2>
            {authUser ? (
              <p className="text-muted-foreground">
                Cuenta creada el {formatDate(authUser.created_at.slice(0, 10))}
                {authUser.last_sign_in_at
                  ? ` · último ingreso el ${formatDate(authUser.last_sign_in_at.slice(0, 10))}`
                  : ""}
              </p>
            ) : (
              <p className="text-muted-foreground">Sesión iniciada como {email}.</p>
            )}
          </div>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" className="w-full sm:w-auto">
            <LogOut className="size-4" /> Cerrar sesión
          </Button>
        </form>
      </section>
    </div>
  );
}
