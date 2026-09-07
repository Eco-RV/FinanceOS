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
import { DeleteButton } from "@/components/delete-button";
import { CategoryFormDialog } from "./category-form";
import { deleteCategory, seedCategories } from "./actions";

export default async function CategoriasPage() {
  await requireUser();

  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("archived", false)
    .order("name", { ascending: true });

  const categories = (data ?? []) as Category[];

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/ajustes" label="Ajustes" />
      <div>
        <h1 className="text-2xl font-semibold">Categorías</h1>
        <p className="text-sm text-muted-foreground">
          Las que usás al registrar gastos e ingresos.
        </p>
      </div>

      <CategorySection
        kind="expense"
        title="Gastos"
        items={categories.filter((c) => c.kind === "expense")}
      />
      <CategorySection
        kind="income"
        title="Ingresos"
        items={categories.filter((c) => c.kind === "income")}
      />
    </div>
  );
}

function CategorySection({
  kind,
  title,
  items,
}: {
  kind: CategoryKind;
  title: string;
  items: Category[];
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-medium">{title}</h2>
        <CategoryFormDialog kind={kind} />
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-4">
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
        <div className="rounded-lg border">
          <Table>
            <TableBody>
              {items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="w-24">
                    <div className="flex justify-end gap-1">
                      <CategoryFormDialog kind={c.kind} category={c} />
                      <DeleteButton
                        id={c.id}
                        action={deleteCategory}
                        confirmLabel={`¿Eliminar la categoría "${c.name}"?`}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
