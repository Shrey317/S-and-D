import { createHmac, timingSafeEqual } from 'node:crypto';
export function recoveryProof(
  secret: string,
  userId: string,
  sessionId: string,
  expiresAt: number,
) {
  const payload = Buffer.from(JSON.stringify({ userId, sessionId, expiresAt })).toString(
    'base64url',
  );
  return `${payload}.${createHmac('sha256', secret).update(`password-recovery:${payload}`).digest('hex')}`;
}
export function validRecoveryProof(
  value: string | undefined,
  secret: string,
  userId: string,
  sessionId: string,
  now = Date.now(),
) {
  if (!value || value.length > 1000) return false;
  try {
    const [payload, signature] = value.split('.');
    if (!payload || !signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
    const expected = createHmac('sha256', secret)
      .update(`password-recovery:${payload}`)
      .digest('hex');
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return (
      data.userId === userId &&
      data.sessionId === sessionId &&
      Number.isFinite(data.expiresAt) &&
      data.expiresAt > now &&
      data.expiresAt <= now + 600000
    );
  } catch {
    return false;
  }
}
