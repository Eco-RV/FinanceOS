import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Member } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    <div className="flex justify-end gap-1">
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
          <h1 className="text-2xl font-semibold">Miembros</h1>
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
          <div className="surface hidden overflow-hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-muted-foreground">{m.email ?? "—"}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {phoneLabel(m.phone)}
                    </TableCell>
                    <TableCell>{actions(m)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <MobileList>
            {members.map((m) => (
              <MobileCard key={m.id} title={m.name} actions={actions(m)}>
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
