import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton title="Transferencias" back={{ href: "/procesos", label: "Procesos" }} action />;
}
