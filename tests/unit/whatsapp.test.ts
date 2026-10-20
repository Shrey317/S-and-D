import { describe, expect, it } from 'vitest';
import { buildEnquiry } from '@/lib/whatsapp';

describe('manual WhatsApp enquiry', () => {
  it('normalizes a name and encodes the exact draft for the confirmed shop number', () => {
    const draft = buildEnquiry('  Asha\nPatel  ', ' Apples & pears?\nTwo bags please. ');
    const url = new URL(draft.url);
    expect(url.origin + url.pathname).toBe('https://wa.me/27835043385');
    expect(url.searchParams.get('text')).toBe(draft.text);
    expect(draft.text).toBe(
      'Hello S & D Fruit and Veg, my name is Asha Patel.\n\nApples & pears?\nTwo bags please.',
    );
  });
  it.each([
    [' ', 'hello'],
    ['Asha', ' '],
    ['a'.repeat(81), 'hello'],
    ['Asha', 'a'.repeat(1001)],
  ])('rejects empty or oversized input', (name, message) => {
    expect(() => buildEnquiry(name, message)).toThrow();
  });
});
