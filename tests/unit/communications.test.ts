import { describe, it, expect } from 'vitest';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { verifiedDelivery } from '@/server/communications/delivery';
import { deliveryLabel, whatsappDraft, type Notice } from '@/features/communications/messages';
import { reportRange, safeCell } from '@/features/reports/rules';
import { parseServerEnv } from '@/config/env.schema';
import { renderNotice } from '@/emails/order-notice';
describe('communications boundaries', () => {
  it('verifies the raw signed provider payload and rejects tampering and old timestamps', () => {
    const key = randomBytes(32),
      secret = `whsec_${key.toString('base64')}`,
      id = `msg_${randomUUID()}`,
      timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({
      type: 'email.delivered',
      created_at: new Date().toISOString(),
      data: { email_id: randomUUID() },
    });
    const headersFor = (time: string) =>
      new Headers({
        'svix-id': id,
        'svix-timestamp': time,
        'svix-signature': `v1,${createHmac('sha256', key).update(`${id}.${time}.${body}`).digest('base64')}`,
      });
    expect(verifiedDelivery(body, headersFor(timestamp), secret)?.type).toBe('email.delivered');
    expect(() => verifiedDelivery(body + ' ', headersFor(timestamp), secret)).toThrow();
    expect(() =>
      verifiedDelivery(body, headersFor(String(Number(timestamp) - 3600)), secret),
    ).toThrow();
  });
  it('keeps negative delivery outcomes visible despite late sent or delivered events', () => {
    expect(deliveryLabel(['email.bounced', 'email.delivered', 'email.sent'])).toBe('Bounced');
    expect(deliveryLabel([])).toBe('No delivery event received');
  });
  it('builds only a validated, encoded manual draft with no payment or delivery promise', () => {
    const notice = {
      orderId: randomUUID(),
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      total: '18.00',
      method: 'COLLECTION',
      snapshot: {
        name: 'Test Customer',
        phone: '0835043385',
        email: 'test@example.test',
        isTest: true,
        planningDate: '2026-10-20',
        lines: [],
      },
    } satisfies Notice;
    const draft = whatsappDraft(notice);
    expect(draft.phone).toBe('27835043385');
    expect(draft.text).toContain('LOCAL TEST');
    expect(draft.text).toContain('UNPAID');
    expect(() =>
      whatsappDraft({ ...notice, snapshot: { ...notice.snapshot, phone: 'javascript:123' } }),
    ).toThrow();
  });
  it('uses inclusive Johannesburg report dates and rejects invalid or unbounded ranges', () => {
    const range = reportRange({ from: '2026-10-01', to: '2026-10-31' });
    expect(range.start.toISOString()).toBe('2026-09-30T22:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-10-31T22:00:00.000Z');
    expect(() => reportRange({ from: '2026-02-30' })).toThrow();
    expect(() => reportRange({ from: '2020-01-01', to: '2026-10-31' })).toThrow();
  });
  it('does not present the pre-reconciliation payment state as current in a refund notice', async () => {
    const rendered = await renderNotice(
      'REFUND_COMPLETED',
      {
        orderId: randomUUID(),
        status: 'COLLECTED',
        paymentStatus: 'PAID',
        total: '18.00',
        method: 'COLLECTION',
        snapshot: {
          name: '<script>Customer</script>',
          phone: '0835043385',
          email: 'test@example.test',
          isTest: true,
          planningDate: '2026-10-20',
          lines: [],
        },
      },
      'CUSTOMER',
      'http://127.0.0.1:3000',
    );
    expect(rendered.text).toContain('Order total R18.00');
    expect(rendered.text).not.toContain('Payment: PAID');
    expect(rendered.html).not.toContain('<script>Customer</script>');
    expect(rendered.text).toContain('Sign in to view the order');
  });
  it.each(['=HYPERLINK("bad")', '+SUM(1)', '-1+1', '@value', ' \t=1', '\nformula'])(
    'neutralizes spreadsheet input %s',
    (value) => expect(safeCell(value)).toBe(`'${value}`),
  );
  it('forbids local capture in production and rejects an underconfigured email worker', () => {
    expect(() =>
      parseServerEnv({
        APP_ENV: 'production',
        NEXT_PUBLIC_SITE_URL: 'https://store.example.test',
        EMAIL_CAPTURE_ENABLED: 'true',
        COMMUNICATIONS_DATABASE_URL: 'postgres://worker:example@localhost/test',
      }),
    ).toThrow('EMAIL_CAPTURE_ENABLED');
    expect(() =>
      parseServerEnv({
        EMAIL_ENABLED: 'true',
        RESEND_API_KEY: 'key',
        EMAIL_FROM: 'sender@example.test',
        ADMIN_NOTIFICATION_EMAIL: 'admin@example.test',
      }),
    ).toThrow('COMMUNICATIONS_DATABASE_URL');
  });
});
