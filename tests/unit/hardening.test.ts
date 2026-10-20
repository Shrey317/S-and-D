import { describe, it, expect } from 'vitest';
import { contentSecurityPolicy } from '@/server/security/csp';
import { boundedBody } from '@/server/security/body';
describe('security boundaries', () => {
  it('rejects nonce injection and allows eval only for the development compiler', () => {
    expect(() => contentSecurityPolicy("x'; script-src *", false)).toThrow();
    expect(contentSecurityPolicy('YWJj', false)).not.toContain('unsafe-eval');
    expect(contentSecurityPolicy('YWJj', true)).toContain('unsafe-eval');
    expect(contentSecurityPolicy('YWJj', false)).toContain("frame-ancestors 'none'");
  });
  it('limits streamed bodies by bytes even without a content-length header', async () => {
    const chunks = [new Uint8Array([65, 66]), new Uint8Array([67, 68])];
    const request = {
      body: new ReadableStream({
        start(controller) {
          chunks.forEach((c) => controller.enqueue(c));
          controller.close();
        },
      }),
    } as Request;
    expect(await boundedBody(request, 3)).toBeNull();
    const small = {
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([65, 66]));
          controller.close();
        },
      }),
    } as Request;
    expect(await boundedBody(small, 2)).toBe('AB');
  });
});
