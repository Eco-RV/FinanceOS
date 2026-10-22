/**
 * 3.2.0 · Fase 2: enfoque y funciones por logros.
 *
 * Finance OS arranca con una sola promesa: **no pagar intereses en las
 * tarjetas** (núcleo: Resumen, Tarjetas, Cuentas, Gastos y el gasto rápido).
 * El resto son *funciones* que el usuario activa desde el catálogo o cuando la
 * app se las sugiere al cumplir un logro.
 *
 * - E1: el núcleo siempre se ve.
 * - E2: una función apagada no aparece en la navegación, pero su URL sigue
 *   funcionando (no se bloquea nada).
 * - E3: lo que el usuario elige manda. Si nunca eligió, una cuenta que ya
 *   usaba la app antes de la 3.2.0 tiene todo encendido (`legacy`); una nueva,
 *   solo el núcleo.
 * - E4: las sugerencias salen de los datos, de a una y se pueden descartar.
 * - E5: los primeros pasos salen de los datos (no se guarda el avance).
 */

export const FEATURE_KEYS = [
  "ingresos",
  "planes",
  "analisis",
  "financiamientos",
  "prestamos",
  "ahorros",
  "compartidos",
  "cobros",
  "gmail",
  "herramientas",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type Feature = {
  key: FeatureKey;
  label: string;
  /** Qué resuelve, en una línea. */
  pitch: string;
  /** Rutas que dejan de verse en la navegación cuando está apagada (E2). */
  routes: readonly string[];
  beta?: boolean;
};

export const FEATURES: readonly Feature[] = [
  {
    key: "ingresos",
    label: "Ingresos y transferencias",
    pitch: "Registra lo que entra a tus cuentas y mueve plata entre ellas.",
    routes: ["/procesos/ingresos", "/procesos/transferencias"],
  },
  {
    key: "planes",
    label: "Planes",
    pitch: "Tu salario y tus gastos fijos, para saber si te alcanza el mes.",
    routes: ["/procesos/planes"],
  },
  {
    key: "analisis",
    label: "Análisis de gastos",
    pitch: "En qué se te va la plata: por categoría y contra el período anterior.",
    routes: [],
  },
  {
    key: "financiamientos",
    label: "Financiamientos",
    pitch: "Compras a cuotas, a tasa 0 o con interés, con su plan de pagos.",
    routes: ["/procesos/financiamientos"],
  },
  {
    key: "prestamos",
    label: "Préstamos",
    pitch: "La cuota, el calendario y los intereses de tus préstamos.",
    routes: ["/procesos/prestamos"],
  },
  {
    key: "ahorros",
    label: "Ahorros y metas",
    pitch: "Metas con objetivo, avance y aportes.",
    routes: ["/procesos/ahorros"],
  },
  {
    key: "compartidos",
    label: "Gastos compartidos",
    pitch: "Pagas el total, lo divides y controlas quién ya te pagó.",
    routes: ["/procesos/compartidos"],
  },
  {
    key: "cobros",
    label: "Cobros a miembros",
    pitch: "Lo que tu familia te debe de cuotas y gastos compartidos, con avisos.",
    routes: ["/procesos/cobros", "/ajustes/miembros"],
  },
  {
    key: "gmail",
    label: "Importar desde Gmail",
    pitch: "Lee los avisos de compra de tu banco y te los deja por confirmar.",
    routes: ["/ajustes/bancos", "/procesos/pendientes"],
    beta: true,
  },
  {
    key: "herramientas",
    label: "Herramientas avanzadas",
    pitch: "Tipo de cambio a mano, verificar saldos y Arranque de 0.",
    routes: ["/ajustes/tipo-cambio", "/ajustes/saldos", "/ajustes/arranque"],
  },
];

/** Lo que se guarda en `profiles.preferences.features`. */
export type FeatureState = {
  /** Lo que el usuario activó (true) o apagó (false) a mano (E3). */
  choices: Partial<Record<FeatureKey, boolean>>;
  /** Ya usaba la app antes de la 3.2.0: sin elección, todo encendido. */
  legacy: boolean;
  /** Sugerencias que el usuario descartó (E4). */
  dismissed: FeatureKey[];
  /** Cerró la tarjeta de primeros pasos. */
  stepsClosed: boolean;
};

function isFeatureKey(value: unknown): value is FeatureKey {
  return (FEATURE_KEYS as readonly unknown[]).includes(value);
}

/**
 * Lee el estado guardado. `null` = todavía no hay estado (cuenta que entra por
 * primera vez a la 3.2.0): ver `initialFeatureState`.
 */
export function readFeatureState(raw: unknown): FeatureState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const choices: Partial<Record<FeatureKey, boolean>> = {};
  if (r.choices && typeof r.choices === "object") {
    for (const [key, value] of Object.entries(r.choices as Record<string, unknown>)) {
      if (isFeatureKey(key) && typeof value === "boolean") choices[key] = value;
    }
  }
  const dismissed = Array.isArray(r.dismissed) ? r.dismissed.filter(isFeatureKey) : [];
  return { choices, legacy: r.legacy === true, dismissed: [...new Set(dismissed)], stepsClosed: r.stepsClosed === true };
}

/** E3: estado inicial. Quien ya tenía cuentas o tarjetas sigue viendo todo. */
export function initialFeatureState(hasData: boolean): FeatureState {
  return { choices: {}, legacy: hasData, dismissed: [], stepsClosed: hasData };
}

export function isFeatureEnabled(state: FeatureState, key: FeatureKey): boolean {
  return state.choices[key] ?? state.legacy;
}

export function enabledFeatures(state: FeatureState): Set<FeatureKey> {
  return new Set(FEATURE_KEYS.filter((key) => isFeatureEnabled(state, key)));
}

/** E2: ¿esta ruta se muestra en la navegación? (el núcleo y lo que no es de una función, siempre). */
export function isRouteVisible(enabled: ReadonlySet<FeatureKey>, href: string): boolean {
  const owner = FEATURES.find((f) => f.routes.some((r) => href === r || href.startsWith(r + "/")));
  return !owner || enabled.has(owner.key);
}

export function setFeatureChoice(state: FeatureState, key: FeatureKey, on: boolean): FeatureState {
  return { ...state, choices: { ...state.choices, [key]: on } };
}

export function dismissSuggestion(state: FeatureState, key: FeatureKey): FeatureState {
  return state.dismissed.includes(key) ? state : { ...state, dismissed: [...state.dismissed, key] };
}

/** Lo que la app sabe del uso, para los logros y los primeros pasos. */
export type Usage = {
  cards: number;
  /** Cuentas de banco (corriente o ahorro), sin efectivo. */
  bankAccounts: number;
  /** Compras cargadas a una tarjeta. */
  cardExpenses: number;
  cardPayments: number;
  /** Todos los gastos. */
  expenses: number;
  financings: number;
};

export type Suggestion = { feature: FeatureKey; reason: string };

/**
 * E4: logros que sugieren una función, en orden de prioridad. Una función que
 * no tiene una señal clara en los datos (préstamos, compartidos, cobros) solo
 * se ofrece en el catálogo.
 */
const ACHIEVEMENTS: { feature: FeatureKey; reached: (u: Usage) => boolean; reason: string }[] = [
  {
    feature: "planes",
    reached: (u) => u.cardPayments >= 1,
    reason: "Ya registraste el pago de tu tarjeta. Con tu salario y tus gastos fijos sabrás si te alcanza el mes.",
  },
  {
    feature: "financiamientos",
    reached: (u) => u.financings >= 1,
    reason: "Tienes una compra a cuotas: mira su plan de pagos y cuánto te falta.",
  },
  {
    feature: "analisis",
    reached: (u) => u.expenses >= 10,
    reason: "Ya llevas 10 gastos. Mira en qué se te va la plata y compáralo con el mes anterior.",
  },
  {
    feature: "ingresos",
    reached: (u) => u.bankAccounts >= 2,
    reason: "Tienes más de una cuenta: registra lo que entra y lo que mueves entre ellas.",
  },
  {
    feature: "ahorros",
    reached: (u) => u.cardPayments >= 2,
    reason: "Ya pagaste dos cortes. ¿Le pones una meta a lo que ahorras?",
  },
];

export function nextSuggestion(state: FeatureState, usage: Usage): Suggestion | null {
  for (const a of ACHIEVEMENTS) {
    if (isFeatureEnabled(state, a.feature) || state.dismissed.includes(a.feature)) continue;
    if (a.reached(usage)) return { feature: a.feature, reason: a.reason };
  }
  return null;
}

export type FirstStepKey = "tarjeta" | "cuenta" | "compra" | "pago";
export type FirstStep = { key: FirstStepKey; done: boolean };

/** E5: el camino del primer uso, en orden; cada paso sale de los datos. */
export function firstSteps(usage: Usage): FirstStep[] {
  return [
    { key: "tarjeta", done: usage.cards > 0 },
    { key: "cuenta", done: usage.bankAccounts > 0 },
    { key: "compra", done: usage.cardExpenses > 0 },
    { key: "pago", done: usage.cardPayments > 0 },
  ];
}

/** ¿Se muestran los primeros pasos? Hasta que el usuario los cierre (también al terminarlos). */
export function showFirstSteps(state: FeatureState): boolean {
  return !state.stepsClosed;
}
