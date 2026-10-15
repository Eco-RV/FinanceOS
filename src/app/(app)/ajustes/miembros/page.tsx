import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Member } from "@/lib/types";
import { RowActions, RowItem, RowList } from "@/components/row-list";
import { BackLink } from "@/components/back-link";
import { InactiveList, RemoveOrDeactivate } from "@/components/catalog-actions";
import { MobileCard, MobileField, MobileList } from "@/components/mobile-list";
import { idsWithHistory } from "@/lib/catalog-history";
import { repositories } from "@/infrastructure/container";
import { phoneLabel } from "@/lib/notices";
import { MemberFormDialog } from "./member-form";
import { deleteMember, setMemberActive } from "./actions";

export default async function MiembrosPage() {
  await requireUser();

  const supabase = await createClient();
  const { data } = await supabase.from("members").select("*").order("name", { ascending: true });
  const all = (data ?? []) as Member[];
  const withHistory = await idsWithHistory(
    (await repositories()).members,
    all.map((m) => m.id),
  );
  const members = all.filter((m) => !m.archived);
  const inactive = all.filter((m) => m.archived);

  const actions = (m: Member) => (
    <div className="relative z-10 flex justify-end gap-1">
      <MemberFormDialog member={m} />
      <RemoveOrDeactivate
        id={m.id}
        label={`a "${m.name}"`}
        hasHistory={withHistory.has(m.id)}
        onDelete={deleteMember}
        onSetActive={setMemberActive}
        deactivateNote="Sus partes y reembolsos se conservan."
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/ajustes" label="Ajustes" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Miembros</h1>
          <p className="text-sm text-muted-foreground">
            Familia que te paga parte de las cuotas de un financiamiento.
          </p>
        </div>
        <MemberFormDialog />
      </div>

      {members.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Todavía no tenés miembros. Agregá uno y después repartí las cuotas
          desde el detalle de un financiamiento.
        </p>
      ) : (
        <>
          <RowList
            columns="minmax(0,1.4fr) minmax(0,1.6fr) minmax(0,1fr) 5.5rem"
            headers={[{ label: "Nombre" }, { label: "Correo" }, { label: "WhatsApp" }, {}]}
          >
            {members.map((m, i) => (
              <RowItem key={m.id} index={i}>
                <span className="truncate font-medium">{m.name}</span>
                <span className="truncate text-muted-foreground">{m.email ?? "—"}</span>
                <span className="tabular-nums text-muted-foreground">{phoneLabel(m.phone)}</span>
                <RowActions>{actions(m)}</RowActions>
              </RowItem>
            ))}
          </RowList>
          <MobileList>
            {members.map((m, i) => (
              <MobileCard key={m.id} index={i} title={m.name} actions={actions(m)}>
                <MobileField label="Correo" value={m.email ?? "—"} />
                <MobileField label="WhatsApp" value={phoneLabel(m.phone)} />
              </MobileCard>
            ))}
          </MobileList>
        </>
      )}

      <InactiveList
        title="Desactivados"
        items={inactive.map((m) => ({ id: m.id, name: m.name, hasHistory: withHistory.has(m.id) }))}
        noun="al miembro"
        onDelete={deleteMember}
        onSetActive={setMemberActive}
      />
    </div>
  );
}
