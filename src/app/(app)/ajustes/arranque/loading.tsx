import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton title="Arranque de 0" back={{ href: "/ajustes", label: "Ajustes" }} rows={4} />;
}
