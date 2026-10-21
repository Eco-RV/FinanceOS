import { notFound } from "next/navigation";
import { ImageIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { repositories } from "@/infrastructure/container";
import { FEEDBACK_STATUS_HINT, isFeedbackClosed, isFeedbackUnread } from "@/domain";
import { BackLink } from "@/components/back-link";
import { cn } from "@/lib/utils";
import { NewPostDialog } from "../new-post-dialog";
import { activityLabel, KindTag, StatusBadge } from "../feedback-ui";
import { MarkRead, ReplyForm, StatusControl } from "./thread-actions";

/**
 * 3.2.0 · Fase 3: una conversación del buzón. La ve su autor y el equipo
 * (admin, B2); el admin además cambia el estado (B3).
 */
export default async function ConversacionPage({ params }: PageProps<"/comentarios/[id]">) {
  const [user, { id }, repos] = await Promise.all([requireUser(), params, repositories()]);
  const post = await repos.feedback.find(id);
  if (!post) notFound();

  const isOwner = post.user_id === user.id;
  const asAdmin = user.isAdmin && !isOwner;
  const [messages, imageUrl] = await Promise.all([repos.feedback.messages(post.id), repos.feedback.attachmentUrl(post.id)]);
  const unread = asAdmin
    ? isFeedbackUnread(post.user_activity_at, post.admin_read_at)
    : isFeedbackUnread(post.admin_activity_at, post.user_read_at);
  const closed = isFeedbackClosed(post.status);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {unread ? <MarkRead postId={post.id} side={asAdmin ? "admin" : "user"} /> : null}
      <BackLink href={asAdmin ? "/comentarios/bandeja" : "/comentarios"} label={asAdmin ? "Bandeja" : "Comentarios"} />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <KindTag kind={post.kind} />
          {asAdmin ? <span className="text-xs text-muted-foreground">· {post.author_name}</span> : null}
        </div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{post.title}</h1>
          <StatusBadge status={post.status} className="mt-1.5" />
        </div>
        {!asAdmin ? <p className="text-sm text-muted-foreground">{FEEDBACK_STATUS_HINT[post.status]}</p> : null}
      </div>

      {imageUrl ? (
        <a
          href={imageUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <ImageIcon className="size-4" /> Ver la captura
        </a>
      ) : null}

      <ol className="flex flex-col gap-3" aria-label="Conversación">
        {messages.map((m) => {
          const mine = asAdmin ? m.from_admin : !m.from_admin;
          const who = m.from_admin ? (asAdmin ? "Tú (equipo)" : "Equipo Finance OS") : asAdmin ? post.author_name : "Tú";
          return (
            <li key={m.id} className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}>
              <span className="px-1 text-xs text-muted-foreground">
                {who} · {activityLabel(m.created_at)}
              </span>
              <p
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                  mine ? "rounded-br-md bg-primary text-primary-foreground" : "surface rounded-bl-md",
                )}
              >
                {m.body}
              </p>
            </li>
          );
        })}
      </ol>

      {asAdmin ? (
        <>
          <ReplyForm postId={post.id} asAdmin />
          <StatusControl postId={post.id} status={post.status} />
        </>
      ) : closed ? (
        <div className="surface flex flex-col items-start gap-3 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">Esta conversación se cerró. ¿Algo más? Escríbenos de nuevo.</p>
          <NewPostDialog label="Escribir de nuevo" />
        </div>
      ) : (
        <ReplyForm postId={post.id} />
      )}
    </div>
  );
}
