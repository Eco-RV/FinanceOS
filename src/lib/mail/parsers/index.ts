import type { MailParser } from "../types.ts";
import { parseBac } from "./bac.ts";

/**
 * Registro de parsers por banco. Agregar un banco = un archivo nuevo en esta
 * carpeta + una línea aquí + su fixture y test. `banks.parser_key` apunta a
 * una de estas claves.
 */
export const PARSERS = {
  bac: { label: "BAC Credomatic", parse: parseBac },
} satisfies Record<string, { label: string; parse: MailParser }>;

export type ParserKey = keyof typeof PARSERS;

export const PARSER_KEYS = Object.keys(PARSERS) as [ParserKey, ...ParserKey[]];

export function getParser(key: string): MailParser | null {
  return key in PARSERS ? PARSERS[key as ParserKey].parse : null;
}
