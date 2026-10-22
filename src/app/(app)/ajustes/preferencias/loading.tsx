import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton title="Preferencias" back={{ href: "/ajustes", label: "Ajustes" }} narrow rows={3} />;
}
