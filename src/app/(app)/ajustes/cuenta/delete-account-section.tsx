"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/app/login/login-form";
import { deleteAccountAction } from "./actions";

/**
 * U8 (3.0.1): borrar la cuenta. Va al final, separado del resto, y pide
 * escribir ELIMINAR y la contraseña: no se puede deshacer.
 */
export function DeleteAccountSection() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-destructive/30 p-4 sm:p-6">
      <div>
        <h2 className="flex items-center gap-2 font-semibold text-destructive">
          <TriangleAlert className="size-4" /> Borrar la cuenta
        </h2>
        <p className="text-sm text-muted-foreground">
          Se borran tu perfil, cuentas, tarjetas, movimientos, planes, metas, compartidos, fotos y
          comprobantes. No se puede deshacer. Lo que está en Stellar (tu wallet) no se toca.
        </p>
      </div>
      <form
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setError(null);
          start(async () => {
            const r = await deleteAccountAction(fd);
            if (r && !r.ok) setError(r.message ?? "No se pudo borrar la cuenta");
          });
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delete-confirm">Escribe ELIMINAR</Label>
          <Input id="delete-confirm" name="confirmation" autoComplete="off" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delete-password">Tu contraseña</Label>
          <PasswordInput id="delete-password" name="password" autoComplete="current-password" />
        </div>
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : null} Borrar todo
        </Button>
      </form>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
