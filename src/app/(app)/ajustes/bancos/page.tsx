import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Bank, MailConnection } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { PARSERS } from "@/lib/mail/parsers/index.ts";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";
import { InactiveList, RemoveOrDeactivate } from "@/components/catalog-actions";
import { idsWithHistory } from "@/lib/catalog-history";
import { repositories } from "@/infrastructure/container";
import { BankFormDialog } from "./bank-form";
import { deleteBank, setBankActive } from "./actions";
import { disconnectMail } from "./mail-actions";

const GMAIL_MESSAGES: Record<string, string> = {
  ok: "Correo conectado.",
  cancelado: "No se completó la autorización de Google.",
  "sin-token":
    "Google no entregó permiso permanente. Revocá el acceso de Finance OS en tu cuenta de Google y volvé a intentar.",
  "sin-config": "Faltan las credenciales de Google en el servidor.",
  error: "No se pudo conectar el correo. Intentá de nuevo.",
};

export default async function BancosPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string }>;
}) {
  await requireUser();

  const supabase = await createClient();
  const [{ data }, { data: connData }] = await Promise.all([
    supabase.from("banks").select("*").order("name", { ascending: true }),
    supabase.from("mail_connections").select("*").maybeSingle(),
  ]);

  const all = (data ?? []) as Bank[];
  const withHistory = await idsWithHistory(
    (await repositories()).banks,
    all.map((b) => b.id),
  );
  const banks = all.filter((b) => !b.archived);
  const inactive = all.filter((b) => b.archived);
  const conn = connData as MailConnection | null;
  const { gmail } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/ajustes" label="Ajustes" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Bancos</h1>
          <p className="text-sm text-muted-foreground">
            De qué remitentes leer notificaciones de compras con tarjeta.
          </p>
        </div>
        <BankFormDialog />
      </div>

      {gmail && GMAIL_MESSAGES[gmail] ? (
        <p
          className={`rounded-lg border p-3 text-sm ${
            gmail === "ok" ? "" : "border-destructive/50 text-destructive"
          }`}
        >
          {GMAIL_MESSAGES[gmail]}
        </p>
      ) : null}

      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <div>
          <h2 className="text-lg font-medium">Correo</h2>
          <p className="text-sm text-muted-foreground">
            Finance OS lee los avisos de los bancos de abajo y, si lo usás,
            envía desde tu cuenta los avisos de cuota a tus miembros. Nunca ve
            tu contraseña y podés revocarlo cuando quieras.
          </p>
        </div>
        {conn ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-medium">{conn.email}</div>
              <div className="text-xs text-muted-foreground">
                {conn.last_synced_at
                  ? `Última lectura: ${formatDate(conn.last_synced_at.slice(0, 10))}`
                  : "Aún sin leer"}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {String(conn.scopes ?? "").includes("gmail.send") ? null : (
                <a
                  href="/api/gmail/connect"
                  className={buttonVariants({ size: "sm" })}
                  title="Para enviar avisos de cuota por correo"
                >
                  Reconectar para enviar avisos
                </a>
              )}
              <form action={disconnectMail}>
                <Button type="submit" variant="outline" size="sm">
                  Desconectar
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <a
            href="/api/gmail/connect"
            className={buttonVariants({ size: "sm" }) + " w-fit"}
          >
            Conectar Gmail
          </a>
        )}
      </section>

      {banks.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Todavía no agregaste ningún banco. Agregá uno con el correo desde el
          que te llegan los avisos de compra.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableBody>
              {banks.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <div className="font-medium">{b.name}</div>
                    <div className="break-all text-xs text-muted-foreground">
                      {b.sender_emails.join(", ")}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary">
                      {PARSERS[b.parser_key as keyof typeof PARSERS]?.label ??
                        b.parser_key}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {b.enabled ? (
                      <Badge>Activo</Badge>
                    ) : (
                      <Badge variant="outline">Pausado</Badge>
                    )}
                  </TableCell>
                  <TableCell className="w-24">
                    <div className="flex justify-end gap-1">
                      <BankFormDialog bank={b} />
                      <RemoveOrDeactivate
                        id={b.id}
                        label={`el banco "${b.name}"`}
                        hasHistory={withHistory.has(b.id)}
                        onDelete={deleteBank}
                        onSetActive={setBankActive}
                        deactivateNote="No se leerán más sus correos."
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <InactiveList
        title="Desactivados"
        items={inactive.map((b) => ({
          id: b.id,
          name: b.name,
          detail: b.sender_emails.join(", "),
          hasHistory: withHistory.has(b.id),
        }))}
        noun="el banco"
        onDelete={deleteBank}
        onSetActive={setBankActive}
      />
    </div>
  );
}
