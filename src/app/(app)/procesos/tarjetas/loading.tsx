import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton title="Tarjetas de crédito" back={{ href: "/procesos", label: "Procesos" }} action rows={3} />;
}
