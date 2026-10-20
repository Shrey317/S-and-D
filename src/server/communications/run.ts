import 'server-only';
import { serverEnv } from '@/config/env.server';
import { getCommunicationsDatabase } from '@/server/db/communications-client';
import { runMailBatch } from './worker';
import { resendSender } from './provider';
export async function processMail(limit = 10) {
  return runMailBatch(
    await getCommunicationsDatabase(),
    {
      enabled: serverEnv.EMAIL_ENABLED,
      capture: serverEnv.EMAIL_CAPTURE_ENABLED,
      siteUrl: serverEnv.NEXT_PUBLIC_SITE_URL,
      from: serverEnv.EMAIL_FROM,
      adminEmail: serverEnv.ADMIN_NOTIFICATION_EMAIL,
    },
    serverEnv.EMAIL_ENABLED
      ? resendSender(serverEnv.RESEND_API_KEY!)
      : async () => {
          throw new Error('External mail disabled');
        },
    limit,
  );
}
