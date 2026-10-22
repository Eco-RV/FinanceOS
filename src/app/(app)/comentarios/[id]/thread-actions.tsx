"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { LoaderCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/form-field";
import { FEEDBACK_BODY_MAX, FEEDBACK_STATUS_LABEL, FEEDBACK_STATUSES, type FeedbackStatus } from "@/domain";
import { markFeedbackReadAction, replyFeedbackAction, setFeedbackStatusAction } from "../actions";

/** 3.2.0 (B5): al abrir algo sin leer, lo marca leído (y se apaga el punto del menú). */
export function MarkRead({ postId, side }: { postId: string; side: "user" | "admin" }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void markFeedbackReadAction(postId, side);
  }, [postId, side]);
  return null;
}

/** 3.2.0 (B1/B6): responder en la conversación. */
export function ReplyForm({ postId, asAdmin = false }: { postId: string; asAdmin?: boolean }) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  function send() {
    start(async () => {
      const formData = new FormData();
      formData.set("post_id", postId);
      formData.set("body", body);
      formData.set("as_admin", String(asAdmin));
      const result = await replyFeedbackAction(formData);
      if (result?.ok) setBody("");
      else toast.error(result?.message ?? "No se pudo enviar");
    });
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <label htmlFor="reply" className="sr-only">
        Respuesta
      </label>
      <Textarea
        id="reply"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={asAdmin ? "Responde como equipo de Finance OS…" : "Escribe tu respuesta…"}
        maxLength={FEEDBACK_BODY_MAX}
        rows={3}
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending || !body.trim()}>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
          Enviar
        </Button>
      </div>
    </form>
  );
}

/** 3.2.0 (B3): el admin cambia el estado; "No por ahora" pide el motivo. */
export function StatusControl({ postId, status }: { postId: string; status: FeedbackStatus }) {
  const [next, setNext] = useState<FeedbackStatus>(status);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  function apply() {
    start(async () => {
      const formData = new FormData();
      formData.set("post_id", postId);
      formData.set("status", next);
      formData.set("reason", reason);
      const result = await setFeedbackStatusAction(formData);
      if (result?.ok) {
        setReason("");
        toast.success(`Estado: ${FEEDBACK_STATUS_LABEL[next]}`);
      } else toast.error(result?.message ?? "No se pudo cambiar el estado");
    });
  }

  return (
    <div className="surface flex flex-col gap-3 p-4">
      <p className="text-sm font-medium">Estado (solo lo cambia el equipo)</p>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={next} onChange={(e) => setNext(e.target.value as FeedbackStatus)} aria-label="Estado">
          {FEEDBACK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {FEEDBACK_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <Button type="button" size="sm" onClick={apply} disabled={pending || next === status}>
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Cambiar
        </Button>
      </div>
      {next !== status ? (
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={
            next === "no_por_ahora" ? "Motivo (obligatorio): se envía como respuesta" : "Mensaje opcional: se envía como respuesta"
          }
          rows={2}
          maxLength={FEEDBACK_BODY_MAX}
        />
      ) : null}
    </div>
  );
}
