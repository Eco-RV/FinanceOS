"use client";

import { useMemo } from "react";
import { Copy, QrCode } from "lucide-react";
import { renderSVG } from "uqr";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** Recibir: QR con mi dirección y botón copiar. */
export function ReceiveDialog({ address }: { address: string }) {
  const svg = useMemo(() => renderSVG(address, { ecc: "H", border: 1 }), [address]);
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="lg" className="h-12 flex-1" />}>
        <QrCode className="size-5" /> Recibir
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Recibir USDC</DialogTitle>
          <DialogDescription>
            Muestra este código o comparte tu dirección. Solo en la red de prueba (testnet).
          </DialogDescription>
        </DialogHeader>
        <div
          className="mx-auto w-56 rounded-xl bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
          aria-label="Código QR de tu dirección"
          role="img"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <code className="rounded-lg bg-muted p-2 text-center text-xs break-all">{address}</code>
        <Button
          onClick={() => {
            void navigator.clipboard.writeText(address);
            toast.success("Dirección copiada");
          }}
        >
          <Copy className="size-4" /> Copiar mi dirección
        </Button>
      </DialogContent>
    </Dialog>
  );
}
