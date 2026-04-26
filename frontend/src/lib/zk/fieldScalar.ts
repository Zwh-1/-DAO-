/** BN128 域元素解析（十进制或 0x） */
export function parseFieldElement(input: string): bigint {
  const t = input.trim();
  if (!t) throw new Error('empty field element');
  if (t.startsWith('0x') || t.startsWith('0X')) return BigInt(t);
  return BigInt(t);
}
