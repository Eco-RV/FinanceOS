import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { categoryNames } from "@/lib/categories";
import { EXPENSE_CATEGORIES } from "@/lib/schema";
import { BackLink } from "@/components/back-link";
import { EmptyRows } from "@/components/row-list";
import { RuleRow } from "./rule-row";

/**
 * I6 (3.0.1): reglas de comercio. Al aprobar una compra importada, la app
 * aprende qué categoría le das a ese comercio; aquí se corrigen o se borran.
 */
export default async function MerchantRulesPage() {
  await requireUser();
  const supabase = await createClient();
  const [{ data }, { data: catData }] = await Promise.all([
    supabase
      .from("merchant_rules")
      .select("id, merchant_key, category")
      .eq("archived", false)
      .order("merchant_key", { ascending: true }),
    supabase.from("categories").select("name").eq("kind", "expense").eq("archived", false).order("name"),
  ]);
  const rules = (data ?? []) as { id: string; merchant_key: string; category: string }[];
  const categories = categoryNames(catData ?? [], EXPENSE_CATEGORIES);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <BackLink href="/ajustes/bancos" label="Bancos" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reglas de comercio</h1>
        <p className="text-sm text-muted-foreground">
          La categoría que la app sugiere para cada comercio de las compras importadas. Se aprende al
          aprobar un pendiente; aquí la cambias o la borras.
        </p>
      </div>
      {rules.length === 0 ? (
        <EmptyRows>Todavía no hay reglas: se crean al aprobar compras en Por confirmar.</EmptyRows>
      ) : (
        <ul className="surface flex flex-col divide-y">
          {rules.map((r) => (
            <RuleRow key={r.id} id={r.id} merchant={r.merchant_key} category={r.category} categories={categories} />
          ))}
        </ul>
      )}
    </div>
  );
}
