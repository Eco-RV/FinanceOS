import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton title="Cobros a miembros" back={{ href: "/procesos", label: "Procesos" }} />;
}
