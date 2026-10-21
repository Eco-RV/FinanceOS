import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton title="Bancos" back={{ href: "/ajustes", label: "Ajustes" }} action rows={3} />;
}
