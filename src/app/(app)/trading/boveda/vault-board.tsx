"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, Check, LoaderCircle, Target, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FormField, Select } from "@/components/form-field";
import { celebrate } from "@/lib/celebrate";
import { formatCurrency } from "@/lib/format";
import { useFormatDate } from "@/components/date-format";
import {
  approvalBlocker,
  assertCanDeposit,
  assertCanRequestWithdrawal,
  canCancelWithdrawal,
  displayStellarBalance,
  formatStellarAmount,
  isCore,
  isGuardian,
  parseStellarAmount,
  requiredApprovals,
  vaultProgress,
  WITHDRAWAL_TTL_SECONDS,
  type FamilyView,
} from "@/domain";
import type { StarLabel } from "@/application";
import { formatUsdc, shortAddress } from "@/lib/stellar/format";
import { useWallet } from "@/components/stellar/wallet-context";
import { useFamilyWrite, useMyFamily } from "@/components/stellar/use-family";
import type { ExchangeRateView } from "@/components/stellar/pocket";

const usdc = (units: bigint) => displayStellarBalance(formatStellarAmount(units));

export function VaultBoard({ stars, rate }: { stars: StarLabel[]; rate: ExchangeRateView }) {
  const formatDate = useFormatDate();
  const { address, balances } = useWallet();
  const { state, refresh } = useMyFamily();
  const { run, pending, needsApprovalModal } = useFamilyWrite();
  const labels = useMemo(() => new Map(stars.map((s) => [s.address, s])), [stars]);
  const [now] = useState(() => Math.floor(Date.now() / 1000));

  if (!address) return null;
  if (state.status === "loading") return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (state.status === "error") return <p className="text-sm text-destructive">{state.message}</p>;
  if (state.status === "none") {
    return (
      <div className="surface flex flex-col items-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">La bóveda es de una familia. Primero crea la tuya o acepta una invitación.</p>
        <Link href="/trading/familia" className={buttonVariants()}>
          Ir a Mi familia
        </Link>
      </div>
    );
  }

  const { family, contributions, pending: withdrawals } = state.snapshot;
  const progress = vaultProgress(family);
  const balance = usdc(family.balance);
  const nameOf = (a: string) =>
    a === address ? "Tú" : (labels.get(a) ? `${labels.get(a)!.emoji ?? ""} ${labels.get(a)!.nickname}`.trim() : shortAddress(a));
  const meGuardian = isGuardian(family, address);

  async function act(label: string, fn: Parameters<typeof run>[1], ok: string, detail?: string) {
    const r = await run(label, fn);
    if (!r.ok) {
      toast.error(r.message);
      return false;
    }
    if (detail) celebrate(ok, detail);
    else toast.success(ok);
    refresh();
    return true;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="surface rise flex flex-col gap-4 p-5">
        <div>
          <p className="text-sm text-muted-foreground">En la bóveda</p>
          <p className="text-4xl font-semibold tracking-tight tabular-nums">{formatUsdc(balance)}</p>
          {rate ? (
            <p className="text-sm text-muted-foreground tabular-nums">
              ≈ {formatCurrency(Math.trunc(balance * rate.usd_crc * 100) / 100, "CRC")}
            </p>
          ) : null}
        </div>
        {progress !== null ? (
          <div className="flex flex-col gap-1">
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-amber-400" style={{ width: `${progress * 100}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.round(progress * 100)} % de la meta de {formatUsdc(usdc(family.goal))}
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sin meta todavía.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <AmountDialog
            title="Depositar en la bóveda"
            trigger={<><ArrowDownToLine className="size-4" /> Depositar</>}
            hint={`Tienes ${formatUsdc(displayStellarBalance(balances.usdc))} en tu bolsillo.`}
            confirmText={(v) => `Vas a depositar ${formatUsdc(v)} en la bóveda familiar. Para sacarlo hará falta aprobación.`}
            pending={pending === "deposit"}
            approvalNote={needsApprovalModal}
            validate={(units) => {
              assertCanDeposit(family, address, units);
              if (usdc(units) > Number(balances.usdc ?? 0)) throw new Error("No te alcanza el saldo de tu bolsillo");
            }}
            onConfirm={(units) =>
              act("deposit", (c, me) => c.deposit({ from: me, family_id: family.id, amount: units }), "Depósito hecho", formatUsdc(usdc(units)))
            }
          />
          <WithdrawDialog
            family={family}
            me={address}
            nameOf={nameOf}
            pendingCount={withdrawals.length}
            pending={pending === "withdraw"}
            approvalNote={needsApprovalModal}
            onConfirm={(to, units) =>
              act(
                "withdraw",
                (c, me) => c.request_withdrawal({ member: me, family_id: family.id, to, amount: units }),
                requiredApprovals(family, address) === 0 ? "Retiro hecho" : "Retiro pedido: falta la aprobación",
              )
            }
          />
          {meGuardian ? (
            <AmountDialog
              title="Meta de la bóveda"
              trigger={<><Target className="size-4" /> Meta</>}
              variant="ghost"
              hint="¿Cuánto quieren juntar entre todos?"
              confirmText={(v) => `La meta de la bóveda pasa a ${formatUsdc(v)}.`}
              pending={pending === "goal"}
              approvalNote={needsApprovalModal}
              validate={() => undefined}
              onConfirm={(units) =>
                act("goal", (c, me) => c.set_goal({ guardian: me, family_id: family.id, goal: units }), "Meta guardada")
              }
            />
          ) : null}
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Retiros pendientes</h2>
        {withdrawals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay retiros por aprobar.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {withdrawals.map((w) => {
              const blocker = approvalBlocker(family, w, address, now);
              const expires = new Date((w.createdAt + WITHDRAWAL_TTL_SECONDS) * 1000);
              return (
                <li key={w.id} className="surface flex flex-wrap items-center gap-3 p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {formatUsdc(usdc(w.amount))} para {nameOf(w.to)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Pidió {nameOf(w.requestedBy)} · {w.approvals.length}/{w.required} aprobaciones · vence el{" "}
                      {formatDate(expires.toISOString().slice(0, 10))}
                    </p>
                  </div>
                  {blocker === null ? (
                    <Button
                      size="sm"
                      disabled={pending !== null}
                      onClick={() =>
                        act("approve", (c, me) => c.approve_withdrawal({ guardian: me, withdrawal_id: w.id }), "Retiro aprobado")
                      }
                    >
                      {pending === "approve" ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
                      Aprobar
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">{blocker}</span>
                  )}
                  {canCancelWithdrawal(family, w, address) ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Cancelar retiro"
                      disabled={pending !== null}
                      onClick={() =>
                        act("cancel", (c, me) => c.cancel_withdrawal({ caller: me, withdrawal_id: w.id }), "Retiro cancelado")
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Aportes</h2>
        <ul className="surface divide-y">
          {family.stars.map((s) => (
            <li key={s.address} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span className="truncate">{nameOf(s.address)}</span>
              <span className="tabular-nums">{formatUsdc(usdc(contributions[s.address] ?? BigInt(0)))}</span>
            </li>
          ))}
        </ul>
        {isCore(family, address) ? (
          <ApprovalsSetting
            current={family.approvalsNeeded}
            pending={pending === "approvals"}
            onSave={(n) =>
              act("approvals", (c, me) => c.set_approvals({ core: me, family_id: family.id, approvals_needed: n }), "Aprobaciones actualizadas")
            }
          />
        ) : null}
      </section>
    </div>
  );
}

/** Monto con revisión antes de firmar (K8). */
function AmountDialog({
  title,
  trigger,
  hint,
  confirmText,
  validate,
  onConfirm,
  pending,
  approvalNote,
  variant = "default",
  children,
}: {
  children?: React.ReactNode;
  title: string;
  trigger: React.ReactNode;
  hint: string;
  confirmText: (value: number) => string;
  validate: (units: bigint) => void;
  onConfirm: (units: bigint) => Promise<boolean>;
  pending: boolean;
  approvalNote: boolean;
  variant?: "default" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [units, setUnits] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setAmount("");
          setUnits(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger render={<Button variant={variant} />}>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{units !== null ? "Revisa antes de firmar" : title}</DialogTitle>
          <DialogDescription>{units !== null ? "Queda en la blockchain." : hint}</DialogDescription>
        </DialogHeader>
        {units !== null ? (
          <p className="text-base">{confirmText(usdc(units))}</p>
        ) : (
          <>
          {children}
          <FormField label="Monto en USDC" htmlFor="vault-amount">
            <Input
              id="vault-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
              className="text-base"
            />
          </FormField>
          </>
        )}
        {approvalNote && units !== null ? (
          <p className="text-xs text-muted-foreground">Aparecerá una ventana de tu wallet para confirmar.</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter className="gap-2">
          {units !== null ? (
            <>
              <Button variant="outline" onClick={() => setUnits(null)} disabled={pending}>
                Corregir
              </Button>
              <Button
                disabled={pending}
                onClick={async () => {
                  if (await onConfirm(units)) setOpen(false);
                }}
              >
                {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
                Sí, firmar
              </Button>
            </>
          ) : (
            <Button
              disabled={!amount}
              onClick={() => {
                setError(null);
                try {
                  const u = parseStellarAmount(amount);
                  validate(u);
                  setUnits(u);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Monto inválido");
                }
              }}
            >
              Revisar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WithdrawDialog({
  family,
  me,
  nameOf,
  pendingCount,
  pending,
  approvalNote,
  onConfirm,
}: {
  family: FamilyView;
  me: string;
  nameOf: (address: string) => string;
  pendingCount: number;
  pending: boolean;
  approvalNote: boolean;
  onConfirm: (to: string, units: bigint) => Promise<boolean>;
}) {
  const [to, setTo] = useState(me);
  const required = requiredApprovals(family, me);
  return (
    <AmountDialog
      title="Pedir un retiro"
      variant="ghost"
      trigger={<><ArrowUpFromLine className="size-4" /> Pedir retiro</>}
      hint={
        required === 0
          ? "Eres el único guardián: el retiro se hace en el acto."
          : `Lo tiene que aprobar ${required === 1 ? "otro guardián" : `${required} guardianes`}. Vence en 7 días.`
      }
      confirmText={(v) =>
        `Vas a pedir ${formatUsdc(v)} de la bóveda para ${nameOf(to)}.${required === 0 ? " Se envía en el acto." : " Queda pendiente de aprobación."}`
      }
      pending={pending}
      approvalNote={approvalNote}
      validate={(units) => assertCanRequestWithdrawal(family, { requester: me, to, amount: units, pending: pendingCount })}
      onConfirm={(units) => onConfirm(to, units)}
    >
      <FormField label="Para quién (solo la familia)" htmlFor="withdraw-to">
        <Select id="withdraw-to" value={to} onChange={(e) => setTo(e.target.value)}>
          {family.stars.map((s) => (
            <option key={s.address} value={s.address}>
              {nameOf(s.address)}
            </option>
          ))}
        </Select>
      </FormField>
    </AmountDialog>
  );
}

/** D5: aprobaciones que pide un retiro (solo el núcleo). */
function ApprovalsSetting({
  current,
  pending,
  onSave,
}: {
  current: number;
  pending: boolean;
  onSave: (n: number) => Promise<boolean>;
}) {
  const [value, setValue] = useState(String(current));
  return (
    <div className="flex flex-wrap items-end gap-2 text-sm">
      <FormField label="Aprobaciones por retiro (núcleo)" htmlFor="approvals">
        <Select id="approvals" value={value} onChange={(e) => setValue(e.target.value)}>
          {[1, 2, 3].map((n) => (
            <option key={n} value={String(n)}>
              {n}
            </option>
          ))}
        </Select>
      </FormField>
      <Button variant="outline" size="sm" disabled={pending || Number(value) === current} onClick={() => void onSave(Number(value))}>
        Guardar
      </Button>
    </div>
  );
}
