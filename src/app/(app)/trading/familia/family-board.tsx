"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Crown, LoaderCircle, LogOut, Pencil, Shield, Sparkles, UserMinus, UserPlus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { confirmAction } from "@/lib/confirm";
import { celebrate } from "@/lib/celebrate";
import {
  assertCanAddStar,
  assertCanRemoveStar,
  displayStellarBalance,
  formatStellarAmount,
  isCore,
  isGuardian,
  starBrightness,
  vaultProgress,
  type FamilyView,
  type StarRole,
} from "@/domain";
import type { FamilyInvite, StarLabel } from "@/application";
import { toRole } from "@/infrastructure/stellar/family";
import { formatUsdc, shortAddress } from "@/lib/stellar/format";
import { useWallet } from "@/components/stellar/wallet-context";
import { useFamilyWrite, useMyFamily } from "@/components/stellar/use-family";
import { ConstellationSvg } from "@/components/stellar/constellation-svg";
import { StarLabelDialog } from "../star-label-dialog";
import { markInviteAddedAction } from "../actions";
import { AddByAddressDialog, InvitePanel } from "./invites";

const usdc = (units: bigint) => displayStellarBalance(formatStellarAmount(units));

/** Mi familia (3.0.0): crear, ver la constelación y administrar estrellas. */
export function FamilyBoard({ stars, invites }: { stars: StarLabel[]; invites: FamilyInvite[] }) {
  const { address } = useWallet();
  const { state, refresh } = useMyFamily();
  const { run, pending, needsApprovalModal } = useFamilyWrite();
  const router = useRouter();
  const labels = useMemo(() => new Map(stars.map((s) => [s.address, s])), [stars]);

  if (!address) return null;
  if (state.status === "loading") return <Skeleton className="h-72 w-full rounded-2xl" />;
  if (state.status === "error") return <p className="text-sm text-destructive">{state.message}</p>;

  if (state.status === "none") {
    return (
      <div className="surface flex flex-col items-center gap-3 p-6 text-center">
        <Sparkles className="size-8 text-violet-500" />
        <h2 className="text-lg font-semibold">Todavía no tienes familia</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Crea tu constelación: quedas como su núcleo (guardián que no sale ni se quita) y después
          invitas a los tuyos. Si alguien te invitó, abre el enlace que te mandó.
        </p>
        <Button
          size="lg"
          disabled={pending !== null}
          onClick={async () => {
            const r = await run("create", (c, me) => c.create_family({ creator: me }));
            if (!r.ok) return toast.error(r.message);
            celebrate("¡Tu constelación nació!", "Ahora invita a tu familia");
            refresh();
          }}
        >
          {pending === "create" ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Crear mi familia
        </Button>
        {needsApprovalModal ? (
          <p className="text-xs text-muted-foreground">Aparecerá una ventana de tu wallet para confirmar.</p>
        ) : null}
      </div>
    );
  }

  const { family, contributions } = state.snapshot;
  const meCore = isCore(family, address);
  const meGuardian = isGuardian(family, address);
  const brightness = starBrightness(contributions);
  const nameOf = (a: string) =>
    a === address ? "Tú" : (labels.get(a) ? `${labels.get(a)!.emoji ?? ""} ${labels.get(a)!.nickname}`.trim() : shortAddress(a));

  async function act(label: string, fn: Parameters<typeof run>[1], ok: string) {
    const r = await run(label, fn);
    if (!r.ok) return toast.error(r.message);
    toast.success(ok);
    refresh();
  }

  async function addStar(newcomer: string, role: StarRole, inviteId?: string) {
    try {
      assertCanAddStar(family, address!, newcomer, role);
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "No se puede agregar");
    }
    const r = await run("add", (c, me) =>
      c.add_member({ guardian: me, family_id: family.id, member: newcomer, role: toRole(role) }),
    );
    if (!r.ok) return toast.error(r.message);
    if (inviteId) await markInviteAddedAction(inviteId);
    celebrate("Nueva estrella en tu constelación", shortAddress(newcomer));
    refresh();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="surface flex flex-col items-center gap-2 p-4">
        <ConstellationSvg
          stars={family.stars.map((s) => ({
            address: s.address,
            label: nameOf(s.address),
            brightness: brightness[s.address] ?? 0.25,
            isMe: s.address === address,
            isGuardian: s.role === "guardian",
          }))}
          progress={vaultProgress(family)}
        />
        <p className="text-sm text-muted-foreground">
          Familia #{family.id} · {family.stars.length} {family.stars.length === 1 ? "estrella" : "estrellas"} ·
          bóveda {formatUsdc(usdc(family.balance))}
          {family.goal > BigInt(0) ? ` de ${formatUsdc(usdc(family.goal))}` : ""}
        </p>
        <Link href="/trading/boveda" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Ir a la bóveda
        </Link>
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Estrellas</h2>
          {meGuardian ? (
            <AddByAddressDialog
              canAddGuardian={meCore}
              pending={pending === "add"}
              onAdd={async (a, role) => {
                await addStar(a, role);
              }}
            />
          ) : null}
        </div>
        <ul className="flex flex-col gap-2">
          {family.stars.map((s) => {
            const mine = s.address === address;
            const label = labels.get(s.address);
            let canRemove = false;
            try {
              assertCanRemoveStar(family, address, s.address);
              canRemove = !mine;
            } catch {
              canRemove = false;
            }
            return (
              <li key={s.address} className="surface flex flex-wrap items-center gap-3 p-3">
                <span className="grid size-10 place-items-center rounded-full bg-muted text-lg">
                  {mine ? "★" : (label?.emoji ?? "✦")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {mine ? "Tú" : (label?.nickname ?? "Sin apodo")}
                    {label?.relationship && !mine ? (
                      <span className="font-normal text-muted-foreground"> · {label.relationship}</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <code>{shortAddress(s.address, 6)}</code> · aportó {formatUsdc(usdc(contributions[s.address] ?? BigInt(0)))}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {isCore(family, s.address) ? (
                    <Badge className="bg-amber-400 text-amber-950">
                      <Crown className="size-3" /> Núcleo
                    </Badge>
                  ) : s.role === "guardian" ? (
                    <Badge variant="secondary">
                      <Shield className="size-3" /> Guardián
                    </Badge>
                  ) : (
                    <Badge variant="outline">Miembro</Badge>
                  )}
                  {!mine ? (
                    <StarLabelDialog
                      address={s.address}
                      label={label}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label="Ponerle apodo">
                          <Pencil className="size-4" />
                        </Button>
                      }
                    />
                  ) : null}
                  {meCore && !mine ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending !== null}
                      onClick={() =>
                        act(
                          "role",
                          (c, me) =>
                            c.set_role({
                              core: me,
                              family_id: family.id,
                              member: s.address,
                              role: toRole(s.role === "guardian" ? "member" : "guardian"),
                            }),
                          s.role === "guardian" ? "Ahora es miembro" : "Ahora es guardián",
                        )
                      }
                    >
                      {s.role === "guardian" ? "Hacer miembro" : "Hacer guardián"}
                    </Button>
                  ) : null}
                  {canRemove ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Quitar de la familia"
                      disabled={pending !== null}
                      onClick={async () => {
                        const yes = await confirmAction({
                          title: `¿Quitar a ${nameOf(s.address)} de la familia?`,
                          description: "Deja de poder depositar, pedir retiros y aprobar. Lo que ya aportó queda en la bóveda.",
                          confirmLabel: "Quitar",
                          tone: "danger",
                        });
                        if (yes) {
                          await act(
                            "remove",
                            (c, me) => c.remove_member({ guardian: me, family_id: family.id, member: s.address }),
                            "Estrella quitada",
                          );
                        }
                      }}
                    >
                      <UserMinus className="size-4" />
                    </Button>
                  ) : null}
                  {mine && !meCore ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending !== null}
                      onClick={async () => {
                        const yes = await confirmAction({
                          title: "¿Salirte de esta familia?",
                          description: "Lo que aportaste queda en la bóveda. Para volver, alguien tiene que invitarte otra vez.",
                          confirmLabel: "Salirme",
                          tone: "danger",
                        });
                        if (yes) {
                          await act("leave", (c, me) => c.leave_family({ member: me, family_id: family.id }), "Saliste de la familia");
                        }
                      }}
                    >
                      <LogOut className="size-4" /> Salir
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {meGuardian ? (
        <InvitePanel
          family={family as FamilyView}
          invites={invites.filter((i) => i.family_id === family.id)}
          canInviteGuardian={meCore}
          addPending={pending === "add"}
          onAddRedeemed={(inv) => addStar(inv.redeemed_address!, inv.role, inv.id)}
        />
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <UserPlus className="size-4" /> Solo los guardianes invitan a nuevas estrellas.
        </p>
      )}
    </div>
  );
}
