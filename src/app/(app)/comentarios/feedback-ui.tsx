import type { ComponentType } from "react";
import { CircleHelp, Lightbulb, MessageCircleHeart, Wrench } from "lucide-react";
import { FEEDBACK_KIND_LABEL, FEEDBACK_STATUS_LABEL, type FeedbackKind, type FeedbackStatus } from "@/domain";
import { cn } from "@/lib/utils";

/** 3.2.0: ícono de cada tipo de publicación del buzón. */
export const KIND_ICON: Record<FeedbackKind, ComponentType<{ className?: string }>> = {
  experiencia: MessageCircleHeart,
  duda: CircleHelp,
  mejora: Wrench,
  deseo: Lightbulb,
};

const STATUS_TONE: Record<FeedbackStatus, string> = {
  recibido: "bg-muted text-muted-foreground",
  en_revision: "bg-warning/15 text-foreground",
  en_planes: "bg-primary/10 text-primary",
  hecho: "bg-success/15 text-success",
  no_por_ahora: "bg-muted text-muted-foreground line-through decoration-1",
};

export function StatusBadge({ status, className }: { status: FeedbackStatus; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", STATUS_TONE[status], className)}>
      {FEEDBACK_STATUS_LABEL[status]}
    </span>
  );
}

export function KindTag({ kind }: { kind: FeedbackKind }) {
  const Icon = KIND_ICON[kind];
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className="size-3.5" />
      {FEEDBACK_KIND_LABEL[kind]}
    </span>
  );
}

/** "hace 2 días", "hoy 14:05"… para la actividad de una conversación. */
export function activityLabel(iso: string): string {
  const date = new Date(iso);
  const sameDay = (a: Date, b: Date) =>
    a.toLocaleDateString("es-CR", { timeZone: "America/Costa_Rica" }) ===
    b.toLocaleDateString("es-CR", { timeZone: "America/Costa_Rica" });
  const time = date.toLocaleTimeString("es-CR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Costa_Rica" });
  if (sameDay(date, new Date())) return `hoy ${time}`;
  return date.toLocaleDateString("es-CR", { day: "numeric", month: "short", timeZone: "America/Costa_Rica" });
}

/** Última actividad de una conversación (de cualquiera de los dos lados). */
export function lastActivity(post: { user_activity_at: string; admin_activity_at: string | null }): string {
  return post.admin_activity_at && Date.parse(post.admin_activity_at) > Date.parse(post.user_activity_at)
    ? post.admin_activity_at
    : post.user_activity_at;
}
