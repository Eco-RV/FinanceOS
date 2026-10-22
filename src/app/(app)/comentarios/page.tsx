import Link from "next/link";
import { Inbox } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { repositories } from "@/infrastructure/container";
import { isFeedbackUnread } from "@/domain";
import { BackLink } from "@/components/back-link";
import { EmptyRows } from "@/components/row-list";
import { buttonVariants } from "@/components/ui/button";
import { FOCUS_OUTLINE, PRESSABLE_SURFACE } from "@/lib/interactive";
import { cn } from "@/lib/utils";
import { NewPostDialog } from "./new-post-dialog";
import { activityLabel, KindTag, lastActivity, StatusBadge } from "./feedback-ui";

/**
 * 3.2.0 · Fase 3: el buzón del usuario. Lo suyo, con el estado de cada
 * publicación y un punto donde el equipo respondió y no lo ha leído (B5).
 */
export default async function ComentariosPage() {
  const [user, repos] = await Promise.all([requireUser(), repositories()]);
  const posts = await repos.feedback.mine();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink href="/ajustes" label="Ajustes" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Comentarios</h1>
          <p className="text-sm text-muted-foreground">
            Tu experiencia, tus dudas y lo que te gustaría que tuviera Finance OS. Solo tú y el equipo lo leen.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {user.isAdmin ? (
            <Link href="/comentarios/bandeja" className={cn(buttonVariants({ variant: "outline", size: "sm" }), FOCUS_OUTLINE)}>
              <Inbox className="size-4" /> Bandeja
            </Link>
          ) : null}
          <NewPostDialog />
        </div>
      </div>

      {posts.length === 0 ? (
        <EmptyRows action={<NewPostDialog label="Escribir el primero" />}>
          Todavía no nos has escrito. Cuéntanos cómo te va, pregunta lo que no entiendas o dinos qué te gustaría que
          tuviera la app: leemos todo y te respondemos aquí.
        </EmptyRows>
      ) : (
        <ul className="flex flex-col gap-2">
          {posts.map((post, i) => {
            const unread = isFeedbackUnread(post.admin_activity_at, post.user_read_at);
            return (
              <li key={post.id} className="rise" style={{ ["--rise-i" as string]: i }}>
                <Link
                  href={`/comentarios/${post.id}`}
                  className={cn("surface flex items-start gap-3 p-4", PRESSABLE_SURFACE, FOCUS_OUTLINE)}
                >
                  <span
                    className={cn("mt-1.5 size-2 shrink-0 rounded-full", unread ? "bg-primary" : "bg-transparent")}
                    aria-label={unread ? "Respuesta sin leer" : undefined}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <KindTag kind={post.kind} />
                      <span className="text-xs text-muted-foreground">· {activityLabel(lastActivity(post))}</span>
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
