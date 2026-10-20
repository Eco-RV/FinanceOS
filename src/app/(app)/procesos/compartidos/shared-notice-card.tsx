import type { SharedNoticeGroup } from "@/domain";
import { formatCurrency, formatDate } from "@/lib/format";
import { sharedNoticeMessage, whatsappUrl } from "@/lib/notices";
import type { SharedBoard } from "@/lib/shared-board";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  EmailNoticeButton,
  WhatsappNoticeButton,
} from "../tarjetas/_financiamientos/member-actions";
import { recordSharedWhatsappNotice, sendSharedEmailNotice } from "./actions";

export function bucketLabel(q: number): string {
  if (q === 0) return "venció";
  if (q > 3) return "más de 3 quincenas";
  return `${q} quincena${q === 1 ? "" : "s"}`;
}

/** X5: aviso de una persona (sus partes con la misma fecha límite) con WhatsApp y correo. */
export function SharedNoticeCard({
  group,
  board,
  canEmail,
  muted,
}: {
  group: SharedNoticeGroup;
  board: SharedBoard;
  canEmail: boolean;
  muted?: boolean;
}) {
  const member = board.members.get(group.member_id);
  if (!member) return null;
  const message = sharedNoticeMessage(member.name, group, board.expenses);
  const notice = { memberId: member.id, dueOn: group.due_on, currency: group.currency };
  return (
    <div className={cn("surface flex flex-col gap-2 p-3", muted && "opacity-80")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">
            {member.name}{" "}
            <Badge variant={group.quincenas <= 1 ? "destructive" : "secondary"}>{bucketLabel(group.quincenas)}</Badge>
          </p>
          <p className="text-xs text-muted-foreground">
            Antes del {formatDate(group.due_on)}
            {group.lastSentAt ? ` · último aviso ${formatDate(group.lastSentAt.slice(0, 10))}` : " · sin avisar"}
          </p>
        </div>
        <p className="font-semibold tabular-nums">{formatCurrency(group.total, group.currency)}</p>
      </div>
      <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-2 font-sans text-xs text-muted-foreground">
        {message.text}
      </pre>
      <div className="flex flex-wrap gap-2">
        {member.phone ? (
          <WhatsappNoticeButton
            notice={notice}
            url={whatsappUrl(member.phone, message.text)}
            action={recordSharedWhatsappNotice}
          />
        ) : null}
        {member.email && canEmail ? <EmailNoticeButton notice={notice} action={sendSharedEmailNotice} /> : null}
        {!member.phone && !(member.email && canEmail) ? (
          <span className="text-xs text-muted-foreground">
            Sin WhatsApp{canEmail ? " ni correo" : ""}: edita a la persona en Ajustes → Miembros.
          </span>
        ) : null}
      </div>
    </div>
  );
}
