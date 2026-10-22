import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton title="Planes" back={{ href: "/procesos", label: "Procesos" }} action stats={2} />;
}
