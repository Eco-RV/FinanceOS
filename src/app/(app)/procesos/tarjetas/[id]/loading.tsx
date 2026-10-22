import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton back={{ href: "/procesos/tarjetas", label: "Tarjetas" }} variant="detail" stats={3} />;
}
