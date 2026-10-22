import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton title="Verificar saldos" back={{ href: "/ajustes", label: "Ajustes" }} />;
}
