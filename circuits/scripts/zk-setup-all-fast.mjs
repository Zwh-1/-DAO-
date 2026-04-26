#!/usr/bin/env node

/**
 * 批量执行所有电路的 Trusted Setup（快速版）
 *
 * 功能：
 * - 自动遍历所有已编译的电路
 * - 依次执行 Trusted Setup（跳过熵贡献）
 * - 导出所有验证密钥和 Solidity 验证器
 *
 * 预计耗时：每个电路 5-10 分钟
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const circuitsRoot = path.join(__dirname, '..');

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
  // 治理 / 审计模块
  'delegate_vote_weight',
  'anonymous_vote',
  'fraud_detection',
  'arb_commit_zk',
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
 * 检查电路是否已编译
 */
function isCircuitCompiled(circuitName) {
  const r1csPath = path.join(circuitsRoot, 'build', circuitName, `${circuitName}.r1cs`);
  return fs.existsSync(r1csPath);
}

/**
 * 主函数
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  批量 Trusted Setup（快速版 - 跳过熵贡献）');
  console.log('='.repeat(60));
  console.log(`[电路数量] ${CIRCUITS.length}`);
  console.log(`[预计时间] ${CIRCUITS.length * 10} 分钟`);
  console.log('='.repeat(60) + '\n');

  // 检查哪些电路已编译
  const compiledCircuits = CIRCUITS.filter(circuit => isCircuitCompiled(circuit));
  
  if (compiledCircuits.length === 0) {
    console.error('[错误] 没有发现已编译的电路！');
    console.error('       请先执行：npm run compile:all');
    process.exit(1);
  }

  console.log(`[已编译] ${compiledCircuits.length}/${CIRCUITS.length} 个电路`);
  console.log(`[待处理] ${compiledCircuits.join(', ')}`);
  console.log('\n' + '='.repeat(60) + '\n');

  let successCount = 0;

  for (const circuit of compiledCircuits) {
    console.log('\n' + '='.repeat(60));
    console.log(`[${successCount + 1}/${compiledCircuits.length}] Trusted Setup: ${circuit}`);
    console.log('='.repeat(60));

    const script = path.join(__dirname, 'zk-setup-fast.mjs');
    const command = `node "${script}" ${circuit}`;

    if (execCommand(command)) {
      successCount++;
      console.log(`✅ ${circuit} 完成`);
    } else {
      console.error(`❌ ${circuit} 失败`);
      console.error('\n[继续执行] 将继续处理下一个电路...\n');
      // 不中断，继续处理下一个
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ 批量 Trusted Setup 完成`);
  console.log(`[成功] ${successCount}/${compiledCircuits.length} 个电路`);
  console.log('='.repeat(60) + '\n');

  if (successCount === compiledCircuits.length) {
    console.log('🎉 所有电路处理成功！');
    console.log('\n[下一步] cd ../contracts && npm run deploy:local\n');
  } else {
    console.warn(`⚠️  有 ${compiledCircuits.length - successCount} 个电路失败，请检查错误日志`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
