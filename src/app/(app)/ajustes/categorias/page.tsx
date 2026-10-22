import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Category, CategoryKind } from "@/lib/types";
import { CategoryBadge } from "@/components/category-icon";
import { iconFor } from "@/lib/category-icon-keys";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";
import { InactiveList, RemoveOrDeactivate } from "@/components/catalog-actions";
import { idsWithHistory } from "@/lib/catalog-history";
import { repositories } from "@/infrastructure/container";
import { CategoryFormDialog } from "./category-form";
import { deleteCategory, seedCategories, setCategoryActive } from "./actions";

export default async function CategoriasPage() {
  await requireUser();

  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .order("name", { ascending: true });

  const all = (data ?? []) as Category[];
  const withHistory = await idsWithHistory(
    (await repositories()).categories,
    all.map((c) => c.id),
  );
  const categories = all.filter((c) => !c.archived);
  const inactive = all.filter((c) => c.archived);

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/ajustes" label="Ajustes" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Categorías</h1>
        <p className="text-sm text-muted-foreground">
          Las que usas al registrar gastos e ingresos.
        </p>
      </div>

      <CategorySection
        kind="expense"
        title="Gastos"
        items={categories.filter((c) => c.kind === "expense")}
        inactive={inactive.filter((c) => c.kind === "expense")}
        withHistory={withHistory}
      />
      <CategorySection
        kind="income"
        title="Ingresos"
        items={categories.filter((c) => c.kind === "income")}
        inactive={inactive.filter((c) => c.kind === "income")}
        withHistory={withHistory}
      />
    </div>
  );
}

function CategorySection({
  kind,
  title,
  items,
  inactive,
  withHistory,
}: {
  kind: CategoryKind;
  title: string;
  items: Category[];
  inactive: Category[];
  withHistory: Set<string>;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <CategoryFormDialog kind={kind} />
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-4">
          <p className="text-sm text-muted-foreground">
            No tienes categorías de {title.toLowerCase()}.
          </p>
          <form action={seedCategories}>
            <input type="hidden" name="kind" value={kind} />
            <Button type="submit" variant="outline" size="sm">
              Cargar categorías sugeridas
            </Button>
          </form>
        </div>
      ) : (
        // 2.5.0: una card por categoría, con su ícono.
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((c, i) => (
            <div
              key={c.id}
              className="surface rise flex items-center gap-3 py-2.5 pr-2 pl-3"
              style={{ ["--rise-i" as string]: Math.min(i, 12) }}
            >
              <CategoryBadge icon={iconFor(c)} />
              <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
              <div className="flex shrink-0 justify-end gap-1">
                <CategoryFormDialog kind={c.kind} category={c} />
                <RemoveOrDeactivate
                  id={c.id}
                  label={`la categoría "${c.name}"`}
                  hasHistory={withHistory.has(c.id)}
                  onDelete={deleteCategory}
                  onSetActive={setCategoryActive}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <InactiveList
        items={inactive.map((c) => ({
          id: c.id,
          name: c.name,
          hasHistory: withHistory.has(c.id),
        }))}
        noun="la categoría"
        onDelete={deleteCategory}
        onSetActive={setCategoryActive}
      />
    </section>
  );
}
