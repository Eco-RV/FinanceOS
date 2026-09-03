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
