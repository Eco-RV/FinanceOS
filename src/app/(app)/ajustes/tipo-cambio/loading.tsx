import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton title="Tipo de cambio" back={{ href: "/ajustes", label: "Ajustes" }} action />;
}
