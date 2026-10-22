import type { DataCollection } from "@sentry/core";

/**
 * 3.2.0 · Fase 4: es una app de finanzas, así que Sentry no recoge nada del
 * usuario ni del request (cookies, cabeceras, cuerpos, parámetros): solo el
 * error, su traza y la ruta.
 */
export const SENTRY_DATA_COLLECTION: DataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
};
