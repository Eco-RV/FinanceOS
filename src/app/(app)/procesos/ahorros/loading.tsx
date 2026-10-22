import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton title="Ahorros y metas" back={{ href: "/procesos", label: "Procesos" }} action stats={2} rows={3} />;
}
