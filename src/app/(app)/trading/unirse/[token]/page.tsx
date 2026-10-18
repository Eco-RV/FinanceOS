import { requireUser } from "@/lib/auth";
import { BackLink } from "@/components/back-link";
import { JoinView } from "./join-view";

/** Aceptar una invitación a la familia (3.0.0, D2: con sesión de Finance OS). */
export default async function JoinPage({ params }: PageProps<"/trading/unirse/[token]">) {
  await requireUser();
  const { token } = await params;
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <BackLink href="/trading" label="Constelación" />
      <JoinView token={token} />
    </div>
  );
}
