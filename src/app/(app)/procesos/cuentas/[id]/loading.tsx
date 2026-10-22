import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton back={{ href: "/procesos/cuentas", label: "Cuentas" }} variant="detail" stats={2} />;
}
