"use client";

import { useTransition } from "react";
import { Archive, ArchiveRestore, LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { confirmAction } from "@/lib/confirm";
import { deleteGoalAction, setGoalActiveAction } from "./actions";

/** Archivar (o recuperar) y eliminar una meta. Ninguna toca la cuenta. */
export function GoalControls({ id, name, archived }: { id: string; name: string; archived: boolean }) {
  const [pending, start] = useTransition();

  function run(action: (fd: FormData) => Promise<{ ok: boolean; message?: string } | undefined>, fd: FormData, done: string) {
    start(async () => {
      const r = await action(fd);
      if (r?.ok) toast.success(done);
      else toast.error((r && "message" in r && r.message) || "No se pudo completar");
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={pending}
        aria-label={archived ? "Recuperar" : "Archivar"}
        title={archived ? "Recuperar" : "Archivar"}
        onClick={async () => {
          if (
            !archived &&
            !(await confirmAction({
              title: `¿Archivar "${name}"?`,
              description: "Sale de la lista de metas activas. La cuenta y su saldo no cambian.",
              confirmLabel: "Archivar",
              tone: "warning",
              icon: "archive",
            }))
          )
            return;
          const fd = new FormData();
          fd.set("id", id);
          fd.set("active", String(archived));
          run(setGoalActiveAction, fd, archived ? "Meta recuperada" : "Meta archivada");
        }}
      >
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : archived ? (
          <ArchiveRestore className="size-4" />
        ) : (
          <Archive className="size-4" />
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={pending}
        aria-label="Eliminar"
        title="Eliminar"
        onClick={async () => {
          if (
            !(await confirmAction({
              title: `¿Eliminar "${name}"?`,
              description: "Se borra la meta. La cuenta, su saldo y los aportes se conservan.",
              confirmLabel: "Eliminar",
              tone: "danger",
              icon: "delete",
            }))
          )
            return;
          const fd = new FormData();
          fd.set("id", id);
          run(deleteGoalAction, fd, "Meta eliminada");
        }}
      >
        <Trash2 className="size-4" />
      </Button>
    </>
  );
}
