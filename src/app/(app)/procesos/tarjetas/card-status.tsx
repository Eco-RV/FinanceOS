import { Badge } from "@/components/ui/badge";
import type { CardStatementStatus } from "@/lib/cards";

const AMBER =
  "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";

const NEUTRAL_LABEL: Record<CardStatementStatus, string> = {
  "sin-movimientos": "Sin movimientos",
  "sin-saldo": "Sin saldo al corte",
  "al-dia": "Al día",
  pendiente: "Pendiente",
  atrasada: "Atrasada",
};

export function CardStatusBadge({
  status,
  daysToDue,
}: {
  status: CardStatementStatus;
  daysToDue?: number;
}) {
  if (status === "atrasada") {
    const late = daysToDue != null ? Math.abs(daysToDue) : null;
    return (
      <Badge variant="destructive">
        Atrasada{late != null ? ` ${late}d` : ""}
      </Badge>
    );
  }
  if (status === "pendiente") {
    return (
      <Badge variant="outline" className={AMBER}>
        Pendiente
      </Badge>
    );
  }
  if (status === "al-dia") {
    return <Badge variant="secondary">Al día</Badge>;
  }
  return (
    <Badge variant="secondary" className="text-muted-foreground">
      {NEUTRAL_LABEL[status]}
    </Badge>
  );
}
