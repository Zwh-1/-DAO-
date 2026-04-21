#!/usr/bin/env node

/**
 * 批量执行所有电路的 Trusted Setup（标准流程 - 两方熵贡献）
 *
 * 功能：
 * - 自动遍历所有已编译的电路
 * - 依次执行完整的 Trusted Setup（包含两次熵贡献）
 * - 导出所有验证密钥和 Solidity 验证器
 *
 * 预计耗时：每个电路 10-15 分钟，总计约 80-120 分钟
 * 适用场景：
 * - 开发环境需要更高安全性
 * - 测试环境需要接近生产的配置
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePtauPath } from './ptau-resolve.mjs';

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

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

/**
 * 主函数：批量执行标准 Trusted Setup
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  批量 Trusted Setup（标准流程 - 两方熵贡献）');
  console.log('='.repeat(60));
  console.log(`[电路数量] ${CIRCUITS.length}`);
  console.log(`[预计时间] 每个电路 10-15 分钟`);
  console.log(`[总耗时] 预计 ${CIRCUITS.length * 12} 分钟`);
  console.log('='.repeat(60));

  const { ptauPath, label } = resolvePtauPath(circuitsRoot);

  if (!fileExists(ptauPath)) {
    console.error('\n[错误] PTAU 文件不存在');
    console.error('       将小体积 PTAU 放入 circuits/params/ 或设置 ZK_PTAU_FILE=文件名');
    console.error('       亦可运行：npm run ptau:generate');
    process.exit(1);
  }

  const stats = fs.statSync(ptauPath);
  console.log(
    `\n[OK] PTAU：${label} (${(stats.size / (1024 * 1024)).toFixed(1)} MB)${process.env.ZK_PTAU_FILE ? ' [ZK_PTAU_FILE]' : ''}`
  );

  // 检查编译
  let compiledCount = 0;
  CIRCUITS.forEach(circuit => {
    const r1csPath = path.join(circuitsRoot, 'build', circuit, `${circuit}.r1cs`);
    if (fileExists(r1csPath)) {
      compiledCount++;
    }
  });

  console.log(`[已编译] ${compiledCount}/${CIRCUITS.length} 个电路`);

  if (compiledCount !== CIRCUITS.length) {
    console.log('\n[警告] 部分电路未编译，将跳过这些电路');
  }

  console.log('\n' + '='.repeat(60));
  console.log('开始批量 Trusted Setup');
  console.log('='.repeat(60));

  // 批量处理
  for (let i = 0; i < CIRCUITS.length; i++) {
    const circuit = CIRCUITS[i];
    const r1csPath = path.join(circuitsRoot, 'build', circuit, `${circuit}.r1cs`);

    // 跳过未编译的电路
    if (!fileExists(r1csPath)) {
      console.log(`\n[跳过] ${circuit} 未编译`);
      continue;
    }

    console.log('\n' + '='.repeat(60));
    console.log(`[${i + 1}/${CIRCUITS.length}] Trusted Setup: ${circuit}`);
    console.log('='.repeat(60));

    const success = execCommand(
      `node "${path.join(__dirname, 'zk-setup.mjs')}" ${circuit}`
    );

    if (!success) {
      console.error(`\n[错误] ${circuit} Trusted Setup 失败`);
      console.error('[继续] 处理下一个电路...\n');
    } else {
      console.log(`\n✅ ${circuit} 完成\n`);
    }
  }

  // 完成
  console.log('\n' + '='.repeat(60));
  console.log('✅ 批量 Trusted Setup 完成');
  console.log('='.repeat(60));
  console.log('[完成] 所有电路的 Trusted Setup 已执行完毕');
  console.log('[输出] 文件位于：circuits/build/<circuit>/');
  console.log('  - <circuit>_final.zkey');
  console.log('  - vkey.json');
  console.log('  - Groth16Verifier.sol');
  console.log('\n[下一步] cd ../contracts && npm run deploy:local');
  console.log('='.repeat(60) + '\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
