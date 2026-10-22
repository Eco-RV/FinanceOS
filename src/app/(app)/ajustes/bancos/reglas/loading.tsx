import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton title="Reglas de comercio" back={{ href: "/ajustes/bancos", label: "Bancos" }} />;
}
