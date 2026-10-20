import { createHash } from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';
import {
  phpEncode,
  requestSignature,
  paymentRequest,
  verifyNotification,
  payfastSourceAllowed,
  confirmPayfast,
} from '@/server/payments/payfast';
import { compatibleMethod, holdMinutes } from '@/features/payments/methods';
const config = {
  merchantId: '10000100',
  merchantKey: 'public-key',
  passphrase: 'private test phrase',
  siteUrl: 'https://test.example.com',
};
const id = '935c2553-dc99-418d-bff1-9582b798b2c1';
// Independently construct provider fixtures, including blank fields in notification signing.
function notification(overrides: Record<string, string> = {}) {
  const fields = {
    m_payment_id: id,
    pf_payment_id: '123456',
    payment_status: 'COMPLETE',
    item_name: 'Test order',
    custom_str1: '',
    amount_gross: '5.50',
    merchant_id: config.merchantId,
    ...overrides,
  };
  const canonical = new URLSearchParams(fields).toString();
  return `${canonical}&signature=${createHash('md5').update(`${canonical}&passphrase=private+test+phrase`).digest('hex')}`;
}
const dependencies = () => ({
  sourceAllowed: vi.fn(async () => true),
  confirm: vi.fn(async (canonical: string) => Boolean(canonical)),
});
describe('Payfast sandbox protocol', () => {
  it('limits offline choices by fulfilment and applies method-specific deadlines', () => {
    expect(compatibleMethod('COD', 'COLLECTION')).toBe(false);
    expect(compatibleMethod('COD', 'DELIVERY')).toBe(true);
    expect(compatibleMethod('COLLECTION', 'DELIVERY')).toBe(false);
    expect(holdMinutes('MANUAL_EFT')).toBe(1440);
    expect(holdMinutes('PAYFAST_CARD')).toBe(20);
    expect(holdMinutes('COD')).toBeNull();
    expect(holdMinutes('COLLECTION')).toBeNull();
  });
  it('uses PHP encoding and ordered signing, omitting empty request values', () => {
    expect(phpEncode("a b!~'()*+")).toBe('a+b%21%7E%27%28%29%2A%2B');
    const expected = createHash('md5')
      .update('b=two+words&a=one&passphrase=private+test+phrase')
      .digest('hex');
    expect(requestSignature({ b: 'two words', empty: '', a: 'one' }, config.passphrase)).toBe(
      expected,
    );
  });
  it('posts only public fields to sandbox with exact method codes and no passphrase', () => {
    const request = paymentRequest(config, { id, amount: '5.50', method: 'PAYFAST_EFT' });
    expect(request.url).toBe('https://sandbox.payfast.co.za/eng/process');
    expect(request.fields.payment_method).toBe('ef');
    expect(JSON.stringify(request)).not.toContain(config.passphrase);
    expect(Object.keys(request.fields).slice(0, 3)).toEqual([
      'merchant_id',
      'merchant_key',
      'return_url',
    ]);
    expect(
      paymentRequest(config, { id, amount: '5.50', method: 'PAYFAST_CARD' }).fields.payment_method,
    ).toBe('cc');
    expect(() => paymentRequest(config, { id, amount: '4.99', method: 'PAYFAST_CARD' })).toThrow();
  });
  it('verifies signed notifications including blanks against source and server confirmation', async () => {
    const deps = dependencies();
    const result = await verifyNotification(notification(), '144.126.193.139', config, deps);
    expect(result).toMatchObject({
      paymentId: id,
      providerId: '123456',
      status: 'COMPLETE',
      amount: '5.50',
    });
    expect(deps.confirm).toHaveBeenCalledWith(expect.stringContaining('custom_str1=&'));
    expect(deps.confirm.mock.calls[0]?.[0]).not.toContain('passphrase');
  });
  it.each([
    { merchant_id: 'wrong' },
    { m_payment_id: 'invalid' },
    { amount_gross: 'NaN' },
    { payment_status: 'PAID' },
    { pf_payment_id: 'invalid' },
  ])('rejects invalid signed fields %j', async (fields) => {
    await expect(
      verifyNotification(notification(fields), '144.126.193.139', config, dependencies()),
    ).rejects.toThrow();
  });
  it('rejects tampering, repeated keys, missing source and server rejection', async () => {
    for (const raw of [
      notification().replace('5.50', '9.50'),
      `merchant_id=10000100&${notification()}`,
    ])
      await expect(
        verifyNotification(raw, '144.126.193.139', config, dependencies()),
      ).rejects.toThrow();
    await expect(
      verifyNotification(notification(), undefined, config, dependencies()),
    ).rejects.toThrow();
    await expect(
      verifyNotification(notification(), '127.0.0.1', config, {
        ...dependencies(),
        sourceAllowed: async () => false,
      }),
    ).rejects.toThrow();
    await expect(
      verifyNotification(notification(), '144.126.193.139', config, {
        ...dependencies(),
        confirm: async () => false,
      }),
    ).rejects.toThrow();
  });
  it('checks exact published source ranges', async () => {
    for (const ip of [
      '197.97.145.144',
      '197.97.145.159',
      '41.74.179.223',
      '102.216.36.0',
      '102.216.36.143',
      '::ffff:144.126.193.139',
    ])
      expect(await payfastSourceAllowed(ip)).toBe(true);
    for (const ip of ['127.0.0.1', '197.97.145.160', '41.74.179.224', '102.216.36.144', '::1'])
      expect(await payfastSourceAllowed(ip)).toBe(false);
  });
  it('requires VALID from the fixed sandbox validation endpoint', async () => {
    const mock = vi.fn().mockResolvedValue(new Response('VALID'));
    vi.stubGlobal('fetch', mock);
    try {
      expect(await confirmPayfast('amount_gross=5.50')).toBe(true);
      expect(mock).toHaveBeenCalledWith(
        'https://sandbox.payfast.co.za/eng/query/validate',
        expect.objectContaining({ redirect: 'error', body: 'amount_gross=5.50' }),
      );
      mock.mockResolvedValue(new Response('INVALID'));
      expect(await confirmPayfast('x')).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
