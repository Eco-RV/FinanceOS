import { Badge } from "@/components/ui/badge";
import type { LoanStatus } from "@/domain";

/** L4: estado de un préstamo (al día, atrasado con N cuotas, pagado). */
export function LoanStatusBadge({ status, overdue }: { status: LoanStatus; overdue: number }) {
  if (status === "pagado") return <Badge variant="secondary">Pagado</Badge>;
  if (status === "atrasado") {
    return (
      <Badge variant="destructive">
        Atrasado · {overdue} cuota{overdue === 1 ? "" : "s"}
      </Badge>
    );
  }
  return <Badge variant="outline">Al día</Badge>;
}
