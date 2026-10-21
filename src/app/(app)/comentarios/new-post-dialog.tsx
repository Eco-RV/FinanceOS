"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import {
  FEEDBACK_BODY_MAX,
  FEEDBACK_KIND_HINT,
  FEEDBACK_KIND_LABEL,
  FEEDBACK_KINDS,
  FEEDBACK_TITLE_MAX,
  type FeedbackKind,
} from "@/domain";
import { cn } from "@/lib/utils";
import { createFeedbackAction } from "./actions";
import { KIND_ICON } from "./feedback-ui";

/** 3.2.0 (B1/B2/B4): escribir en el buzón. Al publicar, abre la conversación. */
export function NewPostDialog({ label = "Escribir" }: { label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>("experiencia");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(formData: FormData) {
    start(async () => {
      const result = await createFeedbackAction(undefined, formData);
      if (!result?.ok) {
        setMessage(result?.message ?? "No se pudo publicar");
        return;
      }
      setMessage(null);
      setOpen(false);
      toast.success("¡Gracias! Lo recibimos. Te respondemos aquí mismo.");
      if (result.warning) toast.warning(result.warning);
      if (result.id) router.push(`/comentarios/${result.id}`);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setMessage(null);
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <PenLine className="size-4" /> {label}
      </DialogTrigger>

      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cuéntanos</DialogTitle>
          <DialogDescription>
            Solo tú y el equipo de Finance OS lo leen. Va con tu nombre para poder responderte.
          </DialogDescription>
        </DialogHeader>

        {/* Con onSubmit (no `action`): si falla, React no vacía lo que se escribió. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(new FormData(e.currentTarget));
          }}
          className="flex flex-col gap-4"
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">¿De qué se trata?</legend>
            <div className="grid grid-cols-2 gap-2">
              {FEEDBACK_KINDS.map((k) => {
                const Icon = KIND_ICON[k];
                const checked = kind === k;
                return (
                  <label
                    key={k}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                      checked ? "border-primary bg-primary/5 font-medium" : "border-input hover:border-ring/60",
                    )}
                  >
                    <input
                      type="radio"
                      name="kind"
                      value={k}
                      checked={checked}
                      onChange={() => setKind(k)}
                      className="sr-only"
                    />
                    <Icon className="size-4 shrink-0" />
                    {FEEDBACK_KIND_LABEL[k]}
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">{FEEDBACK_KIND_HINT[kind]}</p>
          </fieldset>

          <FormField label="Título" htmlFor="feedback-title">
            <Input
              id="feedback-title"
              name="title"
              placeholder="En pocas palabras"
              minLength={3}
              maxLength={FEEDBACK_TITLE_MAX}
              required
            />
          </FormField>

          <FormField label="Mensaje" htmlFor="feedback-body">
            <Textarea
              id="feedback-body"
              name="body"
              placeholder="Cuéntanos con detalle: qué pasó, qué esperabas o qué te serviría."
              maxLength={FEEDBACK_BODY_MAX}
              rows={5}
              required
            />
          </FormField>

          <FormField label="Captura (opcional)" htmlFor="feedback-image" hint="JPG, PNG o WebP, hasta 5 MB.">
            <Input id="feedback-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" />
          </FormField>

          {message ? <p className="text-sm text-destructive">{message}</p> : null}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Enviando…" : "Enviar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
