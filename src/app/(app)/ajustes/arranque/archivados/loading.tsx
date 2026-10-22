import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton title="Movimientos archivados" back={{ href: "/ajustes/arranque", label: "Arranque de 0" }} />;
}
