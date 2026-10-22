import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton title="Financiamientos" back={{ href: "/procesos/gastos", label: "Gastos" }} />;
}
