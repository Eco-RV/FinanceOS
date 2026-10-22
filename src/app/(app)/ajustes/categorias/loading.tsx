import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton title="Categorías" back={{ href: "/ajustes", label: "Ajustes" }} action rows={8} />;
}
