import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/format";
import { BackLink } from "@/components/back-link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RateFormDialog } from "./rate-form";
import { OfficialRateButton } from "./official-rate-button";

type RateRow = { id: string; rate_on: string; usd_crc: number };

/**
 * Tipo de cambio (T2/T10): el más reciente se usa para el disponible de las
 * tarjetas y para pasar a colones lo de dólares en el Resumen (G7). Se trae del
 * BCCR una vez al día al abrir el Resumen, o a mano con "Traer del BCCR".
 */
export default async function TipoCambioPage() {
  await requireUser();

  const supabase = await createClient();
  const { data } = await supabase
    .from("exchange_rates")
    .select("id, rate_on, usd_crc")
    .eq("archived", false)
    .order("rate_on", { ascending: false })
    .limit(30);
  const rates = (data ?? []) as RateRow[];

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/ajustes" label="Ajustes" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tipo de cambio</h1>
          <p className="text-sm text-muted-foreground">
            Colones por dólar (venta de referencia del BCCR). Se usa el más reciente para el
            disponible de las tarjetas y para sumar lo de dólares en el Resumen. Se actualiza
            solo una vez al día al abrir el Resumen; también lo puedes digitar.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <OfficialRateButton />
          <RateFormDialog lastRate={rates[0] ? Number(rates[0].usd_crc) : undefined} />
        </div>
      </div>

      <div className="surface overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">₡ por $1</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="py-10 text-center text-muted-foreground">
                  Aún no registrás ningún tipo de cambio.
                </TableCell>
              </TableRow>
            ) : (
              rates.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {formatDate(r.rate_on)}
                    {i === 0 ? (
                      <span className="ml-2 text-xs text-muted-foreground">en uso</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(Number(r.usd_crc), "CRC")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
