import Link from "next/link";
import { BellRing, CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { crToday, toISODate, type NoticeGroup } from "@/domain";
import { formatCurrency, formatDate } from "@/lib/format";
import { loadFinancingBoard, type FinancingBoard } from "@/lib/financing-board";
import { noticeMessage, whatsappUrl } from "@/lib/notices";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { BackLink } from "@/components/back-link";
import {
  EmailNoticeButton,
  ReimburseDialog,
  WhatsappNoticeButton,
} from "../tarjetas/_financiamientos/member-actions";

function quincenasLabel(q: number): string {
  if (q === 0) return "venció";
  return `${q} quincena${q === 1 ? "" : "s"}`;
}

export default async function CobrosPage() {
  await requireUser();
  const supabase = await createClient();
  const todayISO = toISODate(crToday());
  const board = await loadFinancingBoard(supabase, todayISO);
  const { data: conn } = await supabase
    .from("mail_connections")
    .select("scopes")
    .eq("provider", "gmail")
    .maybeSingle();
  const canEmail = String(conn?.scopes ?? "").includes("gmail.send");

  const toSend = board.groups.filter((g) => g.needsNotice);
  const notified = board.groups.filter((g) => !g.needsNotice);

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/procesos" label="Procesos" />
      <div>
        <h1 className="text-2xl font-semibold">Cobros a miembros</h1>
        <p className="text-sm text-muted-foreground">
          Lo que tu familia te paga de las cuotas de tus financiamientos. Los
          avisos dicen a cada uno su parte y cuántas quincenas faltan para la
          fecha límite de la tarjeta.
        </p>
      </div>

      {board.parts.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Ningún financiamiento tiene reparto. Agregá miembros en{" "}
          <Link href="/ajustes/miembros" className="underline">
            Ajustes → Miembros
          </Link>{" "}
          y repartí las cuotas desde el detalle de un financiamiento.
        </p>
      ) : null}

      {board.parts.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-lg font-medium">
            <BellRing className="size-4 text-muted-foreground" /> Avisos por enviar
          </h2>
          {!canEmail ? (
            <p className="text-xs text-muted-foreground">
              Para enviar por correo,{" "}
              <Link href="/ajustes/bancos" className="underline">
                conectá (o reconectá) Gmail
              </Link>{" "}
              con permiso de enviar.
            </p>
          ) : null}
          {toSend.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4" /> Nada por avisar en esta quincena.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {toSend.map((g) => (
                <NoticeCard key={key(g)} group={g} board={board} canEmail={canEmail} />
              ))}
            </div>
          )}
          {notified.length > 0 ? (
            <details className="surface p-3 text-sm">
              <summary className="cursor-pointer rounded-sm text-muted-foreground transition-colors select-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring">
                Ya avisados en esta quincena ({notified.length})
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                {notified.map((g) => (
                  <NoticeCard key={key(g)} group={g} board={board} canEmail={canEmail} muted />
                ))}
              </div>
            </details>
          ) : null}
        </section>
      ) : null}

      {board.receivables.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Por cobrar</h2>
          <p className="text-sm text-muted-foreground">
            Partes de cuotas que ya entraron a la tarjeta y el miembro todavía no te pagó.
          </p>
          <div className="flex flex-col gap-2">
            {board.receivables.map((r) => {
              const member = board.members.get(r.member_id);
              return (
                <div key={`${r.member_id}:${r.currency}`} className="surface p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{member?.name ?? "Miembro"}</p>
                    <p className="font-semibold tabular-nums">{formatCurrency(r.total, r.currency)}</p>
                  </div>
                  <ul className="mt-2 flex flex-col divide-y text-sm">
                    {r.parts.map((part) => {
                      const plan = board.plans.get(part.financing_id);
                      return (
                        <li
                          key={`${part.financing_id}:${part.installment_no}`}
                          className="flex items-center justify-between gap-3 py-1.5"
                        >
                          <span className="min-w-0 truncate">
                            {plan ? (
                              <Link
                                href={`/procesos/tarjetas/${plan.card_id}/financiamientos/${part.financing_id}`}
                                className="hover:underline"
                              >
                                {plan.description}
                              </Link>
                            ) : null}{" "}
                            <span className="text-muted-foreground">
                              cuota {part.installment_no}/{plan?.months} · antes del{" "}
                              {formatDate(part.due_on)}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="tabular-nums">{formatCurrency(part.amount, r.currency)}</span>
                            <ReimburseDialog
                              financingId={part.financing_id}
                              memberId={part.member_id}
                              memberName={member?.name ?? "Miembro"}
                              installmentNo={part.installment_no}
                              months={plan?.months ?? part.installment_no}
                              amount={part.amount}
                              currency={r.currency}
                            />
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function key(g: NoticeGroup) {
  return `${g.member_id}:${g.due_on}:${g.currency}`;
}

function NoticeCard({
  group,
  board,
  canEmail,
  muted,
}: {
  group: NoticeGroup;
  board: FinancingBoard;
  canEmail: boolean;
  muted?: boolean;
}) {
  const member = board.members.get(group.member_id);
  if (!member) return null;
  const message = noticeMessage(member.name, group, board.plans);
  const notice = { memberId: member.id, dueOn: group.due_on, currency: group.currency };
  return (
    <div className={cn("surface flex flex-col gap-2 p-3", muted && "opacity-80")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">
            {member.name}{" "}
            <Badge variant={group.quincenas <= 1 ? "destructive" : "secondary"}>
              {quincenasLabel(group.quincenas)}
            </Badge>
          </p>
          <p className="text-xs text-muted-foreground">
            Fecha límite {formatDate(group.due_on)}
            {group.lastSentAt ? ` · último aviso ${formatDate(group.lastSentAt.slice(0, 10))}` : ""}
          </p>
        </div>
        <p className="font-semibold tabular-nums">{formatCurrency(group.total, group.currency)}</p>
      </div>
      <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-2 font-sans text-xs text-muted-foreground">
        {message.text}
      </pre>
      <div className="flex flex-wrap gap-2">
        {member.phone ? (
          <WhatsappNoticeButton notice={notice} url={whatsappUrl(member.phone, message.text)} />
        ) : null}
        {member.email && canEmail ? <EmailNoticeButton notice={notice} /> : null}
        {!member.phone && !(member.email && canEmail) ? (
          <span className="text-xs text-muted-foreground">
            Sin WhatsApp{canEmail ? " ni correo" : ""}: editá al miembro en Ajustes → Miembros.
          </span>
        ) : null}
      </div>
    </div>
  );
}
