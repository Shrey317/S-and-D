/** Money stays decimal text. No binary floating-point arithmetic for prices. */
export function formatRand(value: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new Error('Invalid catalog price');
  return `R${match[1]!.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${(match[2] || '').padEnd(2, '0')}`;
}
