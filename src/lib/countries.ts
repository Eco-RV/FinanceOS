/** Países del selector del perfil (2.6.0): código ISO alfa-2 y nombre en español. */
export const COUNTRIES: { code: string; name: string }[] = [
  { code: "CR", name: "Costa Rica" },
  { code: "AR", name: "Argentina" },
  { code: "BO", name: "Bolivia" },
  { code: "BR", name: "Brasil" },
  { code: "CA", name: "Canadá" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "CU", name: "Cuba" },
  { code: "DE", name: "Alemania" },
  { code: "DO", name: "República Dominicana" },
  { code: "EC", name: "Ecuador" },
  { code: "ES", name: "España" },
  { code: "FR", name: "Francia" },
  { code: "GB", name: "Reino Unido" },
  { code: "GT", name: "Guatemala" },
  { code: "HN", name: "Honduras" },
  { code: "IT", name: "Italia" },
  { code: "MX", name: "México" },
  { code: "NI", name: "Nicaragua" },
  { code: "PA", name: "Panamá" },
  { code: "PE", name: "Perú" },
  { code: "PR", name: "Puerto Rico" },
  { code: "PT", name: "Portugal" },
  { code: "PY", name: "Paraguay" },
  { code: "SV", name: "El Salvador" },
  { code: "US", name: "Estados Unidos" },
  { code: "UY", name: "Uruguay" },
  { code: "VE", name: "Venezuela" },
];

/** Bandera emoji a partir del código ("CR" → 🇨🇷). */
export function flagOf(code: string): string {
  return code
    .toUpperCase()
    .replace(/[A-Z]/g, (c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65));
}
