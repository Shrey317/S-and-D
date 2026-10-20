import { describe, expect, it } from 'vitest';
import {
  safeReturnTo,
  addressSchema,
  profileSchema,
  passwordSchema,
} from '@/features/account/validation';
import { recoveryProof, validRecoveryProof } from '@/server/auth/recovery-proof';

describe('account security input boundaries', () => {
  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/%2f%2fevil.example',
    '/auth/callback',
    '/account\nLocation: evil',
    '/admin',
    '/account/../auth/callback',
  ])('rejects unsafe return destination %s', (path) => expect(safeReturnTo(path)).toBe('/account'));
  it('keeps permitted local destinations', () => {
    expect(safeReturnTo('/account/wishlist')).toBe('/account/wishlist');
    expect(safeReturnTo('/shop/sample-apples')).toBe('/shop/sample-apples');
  });
  it('bounds names, phone numbers and passwords', () => {
    expect(
      profileSchema.safeParse({ name: 'Customer', phone: '+27835043385', role: 'ADMIN' }).data,
    ).not.toHaveProperty('role');
    expect(profileSchema.safeParse({ name: 'Customer', phone: 'not-a-phone' }).success).toBe(false);
    expect(passwordSchema.safeParse('short').success).toBe(false);
    expect(passwordSchema.safeParse('x'.repeat(129)).success).toBe(false);
  });
  it('requires structured addresses without accepting customer ownership fields', () => {
    const address = {
      label: 'Home',
      recipient: 'Test Customer',
      phone: '0835043385',
      street: 'Test street 1',
      suburb: 'Lenasia',
      city: 'Johannesburg',
      postalCode: '1827',
      instructions: '',
      isDefault: true,
      customerId: 'forged',
    };
    expect(addressSchema.parse(address)).not.toHaveProperty('customerId');
    expect(addressSchema.safeParse({ ...address, postalCode: '18270' }).success).toBe(false);
  });
  it('binds recovery authorization to user, session, signature and expiry', () => {
    const now = Date.now();
    const secret = 'test-secret'.repeat(5);
    const proof = recoveryProof(secret, 'customer-a', 'session-a', now + 600000);
    expect(validRecoveryProof(proof, secret, 'customer-a', 'session-a', now)).toBe(true);
    expect(validRecoveryProof(proof, secret, 'customer-b', 'session-a', now)).toBe(false);
    expect(validRecoveryProof(proof, secret, 'customer-a', 'session-b', now)).toBe(false);
    expect(validRecoveryProof(proof, secret, 'customer-a', 'session-a', now + 600001)).toBe(false);
    expect(validRecoveryProof(proof + 'a', secret, 'customer-a', 'session-a', now)).toBe(false);
    expect(validRecoveryProof(proof, 'other-secret', 'customer-a', 'session-a', now)).toBe(false);
  });
});
