"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, Sparkles } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { celebrate } from "@/lib/celebrate";
import { shortAddress } from "@/lib/stellar/format";
import { useWallet } from "@/components/stellar/wallet-context";
import { redeemInviteAction } from "../../actions";
import { clearPendingInvite, savePendingInvite } from "../../pending-invite";

/** Canjear una invitación con la wallet conectada. */
export function JoinView({ token }: { token: string }) {
  const { address } = useWallet();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | "guardian" | "member">(null);

  if (done) {
    return (
      <Card>
        <h1 className="text-xl font-semibold">¡Listo!</h1>
        <p className="text-sm text-muted-foreground">
          Quien te invitó ya ve tu wallet. En cuanto te agregue, entrarás a la familia como{" "}
          {done === "guardian" ? "guardián" : "miembro"}. Avísale para que lo haga.
        </p>
        <Link href="/trading/familia" className={buttonVariants({ size: "lg" })}>
          Ver mi familia
        </Link>
      </Card>
    );
  }

  if (!address) {
    return (
      <Card>
        <h1 className="text-xl font-semibold">Te invitaron a una familia</h1>
        <p className="text-sm text-muted-foreground">
          Primero conecta tu wallet en Constelación (con tu correo o Google). Te traemos de vuelta a
          esta invitación.
        </p>
        <Button
          size="lg"
          onClick={() => {
            savePendingInvite(token);
            router.push("/trading");
          }}
        >
          Conectar mi wallet
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold">Te invitaron a una familia</h1>
      <p className="text-sm text-muted-foreground">
        Al aceptar, quien te invitó verá tu dirección <code>{shortAddress(address, 6)}</code> para
        agregarte. Solo comparte esta dirección: nadie legítimo te pide tus códigos ni tus llaves.
      </p>
      <Button
        size="lg"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const r = await redeemInviteAction({ token, address });
          setPending(false);
          if (!r.ok) return setError(r.message);
          clearPendingInvite();
          celebrate("Invitación aceptada", "Espera a que te agreguen");
          setDone(r.value.role);
        }}
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
        Aceptar la invitación
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="surface rise flex flex-col items-center gap-3 p-6 text-center">
      <Sparkles className="size-8 text-violet-500" />
      {children}
    </div>
  );
}
