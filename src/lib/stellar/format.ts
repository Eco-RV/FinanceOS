/** "GABCD…WXYZ": dirección corta para mostrar (nunca para copiar). */
export function shortAddress(address: string, size = 4): string {
  return address.length > size * 2 + 1 ? `${address.slice(0, size)}…${address.slice(-size)}` : address;
}

/** "$12,34" con el formato de la app (USDC ≈ USD). */
export function formatUsdc(amount: number): string {
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
