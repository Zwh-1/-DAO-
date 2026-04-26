/** 将电路 public signal（十进制或十六进制字符串）规范为 32 字节 hex（小写），与后端 nullifier 校验一致 */
export function publicSignalToBytes32Hex(s: string): string {
  const raw = String(s).trim();
  const bi = raw.startsWith("0x") ? BigInt(raw) : BigInt(raw);
  const hex = bi.toString(16);
  return "0x" + hex.padStart(64, "0").slice(-64);
}
