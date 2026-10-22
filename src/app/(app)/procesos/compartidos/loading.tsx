import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton title="Gastos compartidos" back={{ href: "/procesos", label: "Procesos" }} action />;
}
