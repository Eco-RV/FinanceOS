import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton title="Mi cuenta" back={{ href: "/ajustes", label: "Ajustes" }} narrow rows={4} />;
}
