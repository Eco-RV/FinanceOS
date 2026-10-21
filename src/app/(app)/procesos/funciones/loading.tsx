import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton title="Más funciones" back={{ href: "/procesos", label: "Procesos" }} variant="index" rows={6} />;
}
