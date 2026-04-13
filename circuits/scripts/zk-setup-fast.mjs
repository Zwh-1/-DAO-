#!/usr/bin/env node

/**
 * 零知识证明可信设置脚本（快速版 - 跳过熵贡献）
 *
 * 适用场景：
 * - 开发环境快速测试
 * - 本地原型验证
 * - 不需要生产级安全性
 *
 * 注意：
 * - 此版本跳过熵贡献步骤，zkey 文件仅包含初始信任
 * - 生产环境必须使用完整版（zk-setup.mjs）进行多方计算仪式
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const circuitsRoot = path.join(__dirname, '..');

// ── 配置项 ────────────────────────────────────────────────────────────────────
const CONFIG = {
  circuitName: process.argv[2] || 'identity_commitment',
  ptauFile: 'pot16_final.ptau',  // 使用 pot16 支持超大电路
};

/**
 * 执行 shell 命令
 */
function execCommand(command, silent = false) {
  try {
    if (!silent) console.log(`\n[执行] ${command}`);
    const result = execSync(command, {
      cwd: circuitsRoot,
      stdio: silent ? 'pipe' : 'inherit',
      encoding: 'utf-8',
    });
    return { success: true, output: result };
  } catch (error) {
    console.error(`[失败] ${error.message}`);
    return { success: false, error: error.message };
  }
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`[目录] 创建：${dirPath}`);
  }
}

/**
 * 主函数：快速 Trusted Setup
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  零知识证明可信设置（快速版 - 跳过熵贡献）');
  console.log('='.repeat(60));
  console.log(`[电路名称] ${CONFIG.circuitName}`);
  console.log(`[PTAU 文件] ${CONFIG.ptauFile}`);
  console.log(`[警告] 此版本跳过熵贡献，仅适用于开发环境！`);
  console.log('='.repeat(60));

  // 步骤 1：检查 PTAU
  const paramsDir = path.join(circuitsRoot, 'params');
  ensureDir(paramsDir);
  const ptauPath = path.join(paramsDir, CONFIG.ptauFile);

  if (!fileExists(ptauPath)) {
    console.error(`\n[错误] PTAU 文件不存在：${ptauPath}`);
    console.error(`       请先下载 pot15_final.ptau（约 516 MB）`);
    console.error(`       下载地址：https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_15.ptau`);
    process.exit(1);
  }

  const stats = fs.statSync(ptauPath);
  console.log(`\n[OK] PTAU 文件：${(stats.size / (1024 * 1024)).toFixed(1)} MB`);

  // 步骤 2：检查 R1CS
  const buildDir = path.join(circuitsRoot, 'build', CONFIG.circuitName);
  const r1csPath = path.join(buildDir, `${CONFIG.circuitName}.r1cs`);

  if (!fileExists(r1csPath)) {
    console.error(`\n[错误] R1CS 文件不存在，请先编译电路`);
    console.error(`       npm run compile ${CONFIG.circuitName}`);
    process.exit(1);
  }

  console.log(`\n[OK] R1CS 文件已存在`);

  // 步骤 3：初始化 zkey（Groth16 Setup）
  const zkeyInitPath = path.join(buildDir, `${CONFIG.circuitName}_0000.zkey`);

  if (fileExists(zkeyInitPath)) {
    console.log(`\n[跳过] 初始 zkey 已存在`);
  } else {
    console.log('\n' + '='.repeat(60));
    console.log('步骤 1: 初始化 zkey（Groth16 Setup）');
    console.log('='.repeat(60));
    
    const command = `npx snarkjs groth16 setup "${r1csPath}" "${ptauPath}" "${zkeyInitPath}"`;
    const result = execCommand(command);

    if (!result.success) {
      console.error(`\n[错误] zkey 初始化失败`);
      process.exit(1);
    }
  }

  // 步骤 4：直接使用初始 zkey 作为最终 zkey（跳过熵贡献）
  const zkeyFinalPath = path.join(buildDir, `${CONFIG.circuitName}_final.zkey`);
  
  if (fileExists(zkeyFinalPath)) {
    console.log(`\n[跳过] 最终 zkey 已存在`);
  } else {
    console.log('\n' + '='.repeat(60));
    console.log('步骤 2: 复制 zkey（跳过熵贡献）');
    console.log('='.repeat(60));
    
    console.log(`[复制] ${zkeyInitPath} → ${zkeyFinalPath}`);
    fs.copyFileSync(zkeyInitPath, zkeyFinalPath);
    console.log(`[OK] 复制成功（未添加额外熵）`);
  }

  // 步骤 5：导出验证密钥
  const vkeyPath = path.join(buildDir, 'vkey.json');
  
  if (fileExists(vkeyPath)) {
    console.log(`\n[跳过] 验证密钥已存在`);
  } else {
    console.log('\n' + '='.repeat(60));
    console.log('步骤 3: 导出验证密钥');
    console.log('='.repeat(60));
    
    const command = `npx snarkjs zkey export verificationkey "${zkeyFinalPath}" "${vkeyPath}"`;
    const result = execCommand(command);

    if (!result.success) {
      console.error(`\n[错误] 验证密钥导出失败`);
      process.exit(1);
    }
  }

  // 步骤 6：导出 Solidity 验证器合约
  const contractsDir = path.join(circuitsRoot, '..', 'contracts', 'contracts', 'verifiers');
  ensureDir(contractsDir);
  const verifierPath = path.join(contractsDir, 'Groth16Verifier.sol');

  console.log('\n' + '='.repeat(60));
  console.log('步骤 4: 导出 Solidity 验证器合约');
  console.log('='.repeat(60));
  
  const command = `npx snarkjs zkey export solidityverifier "${zkeyFinalPath}" "${verifierPath}"`;
  const result = execCommand(command);

  if (!result.success) {
    console.error(`\n[错误] Solidity 验证器导出失败`);
    process.exit(1);
  }

  // 完成
  console.log('\n' + '='.repeat(60));
  console.log('✅ Trusted Setup 完成（快速版）');
  console.log('='.repeat(60));
  console.log(`[电路] ${CONFIG.circuitName}`);
  console.log(`[zkey] ${zkeyFinalPath}`);
  console.log(`[vkey] ${vkeyPath}`);
  console.log(`[Verifier] ${verifierPath}`);
  console.log('\n[下一步] cd ../contracts && npm run deploy:local');
  console.log('[警告] 此 zkey 文件仅包含初始信任，不适用于生产环境！');
  console.log('='.repeat(60) + '\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
