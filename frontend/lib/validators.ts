const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const BYTES32_RE = /^0x[a-fA-F0-9]{64}$/;
const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;

export function requireNonEmpty(value: string, field: string) {
  if (!String(value || "").trim()) {
    throw new Error(`${field} 不能为空`);
  }
}

export function requireEthAddress(value: string, field: string) {
  requireNonEmpty(value, field);
  if (!ETH_ADDRESS_RE.test(value)) {
    throw new Error(`${field} 格式错误，需为 0x 开头的 40 位地址`);
  }
}

export function requireBytes32(value: string, field: string) {
  requireNonEmpty(value, field);
  if (!BYTES32_RE.test(value)) {
    throw new Error(`${field} 格式错误，需为 0x 开头的 64 位十六进制`);
  }
}

export function requireTxHash(value: string, field: string) {
  requireNonEmpty(value, field);
  if (!TX_HASH_RE.test(value)) {
    throw new Error(`${field} 格式错误，需为 0x 开头的 64 位交易哈希`);
  }
}

export function requireIpfsUri(value: string, field: string) {
  requireNonEmpty(value, field);
  if (!value.startsWith("ipfs://")) {
    throw new Error(`${field} 格式错误，需以 ipfs:// 开头`);
  }
}

export function requirePositiveIntegerString(value: string, field: string) {
  requireNonEmpty(value, field);
  if (!/^\d+$/.test(value) || Number(value) <= 0) {
    throw new Error(`${field} 必须是大于 0 的整数`);
  }
}

export function requireMinimum(value: number, min: number, field: string) {
  if (!Number.isFinite(value) || value < min) {
    throw new Error(`${field} 不能小于 ${min}`);
  }
}
