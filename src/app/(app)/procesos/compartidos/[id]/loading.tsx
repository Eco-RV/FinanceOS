import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton back={{ href: "/procesos/compartidos", label: "Gastos compartidos" }} stats={2} rows={3} />;
}
