import { extractFields, htmlToLines } from "../html.ts";
import type { ParsedTransaction } from "../types.ts";
import { getParser } from "./index.ts";

export type FormatTrial =
  | { ok: true; parsed: ParsedTransaction }
  | { ok: false; reason: string; labels: string[] };

/**
 * 3.3.0 · "Probar formato": corre el formato de un banco sobre un aviso
 * pegado (HTML o texto). Si no lo entiende, devuelve las etiquetas que sí
 * encontró, para ver qué cambió en la plantilla sin desplegar nada.
 */
export function tryFormat(parserKey: string, content: string, subject = ""): FormatTrial {
  const parse = getParser(parserKey);
  if (!parse) return { ok: false, reason: "Ese formato no existe", labels: [] };

  const body = content.trim();
  if (!body) return { ok: false, reason: "Pega el contenido del aviso", labels: [] };

  const isHtml = /<\/?[a-z][\s\S]*>/i.test(body);
  const parsed = parse({
    id: "prueba",
    from: "",
    subject,
    html: isHtml ? body : null,
    text: isHtml ? null : body,
  });
  if (parsed) return { ok: true, parsed };

  const lines = isHtml ? htmlToLines(body) : body.split("\n").map((l) => l.trim());
  const labels = [...extractFields(lines).entries()].map(([k, v]) => `${k}: ${v}`).slice(0, 20);
  return {
    ok: false,
    reason: labels.some((l) => l.startsWith("tipo de transaccion:") && !/compra$/i.test(l))
      ? "Es un aviso, pero no de una compra (p. ej. un reverso): no genera gasto"
      : "El formato no reconoció este aviso",
    labels,
  };
}
