"use client";

import { useRef, useState } from "react";
import { Check, KeyRound, LoaderCircle, Mail, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { PasswordInput } from "@/app/login/login-form";
import { useFormAction } from "@/lib/use-form-action";
import { cn } from "@/lib/utils";
import { changeEmailAction, changePasswordAction } from "./actions";

function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Mail;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-foreground/80">
        <Icon className="size-[18px]" />
      </span>
      <div>
        <h2 className="font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

/** U5: cambiar el correo (se confirma desde el correo nuevo). */
export function EmailSection({ email }: { email: string }) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const { submit, pending, errors } = useFormAction(changeEmailAction, "Revisa tu correo nuevo", () =>
    setSentTo(input.current?.value.trim().toLowerCase() ?? null),
  );

  return (
    <section className="surface flex flex-col gap-4 p-4 sm:p-6">
      <SectionTitle icon={Mail} title="Correo" description={`Actual: ${email}`} />
      {sentTo ? (
        <div className="flex items-start gap-3 rounded-xl bg-success/10 p-3 ring-1 ring-success/30">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-success" />
          <div className="text-sm">
            <p className="font-medium">Confirma el cambio desde tu correo</p>
            <p className="text-muted-foreground">
              Enviamos un enlace a <span className="font-medium text-foreground">{sentTo}</span>.
              Hasta que lo abras, sigues entrando con {email}. Según la configuración de Supabase,
              también puede llegar un aviso a tu correo actual.
            </p>
            <button
              type="button"
              className="mt-1 text-sm underline underline-offset-2"
              onClick={() => setSentTo(null)}
            >
              Usar otro correo
            </button>
          </div>
        </div>
      ) : (
        <form action={submit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1">
            <FormField label="Correo nuevo" htmlFor="new-email" error={errors?.email}>
              <Input
                ref={input}
                id="new-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
              />
            </FormField>
          </div>
          <Button type="submit" className="sm:mt-6" disabled={pending}>
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Cambiar correo
          </Button>
        </form>
      )}
    </section>
  );
}

/** U4: cambiar la contraseña (pide la actual). */
export function PasswordSection() {
  const form = useRef<HTMLFormElement>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [current, setCurrent] = useState("");
  const { submit, pending, errors } = useFormAction(changePasswordAction, "Contraseña actualizada", () => {
    setPassword("");
    setConfirm("");
    setCurrent("");
  });
  const rules = [
    { ok: password.length >= 8, label: "8 caracteres o más" },
    { ok: /[A-Za-z]/.test(password), label: "Letras" },
    { ok: /\d/.test(password), label: "Números" },
  ];
  const mismatch = confirm.length > 0 && confirm !== password;

  return (
    <section className="surface flex flex-col gap-4 p-4 sm:p-6">
      <SectionTitle
        icon={KeyRound}
        title="Contraseña"
        description="Para cambiarla, confirma primero la actual."
      />
      <form ref={form} action={submit} className="grid gap-4 sm:grid-cols-3">
        <FormField label="Contraseña actual" htmlFor="current" error={errors?.current}>
          <PasswordInput
            id="current"
            name="current"
            autoComplete="current-password"
            value={current}
            onChange={setCurrent}
            invalid={Boolean(errors?.current)}
          />
        </FormField>
        <FormField label="Contraseña nueva" htmlFor="password" error={errors?.password}>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            invalid={Boolean(errors?.password)}
          />
        </FormField>
        <FormField
          label="Repite la nueva"
          htmlFor="confirm"
          error={errors?.confirm ?? (mismatch ? "Las contraseñas no coinciden" : undefined)}
        >
          <PasswordInput
            id="confirm"
            name="confirm"
            autoComplete="new-password"
            value={confirm}
            onChange={setConfirm}
            invalid={mismatch || Boolean(errors?.confirm)}
          />
        </FormField>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs sm:col-span-2">
          {rules.map((r) => (
            <li
              key={r.label}
              className={cn("flex items-center gap-1", r.ok ? "text-success" : "text-muted-foreground")}
            >
              <Check className={cn("size-3.5", !r.ok && "opacity-40")} />
              {r.label}
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Cambiar contraseña
          </Button>
        </div>
      </form>
    </section>
  );
}
