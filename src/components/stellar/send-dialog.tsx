"use client";

import { useState } from "react";
import { ArrowLeft, LoaderCircle, Send, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { celebrate } from "@/lib/celebrate";
import { formatStellarAmount, parseStellarAmount } from "@/domain";
import { explainStellarError, isAccountAddress, sendUsdc } from "@/infrastructure/stellar/horizon";
import { formatUsdc, shortAddress } from "@/lib/stellar/format";
import { useWallet } from "./wallet-context";

type Draft = { to: string; units: bigint; amount: number };

/**
 * Enviar USDC (pago directo, sin contrato). K8: siempre una pantalla de
 * revisión con destino, monto y "no se puede deshacer". K9: aviso destacado
 * si el destino no está en la constelación (desde 3.0.1, `knownAddresses` trae
 * las estrellas de la familia y de la agenda).
 */
export function SendDialog({ knownAddresses = [] }: { knownAddresses?: string[] }) {
  const { address, balances, signTransaction, updateBalances } = useWallet();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const available = Number(balances.usdc ?? 0);
  const disabled = !address || balances.usdc === null || available <= 0;

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setDraft(null);
      setError(null);
      setTo("");
      setAmount("");
    }
  }

  function review() {
    setError(null);
    const dest = to.trim();
    if (!isAccountAddress(dest)) return setError("Esa dirección no es válida (empieza con G y tiene 56 caracteres).");
    if (dest === address) return setError("No puedes enviarte a ti mismo.");
    let units: bigint;
    try {
      units = parseStellarAmount(amount);
    } catch (e) {
      return setError(e instanceof Error ? e.message : "Monto inválido");
    }
    const value = Number(formatStellarAmount(units));
    if (value > available) return setError(`No te alcanza: tienes ${formatUsdc(available)}.`);
    setDraft({ to: dest, units, amount: value });
  }

  async function confirm() {
    if (!address || !draft) return;
    setPending(true);
    setError(null);
    try {
      await sendUsdc(address, draft.to, formatStellarAmount(draft.units), signTransaction);
      await updateBalances();
      reset(false);
      celebrate("Envío completado", `${formatUsdc(draft.amount)} a ${shortAddress(draft.to)}`);
    } catch (e) {
      setError(explainStellarError(e));
    } finally {
      setPending(false);
    }
  }

  const unknown = draft ? !knownAddresses.includes(draft.to) : false;

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger render={<Button size="lg" className="h-12 flex-1" disabled={disabled} />}>
        <Send className="size-5" /> Enviar
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{draft ? "Revisa antes de enviar" : "Enviar USDC"}</DialogTitle>
          <DialogDescription>
            {draft ? "Un envío en la blockchain no se puede deshacer." : `Tienes ${formatUsdc(available)} disponibles.`}
          </DialogDescription>
        </DialogHeader>

        {draft ? (
          <div className="flex flex-col gap-3">
            <p className="text-lg">
              Vas a enviar <strong className="tabular-nums">{formatUsdc(draft.amount)}</strong> a{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-base">{shortAddress(draft.to, 6)}</code>.
            </p>
            <code className="rounded-lg bg-muted p-2 text-xs break-all">{draft.to}</code>
            {unknown ? (
              <div className="flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                <p>
                  <strong>Esta dirección no está en tu constelación.</strong> Revisa letra por letra con
                  quien te la dio. Nadie legítimo te apura ni te pide tus códigos.
                </p>
              </div>
            ) : null}
            <p className="text-sm font-medium text-destructive">No se puede deshacer.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <FormField label="Dirección de destino" htmlFor="send-to">
              <Input
                id="send-to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="G…"
                autoComplete="off"
                spellCheck={false}
                className="font-mono text-base"
              />
            </FormField>
            <FormField label="Monto en USDC" htmlFor="send-amount">
              <Input
                id="send-amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
                placeholder="0"
                className="text-base"
              />
            </FormField>
          </div>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter className="gap-2">
          {draft ? (
            <>
              <Button variant="outline" onClick={() => setDraft(null)} disabled={pending}>
                <ArrowLeft className="size-4" /> Corregir
              </Button>
              <Button onClick={() => void confirm()} disabled={pending}>
                {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                {pending ? "Firmando…" : "Sí, enviar"}
              </Button>
            </>
          ) : (
            <Button onClick={review} disabled={!to || !amount}>
              Revisar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
