import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton back={{ href: "/procesos/prestamos", label: "Préstamos" }} stats={3} rows={6} />;
}
