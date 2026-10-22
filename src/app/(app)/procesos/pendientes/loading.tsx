import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton title="Compras por confirmar" back={{ href: "/procesos", label: "Procesos" }} />;
}
