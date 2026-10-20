export function contentSecurityPolicy(nonce: string, development: boolean, authOrigin?: string) {
  if (!/^[a-zA-Z0-9+/=]+$/.test(nonce)) throw new Error('Invalid nonce.');
  const auth = authOrigin ? new URL(authOrigin).origin : '';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://res.cloudinary.com",
    "font-src 'self'",
    `connect-src 'self' ${auth}${development ? ' ws: wss:' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self' https://wa.me https://api.whatsapp.com https://sandbox.payfast.co.za",
  ].join('; ');
}
