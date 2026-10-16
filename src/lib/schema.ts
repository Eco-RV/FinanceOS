import { z } from "zod";
import { PARSER_KEYS } from "./mail/parsers/index.ts";
import { CURRENCIES } from "../domain/shared/money.ts";
import { CATEGORY_ICON_KEYS } from "./category-icon-keys.ts";

export { CURRENCIES };
export const ACCOUNT_TYPES = ["checking", "savings", "cash"] as const;

const optionalText = z
  .string()
  .trim()
  .max(80)
  .optional()
  .transform((v) => (v ? v : null));

/** Empty string / null -> null, otherwise a non-negative number. */
const optionalAmount = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.coerce.number().nonnegative().nullable(),
);

/**
 * Saldo inicial (C1): se guarda como un movimiento `opening_balance`, no en
 * `current_balance`. Monto con signo; vacío = 0 (sin saldo inicial).
 */
const openingFields = {
  opening_amount: z.preprocess(
    (v) => (v === "" || v == null ? 0 : v),
    z.coerce.number().finite("Monto inválido"),
  ),
  opening_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
};

export const accountSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(80),
  type: z.enum(ACCOUNT_TYPES),
  institution: optionalText,
  currency: z.enum(CURRENCIES),
  ...openingFields,
});

export const creditCardSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(80),
  institution: optionalText,
  last_four: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Deben ser 4 dígitos")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  bank_id: z
    .string()
    .regex(/^[0-9a-fA-F-]{36}$/, "Banco inválido")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  credit_limit: optionalAmount,
  cutoff_day: z.coerce
    .number()
    .int()
    .min(1, "Día 1-31")
    .max(31, "Día 1-31"),
  payment_due_day: z.coerce
    .number()
    .int()
    .min(1, "Día 1-31")
    .max(31, "Día 1-31"),
  /** Moneda del límite de crédito (T2). La tarjeta acepta cargos en CRC y USD (T1). */
  currency: z.enum(CURRENCIES),
  /** Saldo inicial por moneda (T1); vacío = 0. */
  opening_crc: openingFields.opening_amount,
  opening_usd: openingFields.opening_amount,
  opening_date: openingFields.opening_date,
});

export type AccountInput = z.infer<typeof accountSchema>;
export type CreditCardInput = z.infer<typeof creditCardSchema>;

// ─────────────────────────────  movimientos  ─────────────────────────────

/** Tipos que se registran desde el formulario de movimientos. El saldo inicial
 * (`opening_balance`) se gestiona desde el formulario de cuenta o tarjeta. */
export const TRANSACTION_TYPES = ["expense", "income", "card_payment"] as const;

export const CATEGORY_KINDS = ["expense", "income"] as const;

/** Lista sugerida / fallback cuando el usuario aún no configuró categorías. */
export const EXPENSE_CATEGORIES = [
  "Comida",
  "Transporte",
  "Servicios",
  "Vivienda",
  "Salud",
  "Entretenimiento",
  "Compras",
  "Educación",
  "Suscripciones",
  "Otros",
] as const;

export const INCOME_CATEGORIES = [
  "Salario",
  "Freelance",
  "Reembolso",
  "Intereses",
  "Regalo",
  "Otros",
] as const;

/** Nota libre, opcional, hasta 200 caracteres. */
const optionalNote = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => (v ? v : null));

/** "account:<uuid>" | "card:<uuid>" desde el <select> de origen. */
const originToken = z
  .string()
  .regex(/^(account|card):[0-9a-fA-F-]{36}$/, "Elegí un origen");

export const transactionSchema = z
  .object({
    type: z.enum(TRANSACTION_TYPES),
    amount: z.coerce
      .number()
      .finite("Monto inválido")
      .positive("El monto debe ser mayor que cero"),
    occurred_on: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
    category: z
      .string()
      .trim()
      .max(40)
      .optional()
      .transform((v) => (v ? v : null)),
    note: optionalNote,
    origin: originToken,
    // Moneda de un cargo con tarjeta (T1). En cuentas manda la de la cuenta.
    currency: z
      .enum(CURRENCIES)
      .optional()
      .or(z.literal(""))
      .transform((v) => (v ? v : null)),
    // SINPE (gasto desde cuenta): canal + destinatario/teléfono opcionales.
    channel: z
      .enum(["sinpe"])
      .optional()
      .or(z.literal(""))
      .transform((v) => (v ? v : null)),
    counterparty_name: z
      .string()
      .trim()
      .max(80)
      .optional()
      .transform((v) => (v ? v : null)),
    counterparty_phone: z
      .string()
      .trim()
      .max(20)
      .optional()
      .transform((v) => (v ? v : null)),
    // Presente solo para card_payment (hidden input con la tarjeta de la ruta).
    card_id: z
      .string()
      .regex(/^[0-9a-fA-F-]{36}$/, "Tarjeta inválida")
      .optional()
      .or(z.literal(""))
      .transform((v) => (v ? v : null)),
  })
  .superRefine((val, ctx) => {
    const kind = val.origin.split(":")[0];

    if (val.type === "income" && kind !== "account") {
      ctx.addIssue({
        path: ["origin"],
        code: "custom",
        message: "El ingreso debe entrar a una cuenta",
      });
    }
    if (val.type === "card_payment") {
      if (kind !== "account") {
        ctx.addIssue({
          path: ["origin"],
          code: "custom",
          message: "El pago sale de una cuenta de débito",
        });
      }
      if (!val.card_id) {
        ctx.addIssue({
          path: ["card_id"],
          code: "custom",
          message: "Falta la tarjeta",
        });
      }
    }
    if (val.channel === "sinpe" && (val.type !== "expense" || kind !== "account")) {
      ctx.addIssue({
        path: ["origin"],
        code: "custom",
        message: "El SINPE sale de una cuenta de débito",
      });
    }
    if (val.type !== "card_payment" && !val.category) {
      ctx.addIssue({
        path: ["category"],
        code: "custom",
        message: "Elegí una categoría",
      });
    }
  });

export type TransactionInput = z.infer<typeof transactionSchema>;

const accountId = z.string().regex(/^[0-9a-fA-F-]{36}$/, "Elegí una cuenta");

/** Transferencia entre cuentas propias (M2). */
export const transferSchema = z
  .object({
    from_account_id: accountId,
    to_account_id: accountId,
    amount: z.coerce
      .number()
      .finite("Monto inválido")
      .positive("El monto debe ser mayor que cero"),
    occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
    note: optionalNote,
  })
  .refine((v) => v.from_account_id !== v.to_account_id, {
    path: ["to_account_id"],
    message: "Elegí una cuenta distinta a la de origen",
  });

export const categorySchema = z.object({
  kind: z.enum(CATEGORY_KINDS),
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(40, "Máximo 40 caracteres"),
  // 2.5.0: ícono del kit; vacío = el sugerido por el nombre.
  icon: z
    .enum(CATEGORY_ICON_KEYS)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
});

export type CategoryInput = z.infer<typeof categorySchema>;

// ─────────────────────────────  financiamientos  ─────────────────────────────

const financingText = {
  description: z
    .string()
    .trim()
    .min(1, "La descripción es obligatoria")
    .max(80),
  category: z
    .string()
    .trim()
    .min(1, "Elegí una categoría")
    .max(40),
};

export const financingSchema = z.object({
  card_id: z.string().regex(/^[0-9a-fA-F-]{36}$/, "Tarjeta inválida"),
  ...financingText,
  total_amount: z.coerce
    .number()
    .finite("Monto inválido")
    .positive("El monto debe ser mayor que cero"),
  annual_rate: z.preprocess(
    (v) => (v === "" || v == null ? 0 : v),
    z.coerce
      .number()
      .finite("Tasa inválida")
      .min(0, "La tasa no puede ser negativa")
      .max(100, "Máximo 100 %"),
  ),
  months: z.coerce
    .number()
    .int()
    .min(2, "Mínimo 2 cuotas")
    .max(72, "Máximo 72 cuotas"),
  first_charge_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
});

/** F9: lo único que se edita de un financiamiento. */
export const financingEditSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F-]{36}$/, "Financiamiento inválido"),
  ...financingText,
});

export type FinancingInput = z.infer<typeof financingSchema>;

// ─────────────────────────────  préstamos  ─────────────────────────────

const uuid = (message: string) => z.string().regex(/^[0-9a-fA-F-]{36}$/, message);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");
const optionalLender = z
  .string()
  .trim()
  .max(60, "Máximo 60 caracteres")
  .optional()
  .transform((v) => v || null);
const optionalAccount = z
  .string()
  .optional()
  .transform((v) => v || null)
  .pipe(uuid("Cuenta inválida").nullable());

export const loanSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio").max(60),
    lender: optionalLender,
    currency: z.enum(CURRENCIES),
    principal: z.coerce
      .number()
      .finite("Monto inválido")
      .positive("El monto debe ser mayor que cero"),
    annual_rate: z.coerce
      .number()
      .finite("Tasa inválida")
      .min(0, "La tasa no puede ser negativa")
      .max(100, "Máximo 100 %"),
    months: z.coerce
      .number()
      .int("Meses enteros")
      .min(1, "Mínimo 1 mes")
      .max(480, "Máximo 480 meses"),
    first_payment_on: isoDate,
    account_id: optionalAccount,
    disbursement_account_id: optionalAccount,
    disbursement_on: isoDate.optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    if (v.disbursement_account_id && !v.disbursement_on) {
      ctx.addIssue({ code: "custom", path: ["disbursement_on"], message: "Indicá la fecha del desembolso" });
    }
  });

export const loanRenameSchema = z.object({
  id: uuid("Préstamo inválido"),
  name: z.string().trim().min(1, "El nombre es obligatorio").max(60),
  lender: optionalLender,
  account_id: optionalAccount,
});

export const loanPaymentSchema = z.object({
  loan_id: uuid("Préstamo inválido"),
  account_id: uuid("Elegí una cuenta"),
  occurred_on: isoDate,
});

// ─────────────────────────────  bancos  ─────────────────────────────

/** "a@x.cr, B@y.cr" (o una por línea) → ["a@x.cr", "b@y.cr"], sin duplicados. */
const senderList = z
  .string()
  .transform((v) =>
    [...new Set(v.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()))].filter(
      Boolean,
    ),
  )
  .pipe(
    z
      .array(z.email("Correo inválido"))
      .min(1, "Agregá al menos un remitente")
      .max(10, "Máximo 10 remitentes"),
  );

export const bankSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(60),
  sender_emails: senderList,
  parser_key: z.enum(PARSER_KEYS, "Elegí un formato"),
  enabled: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

export type BankInput = z.infer<typeof bankSchema>;

// ─────────────────────────────  miembros (2.3.0)  ─────────────────────────────

/** Teléfono para WhatsApp: solo dígitos; 8 dígitos se toman como de Costa Rica (506). */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 8 ? `506${digits}` : digits;
}

export const memberSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(60, "Máximo 60 caracteres"),
  email: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(z.email("Correo inválido").nullable()),
  phone: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? normalizePhone(v) : null))
    .pipe(
      z
        .string()
        .regex(/^\d{8,15}$/, "Teléfono inválido (8 dígitos, o con código de país)")
        .nullable(),
    ),
});

export const REIMBURSEMENT_CHANNEL_LABELS = {
  sinpe: "SINPE",
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  otro: "Otro",
} as const;

export const reimbursementSchema = z.object({
  financing_id: uuid("Financiamiento inválido"),
  member_id: uuid("Miembro inválido"),
  installment_no: z.coerce.number().int().min(1),
  paid_on: isoDate,
  channel: z.enum(["sinpe", "efectivo", "transferencia", "otro"]),
  note: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : null)),
});

// ─────────────────────────────  planes y metas (2.7.0)  ─────────────────────────────

const planDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");
const optionalDate = planDate
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null));

export const PLAN_KIND_VALUES = ["salary", "subscription", "insurance"] as const;
export const FREQUENCY_VALUES = ["weekly", "biweekly", "semimonthly", "monthly"] as const;

export const planSchema = z.object({
  kind: z.enum(PLAN_KIND_VALUES),
  name: z.string().trim().min(1, "Ponle un nombre").max(60, "Hasta 60 caracteres"),
  amount: z.coerce.number().finite("Monto inválido").positive("El monto debe ser mayor que cero"),
  currency: z.enum(CURRENCIES),
  frequency: z.enum(FREQUENCY_VALUES).optional().default("monthly"),
  starts_on: planDate,
  ends_on: optionalDate,
  target: z.string().regex(/^(account|card):[0-9a-fA-F-]{36}$/, "Elige dónde entra o se cobra"),
  category: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v ? v : null)),
  note: optionalNote,
});

export type PlanInput = z.infer<typeof planSchema>;

export const goalSchema = z.object({
  name: z.string().trim().min(1, "Ponle un nombre").max(60, "Hasta 60 caracteres"),
  target_amount: z.coerce.number().finite("Monto inválido").positive("El objetivo debe ser mayor que cero"),
  currency: z.enum(CURRENCIES),
  target_date: optionalDate,
  account_id: z
    .string()
    .regex(/^[0-9a-fA-F-]{36}$/)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  icon: z
    .enum(CATEGORY_ICON_KEYS)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
});

export type GoalInput = z.infer<typeof goalSchema>;
