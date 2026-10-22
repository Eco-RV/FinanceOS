/**
 * 3.2.0: interruptores por entorno (se fijan al compilar; sirven en servidor
 * y navegador).
 *
 * Constelación (Stellar testnet): solo con `NEXT_PUBLIC_FEATURE_CONSTELLATION=1`.
 * Apagada en producción hasta la 4.0.0: sin la variable no se ve la pestaña,
 * `/trading` responde 404 y no se cargan los SDK de Stellar.
 */
export const CONSTELLATION_ENABLED = process.env.NEXT_PUBLIC_FEATURE_CONSTELLATION === "1";
