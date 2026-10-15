"use client";

import { useActionState, useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { FormResult } from "@/lib/forms";
import { PasswordInput } from "@/app/login/login-form";
import { resetPassword } from "./actions";

export function ResetForm() {
  const [state, action, pending] = useActionState<FormResult, FormData>(resetPassword, undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const rules = [
    { ok: password.length >= 8, label: "8 caracteres o más" },
    { ok: /[A-Za-z]/.test(password), label: "Letras" },
    { ok: /\d/.test(password), label: "Números" },
  ];
  const errors = state && !state.ok ? state.errors : undefined;
  const message = state && !state.ok ? state.message : undefined;
  const mismatch = confirm.length > 0 && confirm !== password;

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Contraseña nueva</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
        />
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
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
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirm">Repite la contraseña</Label>
        <PasswordInput
          id="confirm"
          name="confirm"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          invalid={mismatch || Boolean(errors?.confirm)}
        />
        {mismatch || errors?.confirm ? (
          <p className="text-xs text-destructive">{errors?.confirm ?? "Las contraseñas no coinciden"}</p>
        ) : null}
      </div>
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
        {pending ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
