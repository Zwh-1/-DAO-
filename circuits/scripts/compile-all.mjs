/**
 * compile-all.mjs
 * 
 * 通用电路编译脚本
 * 
 * 用法:
 *   node scripts/compile-all.mjs                    # 编译所有电路（不含 WASM）
 *   node scripts/compile-all.mjs confidential       # 编译单个电路
 *   node scripts/compile-all.mjs --with-wasm        # 编译所有电路（含 WASM）
 *   node scripts/compile-all.mjs confidential --with-wasm  # 编译单个电路（含 WASM）
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const circuitsRoot = path.resolve(__dirname, '..');

// ── 参数解析 ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const withWasm = args.includes('--with-wasm');
const targetCircuit = args.find(arg => !arg.startsWith('--'));

// ── 电路列表 ──────────────────────────────────────────────────────────────────
const CIRCUITS = [
  'identity_commitment',
  'anti_sybil_claim',
  'anonymous_claim',
  'anti_sybil_verifier',
  'confidential_transfer',
  'multi_sig_proposal',
  'privacy_payment',
  'reputation_verifier',
  'history_anchor',
  'private_payment'
];

// ── 主函数 ───────────────────────────────────────────────────────────────────
function compileCircuit(circuitName) {
  const wasmFlag = withWasm ? ' --with-wasm' : '';
  const cmd = `node scripts/compile-circuit.mjs ${circuitName}${wasmFlag}`;
  
  console.log(`\n[${CIRCUITS.indexOf(circuitName) + 1}/${CIRCUITS.length}] 编译：${circuitName}`);
  
  try {
    execSync(cmd, {
      stdio: 'inherit',
      cwd: circuitsRoot,
      shell: true,
    });
    console.log(`  ✓ 成功`);
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`  ✗ 失败: ${msg}`);
    return false;
  }
}

// ── 执行编译 ──────────────────────────────────────────────────────────────────
console.log('================================================================');
console.log(` 批量编译电路 (${withWasm ? '含 WASM' : '不含 WASM'})`);
console.log('================================================================');

const circuits = targetCircuit ? [targetCircuit] : CIRCUITS;
let successCount = 0;
let failCount = 0;

for (const circuit of circuits) {
  if (compileCircuit(circuit)) {
    successCount++;
  } else {
    failCount++;
  }
}

console.log('\n================================================================');
console.log(` 编译完成：成功 ${successCount}/${circuits.length}`);
if (failCount > 0) {
  console.log(` 失败：${failCount}`);
  process.exit(1);
}
console.log('================================================================');
