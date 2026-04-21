#!/usr/bin/env node

/**
 * 批量导出所有电路的 Solidity 验证器合约
 *
 * 功能：
 * - 遍历所有已生成 zkey 的电路
 * - 为每个电路导出 Groth16Verifier.sol
 * - 自动覆盖旧的验证器合约
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const circuitsRoot = path.join(__dirname, '..');
const contractsRoot = path.join(circuitsRoot, '..', 'contracts', 'contracts', 'verifiers');

// ── 所有电路列表 ─────────────────────────────────────────────────────────────
const CIRCUITS = [
  'identity_commitment',
  'anonymous_claim',
  'anti_sybil_claim',
  'anti_sybil_verifier',
  'history_anchor',
  'confidential_transfer',
  'multi_sig_proposal',
  'privacy_payment',
  'private_payment',
  'reputation_verifier',
];

/**
 * 执行命令
 */
function execCommand(command) {
  console.log(`\n[执行] ${command}`);
  try {
    execSync(command, {
      cwd: circuitsRoot,
      stdio: 'inherit',
      encoding: 'utf-8',
    });
    return true;
  } catch (error) {
    console.error(`[失败] ${error.message}`);
    return false;
  }
}

/**
 * 检查文件是否存在
 */
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

/**
 * 主函数
 */
function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  批量导出 Solidity 验证器合约');
  console.log('='.repeat(60));

  // 确保验证器目录存在
  if (!fileExists(contractsRoot)) {
    console.log(`\n[创建] 验证器目录：${contractsRoot}`);
    fs.mkdirSync(contractsRoot, { recursive: true });
  }

  let successCount = 0;
  let failCount = 0;

  // 批量处理
  for (let i = 0; i < CIRCUITS.length; i++) {
    const circuit = CIRCUITS[i];
    const zkeyPath = path.join(circuitsRoot, 'build', circuit, `${circuit}_final.zkey`);
    const verifierPath = path.join(contractsRoot, `${circuit}_verifier.sol`);

    // 跳过未生成 zkey 的电路
    if (!fileExists(zkeyPath)) {
      console.log(`\n[跳过] ${circuit} - zkey 文件不存在`);
      failCount++;
      continue;
    }

    console.log('\n' + '='.repeat(60));
    console.log(`[${i + 1}/${CIRCUITS.length}] 导出验证器：${circuit}`);
    console.log('='.repeat(60));

    const command = `npx snarkjs zkey export solidityverifier "${zkeyPath}" "${verifierPath}"`;
    const success = execCommand(command);

    if (success) {
      console.log(`[OK] 验证器合约已导出：${verifierPath}`);
      successCount++;
    } else {
      console.error(`[错误] ${circuit} 验证器导出失败`);
      failCount++;
    }
  }

  // 完成
  console.log('\n' + '='.repeat(60));
  console.log('✅ 批量导出完成');
  console.log('='.repeat(60));
  console.log(`[成功] ${successCount}/${CIRCUITS.length} 个电路`);
  if (failCount > 0) {
    console.log(`[失败] ${failCount}/${CIRCUITS.length} 个电路`);
  }
  console.log(`[输出] 文件位于：contracts/contracts/verifiers/`);
  console.log('='.repeat(60) + '\n');
}

try {
  main();
} catch (err) {
  console.error('[错误]', err);
  process.exit(1);
}
