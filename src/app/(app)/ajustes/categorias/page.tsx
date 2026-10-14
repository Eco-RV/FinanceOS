import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Category, CategoryKind } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
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
          Las que usás al registrar gastos e ingresos.
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
            No tenés categorías de {title.toLowerCase()}.
          </p>
          <form action={seedCategories}>
            <input type="hidden" name="kind" value={kind} />
            <Button type="submit" variant="outline" size="sm">
              Cargar categorías sugeridas
            </Button>
          </form>
        </div>
      ) : (
        <div className="surface overflow-hidden">
          <Table>
            <TableBody>
              {items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="w-24">
                    <div className="flex justify-end gap-1">
                      <CategoryFormDialog kind={c.kind} category={c} />
                      <RemoveOrDeactivate
                        id={c.id}
                        label={`la categoría "${c.name}"`}
                        hasHistory={withHistory.has(c.id)}
                        onDelete={deleteCategory}
                        onSetActive={setCategoryActive}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
