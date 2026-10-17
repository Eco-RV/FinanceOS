"use client";

import { useState, type ReactNode } from "react";
import { KeyRound, LogOut, Mail, Puzzle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { isCavosConfigured } from "@/lib/stellar/env";
import { shortAddress } from "@/lib/stellar/format";
import { useCavosState, useWallet } from "./wallet-context";

/** Única página desde la que se entra con Cavos (ver `signInHere`). */
export const WALLET_SIGN_IN_PATH = "/trading";

/**
 * Pide conectar una wallet antes de mostrar `children` (K1: testnet). Opción
 * principal: correo o Google con Cavos, sin instalar nada (D12).
 *
 * `signInHere`: el modal de @cavos/kit 0.4.2 manda la página actual (origen +
 * ruta) como redirect de Google, y Cavos exige esa URL exacta en sus Callback
 * URLs. Para registrar una sola, solo el hub (`/trading`) inicia sesión; las
 * demás páginas mandan ahí.
 */
export function WalletGate({
  children,
  signInHere = false,
}: {
  children: ReactNode;
  signInHere?: boolean;
}) {
  const { address, isPending, connectExtension } = useWallet();
  const cavos = useCavosState();
  const [error, setError] = useState<string | null>(null);

  if (address) return children;

  if (!signInHere && !cavos?.needsDeviceApproval) {
    return (
      <Card>
        <ShieldCheck className="size-8 text-violet-500" />
        <h2 className="text-lg font-semibold">Primero conecta tu wallet</h2>
        <p className="text-sm text-muted-foreground">
          Entra con tu correo o Google, o con una wallet de extensión, desde la pestaña
          Constelación.
        </p>
        <Link href={WALLET_SIGN_IN_PATH} className={buttonVariants({ size: "lg" })}>
          Ir a conectar mi wallet
        </Link>
      </Card>
    );
  }

  if (cavos?.needsDeviceApproval) {
    return (
      <Card>
        <KeyRound className="size-8 text-violet-500" />
        <h2 className="text-lg font-semibold">Desbloquea tu wallet en este dispositivo</h2>
        <p className="text-sm text-muted-foreground">
          Entraste con {cavos.email ?? "tu correo"} en un navegador nuevo. Usa la llave de acceso
          (passkey) que guardaste para abrir tu wallet aquí.
        </p>
        <Button size="lg" onClick={() => void cavos.approveDevice()}>
          Usar mi llave de acceso
        </Button>
        <Button variant="ghost" size="sm" onClick={cavos.signOut}>
          <LogOut className="size-4" /> Salir
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <ShieldCheck className="size-8 text-violet-500" />
      <h2 className="text-lg font-semibold">Conecta tu wallet</h2>
      <p className="text-sm text-muted-foreground">
        Tu wallet es tu bolsillo de dólares digitales en Stellar. Solo tú la controlas: Finance OS
        nunca ve tus llaves. Esto es una red de prueba (testnet): el dinero no es real.
      </p>
      {isCavosConfigured ? (
        <Button
          size="lg"
          className="h-12 w-full text-base"
          disabled={isPending || cavos?.isLoading}
          onClick={() => cavos?.signIn()}
        >
          <Mail className="size-5" /> Entrar con correo o Google
        </Button>
      ) : null}
      <Button
        size="lg"
        variant={isCavosConfigured ? "outline" : "default"}
        className="h-12 w-full text-base"
        onClick={() => {
          setError(null);
          connectExtension().catch(() => setError("No se conectó ninguna wallet."));
        }}
      >
        <Puzzle className="size-5" /> Usar una wallet de extensión
      </Button>
      {error || cavos?.error ? (
        <p className="text-sm text-destructive">{error ?? cavos?.error}</p>
      ) : null}
    </Card>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="surface rise mx-auto flex w-full max-w-md flex-col items-center gap-3 p-6 text-center">
      {children}
    </div>
  );
}

/** Barra con la wallet conectada: dirección corta y salir. */
export function WalletBar() {
  const { address, connector, disconnect } = useWallet();
  const cavos = useCavosState();
  if (!address) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>
        {connector === "cavos" && cavos?.email ? `${cavos.email} · ` : ""}
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{shortAddress(address)}</code>
      </span>
      <Button variant="ghost" size="sm" onClick={() => void disconnect()}>
        <LogOut className="size-4" /> Desconectar
      </Button>
    </div>
  );
}
