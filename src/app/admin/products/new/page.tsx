import { sortCategories } from '@/config/categories';
import { adminContext } from '@/server/admin/context';
import { AdminScreen } from '@/components/admin/ui';
import { ProductEditor } from '@/components/admin/product-editor';
export default async function NewProduct() {
  const { db } = await adminContext();
  return (
    <AdminScreen title="New product">
      <div className="max-w-2xl">
        <ProductEditor categories={sortCategories(await db.category.findMany())} />
      </div>
    </AdminScreen>
  );
}
