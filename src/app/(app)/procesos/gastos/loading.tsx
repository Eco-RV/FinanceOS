import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton title="Gastos" back={{ href: "/procesos", label: "Procesos" }} action rows={6} />;
}
