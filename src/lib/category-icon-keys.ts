/**
 * Íconos de categoría (2.5.0): claves estables que se guardan en
 * `categories.icon`. El componente que las dibuja vive en
 * `src/components/category-icon.tsx`; este archivo no importa íconos para
 * poder usarse en la validación (Zod) y en el servidor.
 */

export const CATEGORY_ICON_KEYS = [
  "utensils",
  "coffee",
  "pizza",
  "salad",
  "shopping-cart",
  "shopping-bag",
  "store",
  "car",
  "fuel",
  "bus",
  "bike",
  "plane",
  "home",
  "sofa",
  "zap",
  "droplets",
  "wifi",
  "smartphone",
  "tv",
  "heart-pulse",
  "pill",
  "dumbbell",
  "graduation-cap",
  "book-open",
  "film",
  "popcorn",
  "gamepad",
  "music",
  "repeat",
  "shirt",
  "sparkles",
  "scissors",
  "gift",
  "paw-print",
  "baby",
  "users",
  "wrench",
  "shield",
  "receipt",
  "landmark",
  "credit-card",
  "piggy-bank",
  "briefcase",
  "laptop",
  "hand-coins",
  "percent",
  "trending-up",
  "banknote",
  "tag",
] as const;

export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number];

export function isCategoryIconKey(v: unknown): v is CategoryIconKey {
  return typeof v === "string" && (CATEGORY_ICON_KEYS as readonly string[]).includes(v);
}

/** Palabras clave (sin tildes, en minúscula) → ícono por defecto. */
const DEFAULTS: [RegExp, CategoryIconKey][] = [
  [/comida|restaur|almuerzo|cena|desayuno|aliment/, "utensils"],
  [/cafe|cafeteria/, "coffee"],
  [/super|mercado|abarrot|despensa/, "shopping-cart"],
  [/compra|ropa|tienda/, "shopping-bag"],
  [/transporte|uber|taxi|bus|peaje|parqueo/, "car"],
  [/gasolina|combustible/, "fuel"],
  [/viaje|vacacion|vuelo/, "plane"],
  [/vivienda|casa|alquiler|hogar|renta/, "home"],
  [/servicio|luz|electric/, "zap"],
  [/agua/, "droplets"],
  [/internet|wifi/, "wifi"],
  [/telefono|celular|plan/, "smartphone"],
  [/salud|medic|doctor|hospital/, "heart-pulse"],
  [/farmacia/, "pill"],
  [/gimnasio|gym|deporte/, "dumbbell"],
  [/educacion|universidad|colegio|curso|escuela/, "graduation-cap"],
  [/libro/, "book-open"],
  [/entreten|cine|ocio/, "film"],
  [/juego/, "gamepad"],
  [/musica/, "music"],
  [/suscrip|streaming|netflix|spotify/, "repeat"],
  [/belleza|cuidado|personal/, "sparkles"],
  [/regalo/, "gift"],
  [/mascota|perro|gato|veterin/, "paw-print"],
  [/bebe|hijo|ninos/, "baby"],
  [/familia/, "users"],
  [/mantenim|reparac/, "wrench"],
  [/seguro/, "shield"],
  [/impuesto|tramite/, "receipt"],
  [/banco|comision/, "landmark"],
  [/tarjeta/, "credit-card"],
  [/ahorro/, "piggy-bank"],
  [/salario|sueldo|trabajo/, "briefcase"],
  [/freelance|proyecto/, "laptop"],
  [/reembolso|cobro/, "hand-coins"],
  [/interes/, "percent"],
  [/inversion|dividend/, "trending-up"],
  [/prestamo/, "banknote"],
];

function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Ícono sugerido para una categoría sin ícono guardado (o recién creada). */
export function defaultIconFor(name: string): CategoryIconKey {
  const n = normalize(name);
  for (const [re, key] of DEFAULTS) if (re.test(n)) return key;
  return "tag";
}

/** El ícono guardado si es válido; si no, el sugerido por el nombre. */
export function iconFor(category: { name: string; icon?: string | null }): CategoryIconKey {
  return isCategoryIconKey(category.icon) ? category.icon : defaultIconFor(category.name);
}
