/**
 * 解析 Groth16 所用的 PTAU 路径。
 *
 * 优先级：
 * 1. 环境变量 ZK_PTAU_FILE：可为绝对路径，或相对于 circuits/params 的文件名（如 pot12_final.ptau）
 * 2. 在 params 下按常见小体积 / 默认文件名依次探测已存在的文件
 */

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_CANDIDATES = [
  'pot16_final.ptau',
  'pot15_final.ptau',
  'pot14_final.ptau',
  'pot12_final.ptau',
  'powersOfTau28_hez_final_14.ptau',
];

/**
 * @param {string} circuitsRoot circuits 包根目录
 * @returns {{ ptauPath: string, paramsDir: string, label: string }}
 */
export function resolvePtauPath(circuitsRoot) {
  const paramsDir = path.join(circuitsRoot, 'params');
  const raw = process.env.ZK_PTAU_FILE?.trim();
  if (raw) {
    const ptauPath = path.isAbsolute(raw) ? raw : path.join(paramsDir, raw);
    return { ptauPath, paramsDir, label: path.basename(ptauPath) };
  }
  for (const name of DEFAULT_CANDIDATES) {
    const ptauPath = path.join(paramsDir, name);
    if (fs.existsSync(ptauPath)) {
      return { ptauPath, paramsDir, label: name };
    }
  }
  return {
    ptauPath: path.join(paramsDir, 'pot16_final.ptau'),
    paramsDir,
    label: 'pot16_final.ptau',
  };
}
