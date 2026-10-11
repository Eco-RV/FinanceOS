/**
 * Clave estable de un comercio para reglas de categoría: minúsculas, sin
 * acentos y sin los tokens finales que llevan dígitos (códigos de sucursal,
 * "WCN0"). "WALMART GUADALUPE WCN0" → "walmart guadalupe".
 */
export function merchantKey(merchant: string): string {
  const tokens = merchant
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  while (tokens.length > 1 && /\d/.test(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(" ").slice(0, 80);
}
