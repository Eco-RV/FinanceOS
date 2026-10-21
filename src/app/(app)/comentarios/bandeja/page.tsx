import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { repositories } from "@/infrastructure/container";
import { FEEDBACK_KIND_LABEL, FEEDBACK_KINDS, isFeedbackClosed, isFeedbackUnread } from "@/domain";
import type { FeedbackPostRecord } from "@/application";
import { BackLink } from "@/components/back-link";
import { EmptyRows } from "@/components/row-list";
import { FOCUS_OUTLINE, PRESSABLE_SURFACE } from "@/lib/interactive";
import { cn } from "@/lib/utils";
import { activityLabel, KindTag, lastActivity, StatusBadge } from "../feedback-ui";

const VIEWS = [
  { key: "sin-leer", label: "Sin leer" },
  { key: "abiertas", label: "Abiertas" },
  { key: "cerradas", label: "Cerradas" },
  { key: "todas", label: "Todas" },
] as const;
type View = (typeof VIEWS)[number]["key"];

/**
 * 3.2.0 · Fase 3: bandeja del equipo (solo admin, B2). Todas las
 * publicaciones, con lo que falta leer primero.
 */
export default async function BandejaPage({ searchParams }: PageProps<"/comentarios/bandeja">) {
  const [user, query, repos] = await Promise.all([requireUser(), searchParams, repositories()]);
  if (!user.isAdmin) notFound();

  const all = (await repos.feedback.all()).filter((p) => p.user_id !== user.id);
  const unreadOf = (p: FeedbackPostRecord) => isFeedbackUnread(p.user_activity_at, p.admin_read_at);
  const view: View = VIEWS.some((v) => v.key === query.vista) ? (query.vista as View) : "sin-leer";
  const kind = FEEDBACK_KINDS.find((k) => k === query.tipo) ?? null;
  const counts: Record<View, number> = {
    "sin-leer": all.filter(unreadOf).length,
    abiertas: all.filter((p) => !isFeedbackClosed(p.status)).length,
    cerradas: all.filter((p) => isFeedbackClosed(p.status)).length,
    todas: all.length,
  };
  const posts = all.filter(
    (p) =>
      (view === "todas" ||
        (view === "sin-leer" && unreadOf(p)) ||
        (view === "abiertas" && !isFeedbackClosed(p.status)) ||
        (view === "cerradas" && isFeedbackClosed(p.status))) &&
      (!kind || p.kind === kind),
  );
  const href = (next: { vista?: View; tipo?: string | null }) => {
    const params = new URLSearchParams();
    params.set("vista", next.vista ?? view);
    const t = next.tipo === undefined ? kind : next.tipo;
    if (t) params.set("tipo", t);
    return `/comentarios/bandeja?${params}`;
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <BackLink href="/comentarios" label="Comentarios" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bandeja de comentarios</h1>
        <p className="text-sm text-muted-foreground">
          Lo que escriben los usuarios. Responde y cambia el estado desde cada conversación.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Filtrar">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={href({ vista: v.key })}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              FOCUS_OUTLINE,
              view === v.key ? "border-primary bg-primary text-primary-foreground" : "border-input hover:border-ring/60",
            )}
          >
            {v.label} <span className="opacity-70">{counts[v.key]}</span>
          </Link>
        ))}
        <span className="mx-1 w-px self-stretch bg-border" aria-hidden />
        {FEEDBACK_KINDS.map((k) => (
          <Link
            key={k}
            href={href({ tipo: kind === k ? null : k })}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              FOCUS_OUTLINE,
              kind === k ? "border-primary bg-primary/10 text-primary" : "border-input hover:border-ring/60",
            )}
          >
            {FEEDBACK_KIND_LABEL[k]}
          </Link>
        ))}
      </nav>

      {posts.length === 0 ? (
        <EmptyRows>{view === "sin-leer" ? "Nada sin leer. Todo al día." : "No hay publicaciones con ese filtro."}</EmptyRows>
      ) : (
        <ul className="flex flex-col gap-2">
          {posts.map((post) => {
            const unread = unreadOf(post);
            return (
              <li key={post.id}>
                <Link
                  href={`/comentarios/${post.id}`}
                  className={cn("surface flex items-start gap-3 p-4", PRESSABLE_SURFACE, FOCUS_OUTLINE)}
                >
                  <span
                    className={cn("mt-1.5 size-2 shrink-0 rounded-full", unread ? "bg-primary" : "bg-transparent")}
                    aria-label={unread ? "Sin leer" : undefined}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{post.author_name}</span>
                      <KindTag kind={post.kind} />
                      <span>· {activityLabel(lastActivity(post))}</span>
                    </div>
                    <p className={cn("truncate", unread ? "font-semibold" : "font-medium")}>{post.title}</p>
                  </div>
                  <StatusBadge status={post.status} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
