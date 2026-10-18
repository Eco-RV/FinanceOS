"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, LoaderCircle, MessageCircle, Plus, UserPlus, X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { FormField, Select } from "@/components/form-field";
import { formatDate } from "@/lib/format";
import { inviteState, isStellarAddress, type FamilyView, type StarRole } from "@/domain";
import type { FamilyInvite } from "@/application";
import { shortAddress } from "@/lib/stellar/format";
import { createInviteAction, revokeInviteAction } from "../actions";

const STATE_LABEL = {
  pending: "Esperando",
  redeemed: "Lista para agregar",
  added: "Agregada",
  expired: "Venció",
  revoked: "Revocada",
} as const;

/** Invitaciones a la familia (D2): enlace de 72 h que se canjea con sesión. */
export function InvitePanel({
  family,
  invites,
  canInviteGuardian,
  addPending,
  onAddRedeemed,
}: {
  family: FamilyView;
  invites: FamilyInvite[];
  canInviteGuardian: boolean;
  addPending: boolean;
  onAddRedeemed: (invite: FamilyInvite) => void;
}) {
  const router = useRouter();
  const [now] = useState(() => new Date());
  const visible = invites.filter((i) => {
    const s = inviteState(i, now);
    return s === "pending" || s === "redeemed" || (s === "added" && now.getTime() - new Date(i.added_at!).getTime() < 7 * 864e5);
  });

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Invitaciones</h2>
        <CreateInviteDialog familyId={family.id} canInviteGuardian={canInviteGuardian} />
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Invita con un enlace: la persona entra a Finance OS, conecta su wallet y la aceptas aquí.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((inv) => {
            const state = inviteState(inv, now);
            return (
              <li key={inv.id} className="surface flex flex-wrap items-center gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {inv.role === "guardian" ? "Guardián" : "Miembro"}
                    {inv.redeemed_address ? (
                      <code className="ml-2 text-xs text-muted-foreground">{shortAddress(inv.redeemed_address, 6)}</code>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {state === "pending" ? `Vence el ${formatDate(inv.expires_at.slice(0, 10))}` : STATE_LABEL[state]}
                  </p>
                </div>
                {state === "redeemed" ? (
                  <Button size="sm" disabled={addPending} onClick={() => onAddRedeemed(inv)}>
                    {addPending ? <LoaderCircle className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                    Agregar a la familia
                  </Button>
                ) : state === "added" ? (
                  <Badge variant="secondary">
                    <Check className="size-3" /> Agregada
                  </Badge>
                ) : (
                  <Badge variant="outline">{STATE_LABEL[state]}</Badge>
                )}
                {state === "pending" || state === "redeemed" ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Revocar invitación"
                    onClick={async () => {
                      const r = await revokeInviteAction(inv.id);
                      if (!r.ok) return toast.error(r.message);
                      toast.success("Invitación revocada");
                      router.refresh();
                    }}
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
  );
}

function CreateInviteDialog({ familyId, canInviteGuardian }: { familyId: number; canInviteGuardian: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<StarRole>("member");
  const [link, setLink] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function create() {
    setPending(true);
    const r = await createInviteAction({ familyId, role });
    setPending(false);
    if (!r.ok) return toast.error(r.message);
    setLink(`${window.location.origin}/trading/unirse/${r.value.token}`);
    router.refresh();
  }

  const message = link
    ? `Te invito a mi familia en Finance OS (Constelación). Entra con tu cuenta y conecta tu wallet aquí: ${link}`
    : "";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setLink(null);
          setRole("member");
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Plus className="size-4" /> Invitar
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invitar a la familia</DialogTitle>
          <DialogDescription>
            El enlace vale 72 horas y sirve una sola vez. Quien lo abra necesita cuenta en Finance OS.
          </DialogDescription>
        </DialogHeader>
        {link ? (
          <div className="flex flex-col gap-3">
            <code className="rounded-lg bg-muted p-2 text-xs break-all">{link}</code>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => {
                  void navigator.clipboard.writeText(link);
                  toast.success("Enlace copiado");
                }}
              >
                <Copy className="size-4" /> Copiar
              </Button>
              <a
                className="flex-1"
                href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="outline" className="w-full">
                  <MessageCircle className="size-4" /> WhatsApp
                </Button>
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              Guárdalo ahora: por seguridad no se vuelve a mostrar (solo guardamos una huella).
            </p>
          </div>
        ) : (
          <FormField label="Entra como" htmlFor="invite-role">
            <Select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as StarRole)}>
              <option value="member">Miembro: deposita y pide retiros</option>
              {canInviteGuardian ? <option value="guardian">Guardián: además aprueba retiros</option> : null}
            </Select>
          </FormField>
        )}
        {!link ? (
          <DialogFooter>
            <Button onClick={() => void create()} disabled={pending}>
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Crear enlace
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Agregar por dirección (si ya la tienes, sin invitación). */
export function AddByAddressDialog({
  canAddGuardian,
  pending,
  onAdd,
}: {
  canAddGuardian: boolean;
  pending: boolean;
  onAdd: (address: string, role: StarRole) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [role, setRole] = useState<StarRole>("member");
  const valid = isStellarAddress(address);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="ghost" />}>
        <UserPlus className="size-4" /> Por dirección
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar por dirección</DialogTitle>
          <DialogDescription>
            Pega la dirección G… de su wallet. Revisa letra por letra con esa persona.
          </DialogDescription>
        </DialogHeader>
        <FormField label="Dirección" htmlFor="add-address">
          <Input
            id="add-address"
            value={address}
            onChange={(e) => setAddress(e.target.value.trim())}
            placeholder="G…"
            spellCheck={false}
            className="font-mono text-base"
          />
        </FormField>
        <FormField label="Entra como" htmlFor="add-role">
          <Select id="add-role" value={role} onChange={(e) => setRole(e.target.value as StarRole)}>
            <option value="member">Miembro</option>
            {canAddGuardian ? <option value="guardian">Guardián</option> : null}
          </Select>
        </FormField>
        <DialogFooter>
          <Button
            disabled={!valid || pending}
            onClick={async () => {
              await onAdd(address, role);
              setOpen(false);
              setAddress("");
            }}
          >
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
