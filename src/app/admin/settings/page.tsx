import { adminContext } from '@/server/admin/context';
import { AdminScreen, reasonField } from '@/components/admin/ui';
import { ActionForm } from '@/components/account/action-form';
import { settingsAction } from '@/server/admin/actions';
export default async function SettingsPage() {
  const { db } = await adminContext(),
    [s, c] = await Promise.all([
      db.storeSettings.findUniqueOrThrow({ where: { id: 'store' } }),
      db.checkoutSettings.findUniqueOrThrow({ where: { id: 'store' } }),
    ]);
  return (
    <AdminScreen
      title="Store settings"
      description="Changes appear on the storefront and affect new checkout quotes. Existing orders retain their snapshots. Saving invalidates current address approvals. Credentials and VAT activation cannot be edited here."
    >
      <div className="max-w-2xl">
        <ActionForm
          action={settingsAction}
          hidden={{ version: String(c.version), storeVersion: String(s.version) }}
          label="Save store settings"
          fields={[
            { name: 'phone', label: 'Contact phone', required: true, value: s.phone },
            {
              name: 'address',
              label: 'Shop address',
              required: true,
              value: s.address,
              maxLength: 240,
            },
            {
              name: 'weekdayOpen',
              label: 'Monday–Saturday opens',
              type: 'time',
              required: true,
              value: s.weekdayOpen,
            },
            {
              name: 'weekdayClose',
              label: 'Monday–Saturday closes',
              type: 'time',
              required: true,
              value: s.weekdayClose,
            },
            {
              name: 'sundayOpen',
              label: 'Sunday opens',
              type: 'time',
              required: true,
              value: s.sundayOpen,
            },
            {
              name: 'sundayClose',
              label: 'Sunday closes',
              type: 'time',
              required: true,
              value: s.sundayClose,
            },
            {
              name: 'announcement',
              label: 'Store announcement',
              value: s.announcement,
              maxLength: 240,
            },
            {
              name: 'about',
              label: 'Owner-approved About copy',
              type: 'textarea',
              value: s.about,
              required: true,
              minLength: 10,
              maxLength: 3000,
            },
            {
              name: 'collectionEnabled',
              label: 'Collection available',
              type: 'checkbox',
              checked: c.collectionEnabled,
            },
            {
              name: 'deliveryEnabled',
              label: 'Delivery available for explicitly approved addresses',
              type: 'checkbox',
              checked: c.deliveryEnabled,
            },
            {
              name: 'suspended',
              label: 'Suspend all new orders',
              type: 'checkbox',
              checked: c.suspended,
            },
            {
              name: 'cutoff',
              label: 'Nominal ordering cutoff (Johannesburg time)',
              type: 'time',
              required: true,
              value: c.cutoff,
            },
            {
              name: 'sameDayEnabled',
              label: 'Owner-approved same-day planning enabled',
              type: 'checkbox',
              checked: c.sameDayEnabled,
            },
            {
              name: 'sameDayCutoff',
              label: 'Same-day eligibility cutoff (also limited by closing time)',
              type: 'time',
              required: true,
              value: c.sameDayCutoff,
            },
            {
              name: 'dailyCapacity',
              label: 'Maximum planned orders per day (0 = no capacity promise; same-day disabled)',
              type: 'number',
              required: true,
              value: String(c.dailyCapacity),
            },
            {
              name: 'closedDates',
              label: 'Closed dates (YYYY-MM-DD, separated by commas)',
              type: 'textarea',
              value: c.closedDates.join(', '),
            },
            reasonField,
          ]}
        />
      </div>
    </AdminScreen>
  );
}
