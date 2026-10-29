import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Bank, MailConnection } from "@/lib/types";
import { formatDate, relativeDayLabel } from "@/lib/format";
import { crToday, daysUntil, toISODate } from "@/domain";
import { PARSERS } from "@/lib/mail/parsers/index.ts";
import { PROVIDER_LABELS } from "@/lib/mail/provider";
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
import { FormatTestDialog } from "./format-test-dialog";
import { deleteBank, setBankActive } from "./actions";
import { disconnectMail } from "./mail-actions";

const CONNECT_MESSAGES: Record<"gmail" | "outlook", Record<string, string>> = {
  gmail: {
    ok: "Gmail conectado.",
    cancelado: "No se completó la autorización de Google.",
    "sin-token":
      "Google no entregó permiso permanente. Revoca el acceso de Finance OS en tu cuenta de Google y vuelve a intentar.",
    "sin-config": "Faltan las credenciales de Google en el servidor.",
    error: "No se pudo conectar el correo. Intenta de nuevo.",
  },
  outlook: {
    ok: "Outlook conectado.",
    cancelado: "No se completó la autorización de Microsoft.",
    "sin-token":
      "Microsoft no entregó permiso permanente. Vuelve a intentar y acepta todos los permisos.",
    "sin-config": "Faltan las credenciales de Microsoft en el servidor.",
    error: "No se pudo conectar Outlook. Solo se aceptan cuentas personales (outlook.com, hotmail, live).",
  },
};

const CONNECT_URL = { gmail: "/api/gmail/connect", outlook: "/api/outlook/connect" } as const;

/** Instante guardado (UTC) → "hoy" / "hace 2 días", contado en Costa Rica. */
function sinceLabel(iso: string): string {
  return relativeDayLabel(daysUntil(crToday(new Date(iso))));
}

function resultLabel(r: NonNullable<MailConnection["last_result"]>): string {
  const parts = [`${r.imported} nueva${r.imported === 1 ? "" : "s"}`];
  if (r.ignored > 0) parts.push(`${r.ignored} sin leer`);
  if (r.autoApproved) parts.push(`${r.autoApproved} aceptada${r.autoApproved === 1 ? "" : "s"} sola${r.autoApproved === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

/** El último correo de sus remitentes que no se entendió es más nuevo que el último que sí. */
function templateMayHaveChanged(b: Bank): boolean {
  if (!b.last_ignored_at) return false;
  return !b.last_parsed_at || b.last_ignored_at > b.last_parsed_at;
}

export default async function BancosPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string; outlook?: string }>;
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
  const provider = conn?.provider === "outlook" ? "outlook" : "gmail";
  const other = provider === "gmail" ? "outlook" : "gmail";
  const params = await searchParams;
  const notice = (["gmail", "outlook"] as const)
    .map((p) => ({ p, status: params[p] }))
    .find(({ p, status }) => status && CONNECT_MESSAGES[p][status]);

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/ajustes" label="Ajustes" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bancos</h1>
          <p className="text-sm text-muted-foreground">
            De qué remitentes leer notificaciones de compras con tarjeta.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Link href="/ajustes/bancos/reglas" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Reglas de comercio
          </Link>
          <BankFormDialog />
        </div>
      </div>

      {notice ? (
        <p
          className={`rounded-xl p-3 text-sm ${
            notice.status === "ok" ? "surface" : "border border-destructive/30 bg-destructive/5 text-destructive"
          }`}
        >
          {CONNECT_MESSAGES[notice.p][notice.status!]}
        </p>
      ) : null}

      <section className="surface flex flex-col gap-3 p-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Correo</h2>
          <p className="text-sm text-muted-foreground">
            Finance OS lee los avisos de los bancos de abajo desde Gmail u
            Outlook (uno a la vez) y, con Gmail, envía desde tu cuenta los
            avisos de cuota a tus miembros. Nunca ve tu contraseña y puedes
            revocarlo cuando quieras.
          </p>
        </div>
        {conn ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <div className="flex items-center gap-2 font-medium">
                  {conn.email}
                  <Badge variant="secondary">{PROVIDER_LABELS[provider]}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {conn.last_synced_at
                    ? `Última lectura: ${formatDate(toISODate(crToday(new Date(conn.last_synced_at))))}` +
                      (conn.last_result ? ` · ${resultLabel(conn.last_result)}` : "")
                    : "Aún sin leer"}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {conn.last_error ? (
                  <a href={CONNECT_URL[provider]} className={buttonVariants({ size: "sm" })}>
                    Reconectar
                  </a>
                ) : provider === "gmail" && !String(conn.scopes ?? "").includes("gmail.send") ? (
                  <a
                    href={CONNECT_URL.gmail}
                    className={buttonVariants({ size: "sm" })}
                    title="Para enviar avisos de cuota por correo"
                  >
                    Reconectar para enviar avisos
                  </a>
                ) : null}
                <a
                  href={CONNECT_URL[other]}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                  title={`Reemplaza la conexión de ${PROVIDER_LABELS[provider]}`}
                >
                  Cambiar a {PROVIDER_LABELS[other]}
                </a>
                <form action={disconnectMail}>
                  <Button type="submit" variant="outline" size="sm">
                    Desconectar
                  </Button>
                </form>
              </div>
            </div>
            {conn.last_error ? (
              <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  {conn.last_error}
                  {conn.last_error_at ? (
                    <span className="text-destructive/80"> ({sinceLabel(conn.last_error_at)})</span>
                  ) : null}
                </span>
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <a href={CONNECT_URL.gmail} className={buttonVariants({ size: "sm" })}>
              Conectar Gmail
            </a>
            <a href={CONNECT_URL.outlook} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Conectar Outlook
            </a>
          </div>
        )}
      </section>

      {banks.length === 0 ? (
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Todavía no agregaste ningún banco. Agrega uno con el correo desde el
          que te llegan los avisos de compra.
        </div>
      ) : (
        <div className="surface overflow-hidden">
          <Table>
            <TableBody>
              {banks.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="whitespace-normal">
                    <div className="font-medium">{b.name}</div>
                    <div className="break-all text-xs text-muted-foreground">
                      {b.sender_emails.join(", ")}
                    </div>
                    {b.last_parsed_at ? (
                      <div className="text-xs text-muted-foreground">
                        Último aviso leído: {sinceLabel(b.last_parsed_at)}
                      </div>
                    ) : null}
                    {templateMayHaveChanged(b) ? (
                      <div className="mt-1 flex items-start gap-1.5 text-xs text-warning">
                        <AlertTriangle className="mt-px size-3.5 shrink-0" />
                        <span>
                          {b.name} mandó avisos que no se pudieron leer ({sinceLabel(b.last_ignored_at!)}).
                          Puede que haya cambiado la plantilla: prueba un aviso reciente con Probar formato.
                        </span>
                      </div>
                    ) : null}
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
                  <TableCell className="w-32">
                    <div className="flex justify-end gap-1">
                      <FormatTestDialog bankName={b.name} parserKey={b.parser_key} />
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
