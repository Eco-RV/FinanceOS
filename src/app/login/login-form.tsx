"use client";

import { useActionState, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoTile } from "@/components/brand-logo";
import { login, signUp, type AuthState } from "./actions";

type Mode = "login" | "signup";

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    mode === "login" ? login : signUp,
    undefined,
  );

  return (
    <Card className="w-full max-w-sm bg-card/90 shadow-2xl backdrop-blur-xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-98 motion-safe:duration-300 [--card-spacing:--spacing(6)]">
      <CardHeader className="gap-1.5">
        <LogoTile animated className="mb-3 size-11 rounded-xl" />
        <CardTitle className="text-2xl">
          {mode === "login" ? "Hola de nuevo" : "Crea tu cuenta"}
        </CardTitle>
        <CardDescription>
          {mode === "login"
            ? "Inicia sesión en Finance OS con tu correo."
            : "Empieza a ordenar tus finanzas en Finance OS."}
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={6}
              required
            />
          </div>

          {state?.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending
              ? "Un momento…"
              : mode === "login"
                ? "Entrar"
                : "Crear cuenta"}
          </Button>

          <button
            type="button"
            className="rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring active:opacity-70"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login"
              ? "¿No tienes cuenta? Regístrate"
              : "Ya tengo cuenta"}
          </button>
        </CardContent>
      </form>
    </Card>
  );
}
