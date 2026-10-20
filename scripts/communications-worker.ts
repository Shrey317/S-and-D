import { loadLocalEnvironment, toolingDatabase } from './database-tools';
import { parseServerEnv } from '../src/config/env.schema';
import { runMailBatch } from '../src/server/communications/worker';
import { resendSender } from '../src/server/communications/provider';
loadLocalEnvironment();
const env = parseServerEnv(process.env);
if (!env.COMMUNICATIONS_DATABASE_URL)
  throw new Error('Configure the restricted communications database.');
const db = toolingDatabase(env.COMMUNICATIONS_DATABASE_URL);
try {
  console.log(
    await runMailBatch(
      db,
      {
        enabled: env.EMAIL_ENABLED,
        capture: env.EMAIL_CAPTURE_ENABLED,
        siteUrl: env.NEXT_PUBLIC_SITE_URL,
        from: env.EMAIL_FROM,
        adminEmail: env.ADMIN_NOTIFICATION_EMAIL,
      },
      env.EMAIL_ENABLED
        ? resendSender(env.RESEND_API_KEY!)
        : async () => {
            throw new Error('External mail disabled');
          },
    ),
  );
} finally {
  await db.$disconnect();
}
