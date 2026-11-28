import { sortCategories } from '@/config/categories';
import { adminContext } from '@/server/admin/context';
import { AdminScreen, Panel, reasonField } from '@/components/admin/ui';
import { ActionForm } from '@/components/account/action-form';
import { categoryAction } from '@/server/admin/actions';
import type { Category } from '@/generated/prisma/client';
function Editor({ category: c }: { category?: Category }) {
  return (
    <ActionForm
      action={categoryAction}
      hidden={c ? { id: c.id } : {}}
      label="Save category"
      fields={[
        { name: 'name', label: 'Category name', required: true, value: c?.name },
        { name: 'slug', label: 'Category URL slug', required: true, value: c?.slug },
        { name: 'description', label: 'Description', type: 'textarea', value: c?.description },
        {
          name: 'active',
          label: 'Visible on the storefront',
          type: 'checkbox',
          checked: c?.active ?? true,
        },
        reasonField,
      ]}
    />
  );
}
export default async function CategoriesPage() {
  const { db } = await adminContext(),
    rows = await db.category.findMany({ orderBy: { position: 'asc' } });
  return (
    <AdminScreen
      title="Categories"
      description="Deactivate a category to hide its products without deleting their history."
    >
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel title="New category">
          <Editor />
        </Panel>
        {sortCategories(rows).map((c) => (
          <Panel key={c.id} title={c.name}>
            <Editor category={c} />
          </Panel>
        ))}
      </div>
    </AdminScreen>
  );
}
