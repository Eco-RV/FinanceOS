const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  Ntilde: "Ñ",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code =
        e[1].toLowerCase() === "x"
          ? parseInt(e.slice(2), 16)
          : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

/**
 * HTML → líneas de texto. Cada celda/fila/bloque termina en salto de línea,
 * así una tabla "Etiqueta | Valor" queda como dos líneas consecutivas.
 */
export function htmlToLines(html: string): string[] {
  const text = html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(td|th|tr|p|div|li|h[1-6]|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(text)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** minúsculas, sin acentos ni ":" final: clave estable para comparar etiquetas. */
export function normalizeLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/:\s*$/, "")
    .trim();
}

/**
 * Pares etiqueta → valor desde las líneas de un correo. Soporta tanto
 * "Etiqueta:" + línea siguiente como "Etiqueta: valor" en la misma línea.
 */
export function extractFields(lines: string[]): Map<string, string> {
  const fields = new Map<string, string>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const colon = line.indexOf(":");
    if (colon <= 0 || colon > 40) continue;

    const key = normalizeLabel(line.slice(0, colon));
    let value = line.slice(colon + 1).trim();
    if (!value && i + 1 < lines.length) value = lines[i + 1];
    if (value && !fields.has(key)) fields.set(key, value);
  }
  return fields;
}

/**
 * "22,920.00" · "22.920,00" · "22920" → número. El último separador que
 * aparezca se toma como decimal si va seguido de 1-2 dígitos.
 */
export function parseAmount(raw: string): number | null {
  const s = raw.replace(/[^\d.,]/g, "");
  if (!s) return null;

  const lastSep = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  let normalized: string;
  if (lastSep >= 0 && s.length - lastSep - 1 <= 2) {
    normalized =
      s.slice(0, lastSep).replace(/[.,]/g, "") + "." + s.slice(lastSep + 1);
  } else {
    normalized = s.replace(/[.,]/g, "");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
