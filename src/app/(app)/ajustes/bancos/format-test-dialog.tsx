"use client";

import { FlaskConical, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
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
import { formatCurrency } from "@/lib/format";
import { useFormatDate } from "@/components/date-format";
import type { FormatTrial } from "@/lib/mail/parsers/try-format";
import { testBankFormat } from "./mail-actions";

/**
 * 3.3.0: pegar un aviso del banco y ver qué lee su formato. Sirve para
 * confirmar si la plantilla cambió antes de tocar el código.
 */
export function FormatTestDialog({ bankName, parserKey }: { bankName: string; parserKey: string }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [subject, setSubject] = useState("");
  const [trial, setTrial] = useState<FormatTrial | null>(null);
  const [pending, start] = useTransition();
  const formatDate = useFormatDate();

  function run(e: React.FormEvent) {
    e.preventDefault();
    start(async () => setTrial(await testBankFormat({ parser_key: parserKey, content, subject })));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTrial(null);
      }}
    >
      <DialogTrigger render={<Button variant="ghost" size="icon" aria-label={`Probar formato de ${bankName}`} title="Probar formato" />}>
        <FlaskConical className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Probar formato · {bankName}</DialogTitle>
          <DialogDescription>
            Abre un aviso de compra en tu correo, copia su contenido (o el HTML
            con &quot;Mostrar original&quot;) y pégalo aquí. No se guarda nada.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={run} className="flex flex-col gap-4">
          <FormField label="Asunto (opcional)" htmlFor="trial-subject">
            <Input
              id="trial-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Notificación de transacción … 04-10-2026 - 18:38"
            />
          </FormField>
          <FormField label="Contenido del aviso" htmlFor="trial-content">
            <Textarea
              id="trial-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="max-h-60 font-mono text-xs md:text-xs"
              placeholder={"Comercio:\nWALMART GUADALUPE\nMonto:\nCRC 22,920.00\n…"}
              required
            />
          </FormField>

          {trial ? (
            trial.ok ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-xl border border-success/30 bg-success/5 p-3 text-sm">
                <dt className="col-span-2 mb-1 font-medium text-success">El formato entendió el aviso</dt>
                <dt className="text-muted-foreground">Comercio</dt>
                <dd>{trial.parsed.merchant}</dd>
                <dt className="text-muted-foreground">Monto</dt>
                <dd>{formatCurrency(trial.parsed.amount, trial.parsed.currency)}</dd>
                <dt className="text-muted-foreground">Fecha</dt>
                <dd>{formatDate(trial.parsed.occurredOn)}</dd>
                <dt className="text-muted-foreground">Tarjeta</dt>
                <dd>{trial.parsed.lastFour ? `•••• ${trial.parsed.lastFour}` : "No se encontró"}</dd>
                <dt className="text-muted-foreground">Autorización</dt>
                <dd>{trial.parsed.authorization ?? "—"}</dd>
              </dl>
            ) : (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <p className="font-medium text-destructive">{trial.reason}</p>
                {trial.labels.length > 0 ? (
                  <>
                    <p className="mt-2 text-muted-foreground">Etiquetas que sí encontró:</p>
                    <ul className="mt-1 max-h-40 overflow-auto font-mono text-xs">
                      {trial.labels.map((l) => (
                        <li key={l} className="truncate">{l}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            )
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={pending || !content.trim()}>
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Probar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
