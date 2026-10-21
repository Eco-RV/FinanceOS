import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton title="Bandeja de comentarios" back={{ href: "/comentarios", label: "Comentarios" }} rows={6} />;
}
