"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  CircleCheck,
  Eye,
  EyeOff,
  LoaderCircle,
  MailCheck,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoTile } from "@/components/brand-logo";
import { cn } from "@/lib/utils";
import {
  login,
  requestPasswordReset,
  resendConfirmation,
  signUp,
  type AuthState,
} from "./actions";

type Mode = "login" | "signup" | "forgot";

/** Avisos que llegan por la URL (`/login?aviso=…`) desde la confirmación por correo. */
const NOTICES: Record<string, { tone: "ok" | "error"; text: string }> = {
  "correo-confirmado": {
    tone: "ok",
    text: "Tu correo quedó confirmado. Inicia sesión para entrar.",
  },
  "enlace-invalido": {
    tone: "error",
    text: "El enlace venció o ya se usó. Inicia sesión o pide uno nuevo.",
  },
  "contrasena-actualizada": {
    tone: "ok",
    text: "Tu contraseña se actualizó. Inicia sesión con la nueva.",
  },
};

const RESEND_SECONDS = 60;

export function LoginForm({ aviso, next }: { aviso?: string; next?: string }) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [loginState, loginAction, loginPending] = useActionState<AuthState, FormData>(login, undefined);
  const [signUpState, signUpAction, signUpPending] = useActionState<AuthState, FormData>(signUp, undefined);
  const [resetState, resetAction, resetPending] = useActionState<AuthState, FormData>(
    requestPasswordReset,
    undefined,
  );
  const [resendState, resendAction, resendPending] = useActionState<AuthState, FormData>(
    resendConfirmation,
    undefined,
  );
  // Vista "revisa tu correo": tras crear la cuenta o pedir el enlace (sale
  // del resultado de la acción) o al pedir reenviar desde el login (manual).
  const [manual, setManual] = useState<{ kind: "confirm" | "reset"; email: string } | null>(null);
  // Resultado que el usuario ya cerró ("usar otro correo" / "volver").
  const [dismissed, setDismissed] = useState<AuthState[]>([]);
  const fromSignUp =
    signUpState?.notice === "confirm-email" && signUpState.email && !dismissed.includes(signUpState)
      ? { kind: "confirm" as const, email: signUpState.email }
      : null;
  const fromReset =
    resetState?.notice === "reset-sent" && resetState.email && !dismissed.includes(resetState)
      ? { kind: "reset" as const, email: resetState.email }
      : null;
  const sentTo = manual ?? fromSignUp ?? fromReset;
  const closeSent = () => {
    setManual(null);
    setDismissed((d) => [...d, signUpState, resetState]);
  };

  const notice = aviso ? NOTICES[aviso] : undefined;

  if (sentTo) {
    return (
      <CheckEmail
        kind={sentTo.kind}
        email={sentTo.email}
        justSent={!manual}
        resendAction={resendAction}
        resendPending={resendPending}
        resendState={resendState}
        onBack={() => {
          closeSent();
          setMode("login");
        }}
        onOtherEmail={() => {
          closeSent();
          setMode(sentTo.kind === "confirm" ? "signup" : "forgot");
        }}
      />
    );
  }

  const state = mode === "login" ? loginState : mode === "signup" ? signUpState : resetState;

  return (
    <Shell>
      <CardHeader className="gap-1.5">
        <LogoTile animated className="mb-3 size-11 rounded-xl" />
        <CardTitle className="text-2xl">
          {mode === "login" ? "Hola de nuevo" : mode === "signup" ? "Crea tu cuenta" : "Recupera tu acceso"}
        </CardTitle>
        <CardDescription>
          {mode === "login"
            ? "Inicia sesión en Finance OS con tu correo."
            : mode === "signup"
              ? "Te enviaremos un correo para confirmar que es tuyo."
              : "Te enviaremos un enlace para crear una contraseña nueva."}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {mode !== "forgot" ? (
          <div role="tablist" aria-label="Acceso" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {(
              [
                ["login", "Iniciar sesión"],
                ["signup", "Crear cuenta"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={mode === key}
                onClick={() => setMode(key)}
                className={cn(
                  "h-8 rounded-lg text-sm transition-[background-color,color,box-shadow] duration-200 ease-fluid",
                  mode === key
                    ? "bg-card font-medium text-foreground shadow-sm dark:bg-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {notice && mode === "login" && !loginState ? (
          <Banner tone={notice.tone}>{notice.text}</Banner>
        ) : null}

        {mode === "login" ? (
          <form action={loginAction} className="flex flex-col gap-4">
            <input type="hidden" name="next" value={next ?? ""} />
            <EmailField value={email} onChange={setEmail} error={fieldError(loginState, "email")} />
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  ¿La olvidaste?
                </button>
              </div>
              <PasswordInput id="password" name="password" autoComplete="current-password" />
            </div>
            {loginState?.error ? (
              <Banner tone="error">
                {loginState.error}
                {loginState.unconfirmed && loginState.email ? (
                  <button
                    type="button"
                    className="ml-1 font-medium underline underline-offset-2"
                    onClick={() => setManual({ kind: "confirm", email: loginState.email! })}
                  >
                    Reenviar correo
                  </button>
                ) : null}
              </Banner>
            ) : null}
            <Submit pending={loginPending}>Entrar</Submit>
          </form>
        ) : mode === "signup" ? (
          <SignUpForm
            action={signUpAction}
            pending={signUpPending}
            state={signUpState}
            email={email}
            setEmail={setEmail}
          />
        ) : (
          <form action={resetAction} className="flex flex-col gap-4">
            <EmailField value={email} onChange={setEmail} error={fieldError(resetState, "email")} />
            {state?.error && !state.field ? <Banner tone="error">{state.error}</Banner> : null}
            <Submit pending={resetPending}>Enviar enlace</Submit>
            <BackButton onClick={() => setMode("login")}>Volver a iniciar sesión</BackButton>
          </form>
        )}
      </CardContent>
    </Shell>
  );
}

function SignUpForm({
  action,
  pending,
  state,
  email,
  setEmail,
}: {
  action: (fd: FormData) => void;
  pending: boolean;
  state: AuthState;
  email: string;
  setEmail: (v: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const rules = [
    { ok: password.length >= 8, label: "8 caracteres o más" },
    { ok: /[A-Za-z]/.test(password), label: "Letras" },
    { ok: /\d/.test(password), label: "Números" },
  ];
  const mismatch = confirm.length > 0 && confirm !== password;

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="full_name">
          Nombre <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input id="full_name" name="full_name" autoComplete="name" maxLength={80} />
      </div>
      <EmailField value={email} onChange={setEmail} error={fieldError(state, "email")} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-password">Contraseña</Label>
        <PasswordInput
          id="new-password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          invalid={Boolean(fieldError(state, "password"))}
        />
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {rules.map((r) => (
            <li
              key={r.label}
              className={cn(
                "flex items-center gap-1 transition-colors",
                r.ok ? "text-success" : "text-muted-foreground",
              )}
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
          invalid={mismatch || Boolean(fieldError(state, "confirm"))}
        />
        {mismatch ? <p className="text-xs text-destructive">Las contraseñas no coinciden</p> : null}
      </div>
      {state?.error ? <Banner tone="error">{state.error}</Banner> : null}
      <Submit pending={pending}>Crear cuenta</Submit>
    </form>
  );
}

/** "Revisa tu correo": tras registrarse o pedir el enlace de contraseña. */
function CheckEmail({
  kind,
  email,
  resendAction,
  resendPending,
  resendState,
  onBack,
  onOtherEmail,
  justSent,
}: {
  kind: "confirm" | "reset";
  email: string;
  /** Recién enviado: hay que esperar antes de reenviar. Desde el login, no. */
  justSent: boolean;
  resendAction: (fd: FormData) => void;
  resendPending: boolean;
  resendState: AuthState;
  onBack: () => void;
  onOtherEmail: () => void;
}) {
  // Espera entre reenvíos: cuenta desde que se abrió la vista o se reenvió.
  const [startedAt, setStartedAt] = useState(() => (justSent ? Date.now() : 0));
  const [now, setNow] = useState(() => Date.now());
  const wait = Math.max(0, RESEND_SECONDS - Math.floor((now - startedAt) / 1000));
  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [wait]);

  return (
    <Shell>
      <CardContent className="flex flex-col items-center gap-5 py-4 text-center">
        <span className="relative grid size-16 place-items-center">
          <span
            data-motion
            className="absolute inset-0 rounded-full bg-success/25"
            style={{ animation: "ring-out 1600ms var(--ease-fluid) 200ms infinite" }}
          />
          <span className="relative grid size-16 place-items-center rounded-full bg-success/15 text-success">
            <MailCheck className="size-8" />
          </span>
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Revisa tu correo</h1>
          <p className="text-sm text-muted-foreground">
            {kind === "reset"
              ? "Si existe una cuenta, enviamos un enlace a"
              : justSent
                ? "Tu cuenta se creó. Enviamos un enlace de confirmación a"
                : "Tu cuenta espera confirmación. El enlace se envió a"}
          </p>
          <p className="font-medium break-all">{email}</p>
          <p className="text-sm text-muted-foreground">
            {kind === "confirm"
              ? "Ábrelo para activar tu cuenta. Puede tardar un par de minutos; revisa también spam o promociones."
              : "Ábrelo para crear una contraseña nueva. Vence en una hora."}
          </p>
        </div>

        {kind === "confirm" ? (
          <form
            action={(fd) => {
              setStartedAt(Date.now());
              setNow(Date.now());
              resendAction(fd);
            }}
            className="w-full"
          >
            <input type="hidden" name="email" value={email} />
            <Button type="submit" variant="outline" className="w-full" disabled={wait > 0 || resendPending}>
              {resendPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : wait > 0 ? (
                `Reenviar en ${wait} s`
              ) : (
                "Reenviar correo"
              )}
            </Button>
          </form>
        ) : null}
        {resendState?.notice === "resent" ? <Banner tone="ok">Te reenviamos el correo.</Banner> : null}
        {resendState?.error ? <Banner tone="error">{resendState.error}</Banner> : null}

        <div className="flex w-full flex-col gap-2">
          <Button type="button" className="w-full" size="lg" onClick={onBack}>
            {kind === "confirm" ? "Ya lo confirmé, iniciar sesión" : "Volver a iniciar sesión"}
          </Button>
          <BackButton onClick={onOtherEmail}>Usar otro correo</BackButton>
        </div>
      </CardContent>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <Card className="w-full max-w-sm bg-card/90 shadow-2xl backdrop-blur-xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-98 motion-safe:duration-300 [--card-spacing:--spacing(6)]">
      {children}
    </Card>
  );
}

function EmailField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="email">Correo</Label>
      <Input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error) || undefined}
        required
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

/** Contraseña con botón para verla. */
export function PasswordInput({
  id,
  name,
  autoComplete,
  value,
  onChange,
  invalid,
}: {
  id: string;
  name: string;
  autoComplete: string;
  value?: string;
  onChange?: (v: string) => void;
  invalid?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        aria-invalid={invalid || undefined}
        className="pr-10"
        required
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function Submit({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
      {pending ? "Un momento…" : children}
    </Button>
  );
}

function BackButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground active:opacity-70"
    >
      <ArrowLeft className="size-4" />
      {children}
    </button>
  );
}

function Banner({ tone, children }: { tone: "ok" | "error"; children: ReactNode }) {
  const Icon = tone === "ok" ? CircleCheck : CircleAlert;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left text-sm",
        tone === "ok"
          ? "bg-success/10 text-foreground ring-1 ring-success/30"
          : "bg-destructive/8 text-foreground ring-1 ring-destructive/30",
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", tone === "ok" ? "text-success" : "text-destructive")} />
      <p>{children}</p>
    </div>
  );
}

function fieldError(state: AuthState, field: NonNullable<AuthState>["field"]): string | undefined {
  return state && state.field === field ? state.error : undefined;
}
