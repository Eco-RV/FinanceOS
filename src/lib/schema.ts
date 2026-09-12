import { z } from "zod";

export const ACCOUNT_TYPES = ["checking", "savings", "cash"] as const;
export const CURRENCIES = ["CRC", "USD"] as const;

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

export const accountSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(80),
  type: z.enum(ACCOUNT_TYPES),
  institution: optionalText,
  currency: z.enum(CURRENCIES),
  current_balance: z.coerce.number().finite("Monto inválido"),
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
  current_balance: z.coerce.number().finite("Monto inválido"),
  currency: z.enum(CURRENCIES),
});

export type AccountInput = z.infer<typeof accountSchema>;
export type CreditCardInput = z.infer<typeof creditCardSchema>;

// ─────────────────────────────  movimientos  ─────────────────────────────

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
    if (val.type !== "card_payment" && !val.category) {
      ctx.addIssue({
        path: ["category"],
        code: "custom",
        message: "Elegí una categoría",
      });
    }
  });

export type TransactionInput = z.infer<typeof transactionSchema>;

export const categorySchema = z.object({
  kind: z.enum(CATEGORY_KINDS),
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(40, "Máximo 40 caracteres"),
});

export type CategoryInput = z.infer<typeof categorySchema>;

// ─────────────────────────────  financiamientos  ─────────────────────────────

export const financingSchema = z.object({
  card_id: z.string().regex(/^[0-9a-fA-F-]{36}$/, "Tarjeta inválida"),
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
  total_amount: z.coerce
    .number()
    .finite("Monto inválido")
    .positive("El monto debe ser mayor que cero"),
  months: z.coerce
    .number()
    .int()
    .min(2, "Mínimo 2 cuotas")
    .max(48, "Máximo 48 cuotas"),
  first_charge_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
});

export type FinancingInput = z.infer<typeof financingSchema>;
