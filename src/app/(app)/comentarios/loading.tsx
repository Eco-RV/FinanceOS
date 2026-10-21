import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton title="Comentarios" back={{ href: "/ajustes", label: "Ajustes" }} action narrow rows={4} />;
}
