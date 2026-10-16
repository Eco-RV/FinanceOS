import type { Plan } from "@/application";

export const KIND_LABEL: Record<Plan["kind"], string> = {
  salary: "Salario",
  subscription: "Gasto fijo",
  insurance: "Seguro",
};

export const FREQUENCY_LABEL: Record<Plan["frequency"], string> = {
  weekly: "Semanal",
  biweekly: "Bisemanal (cada 14 días)",
  semimonthly: "Quincenal (15 y último día)",
  monthly: "Mensual",
};
