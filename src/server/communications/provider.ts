import { Resend } from 'resend';
import { z } from 'zod';
import { MailFailure, type SendMail } from './worker';
export function resendSender(key: string): SendMail {
  const client = new Resend(key);
  return async (request, idempotencyKey) => {
    const { data, error } = await client.emails.send(request, {
      idempotencyKey,
      signal: AbortSignal.timeout(10000),
    });
    if (error)
      throw new MailFailure(
        !(
          error.statusCode === null ||
          error.statusCode >= 500 ||
          error.statusCode === 429 ||
          error.name === 'concurrent_idempotent_requests'
        ),
      );
    const result = z.uuid().safeParse(data?.id);
    if (!result.success) throw new MailFailure(false);
    return result.data;
  };
}
