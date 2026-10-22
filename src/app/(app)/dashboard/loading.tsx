import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton title="Resumen" variant="dashboard" stats={3} rows={4} />;
}
