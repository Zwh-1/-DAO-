#!/usr/bin/env node

/**
 * 零知识证明可信设置脚本（标准流程 - 两方贡献）
 *
 * 适用场景：
 * - 开发环境测试
 * - 本地原型验证
 * - 学习理解 Trusted Setup 流程
 *
 * 流程说明：
 * 1. 初始化 zkey（Groth16 Setup）
 * 2. 第一次熵贡献（contribute）
 * 3. 第二次熵贡献（contribute）
 * 4. 导出验证密钥（verification key）
 * 5. 导出 Solidity 验证器合约
 * 6. 验证 zkey 文件完整性
 *
 * 注意：
 * - 此版本包含两方熵贡献，比快速版更安全
 * - 但仍不是完整的多方计算仪式（MPC）
 * - 生产环境需要更多参与者和更严格的熵源
 */

import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePtauPath } from './ptau-resolve.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const circuitsRoot = path.join(__dirname, '..');

// ── 配置项 ────────────────────────────────────────────────────────────────────
const CONFIG = {
  circuitName: process.argv[2] || 'identity_commitment',
};

/**
 * 执行 shell 命令
 */
function execCommand(cmd, silent = false) {
  try {
    if (!silent) console.log(`\n[执行] ${cmd}`);
    const execResult = execSync(cmd, {
      cwd: circuitsRoot,
      stdio: silent ? 'pipe' : 'inherit',
      encoding: 'utf-8',
    });
    return { success: true, output: execResult };
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
 * 主函数：标准 Trusted Setup（两方贡献）
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  零知识证明可信设置（标准流程 - 两方熵贡献）');
  console.log('='.repeat(60));
  console.log(`[电路名称] ${CONFIG.circuitName}`);
  const { ptauPath, paramsDir, label } = resolvePtauPath(circuitsRoot);
  console.log(`[PTAU] ${label}${process.env.ZK_PTAU_FILE ? '（来自 ZK_PTAU_FILE）' : ''}`);
  console.log(`[路径] ${ptauPath}`);
  console.log('='.repeat(60));

  // 步骤 0：检查 PTAU
  ensureDir(paramsDir);

  if (!fileExists(ptauPath)) {
    console.error(`\n[错误] PTAU 文件不存在：${ptauPath}`);
    console.error(`       将小体积 PTAU 放入 circuits/params/，或设置环境变量：`);
    console.error(`       ZK_PTAU_FILE=pot12_final.ptau   （相对 params 的文件名）`);
    console.error(`       或 npm run ptau:generate 生成本地 pot16_final.ptau`);
    process.exit(1);
  }

  const stats = fs.statSync(ptauPath);
  console.log(`\n[OK] PTAU 文件：${(stats.size / (1024 * 1024)).toFixed(1)} MB`);

  // 步骤 1：检查 R1CS
  const buildDir = path.join(circuitsRoot, 'build', CONFIG.circuitName);
  const r1csPath = path.join(buildDir, `${CONFIG.circuitName}.r1cs`);

  if (!fileExists(r1csPath)) {
    console.error(`\n[错误] R1CS 文件不存在，请先编译电路`);
    console.error(`       npm run compile ${CONFIG.circuitName}`);
    process.exit(1);
  }

  console.log(`\n[OK] R1CS 文件已存在`);

  // 步骤 2：初始化 zkey（Groth16 Setup）
  const zkeyInitPath = path.join(buildDir, `${CONFIG.circuitName}_0000.zkey`);

  if (fileExists(zkeyInitPath)) {
    console.log(`\n[跳过] 初始 zkey 已存在`);
  } else {
    console.log('\n' + '='.repeat(60));
    console.log('步骤 1: 初始化 zkey（Groth16 Setup）');
    console.log('='.repeat(60));
    console.log('[说明] 使用 PTAU 文件初始化 zkey，包含初始信任');
    
    const command = `npx snarkjs groth16 setup "${r1csPath}" "${ptauPath}" "${zkeyInitPath}"`;
    const result = execCommand(command);

    if (!result.success) {
      console.error(`\n[错误] zkey 初始化失败`);
      process.exit(1);
    }
    
    console.log(`[OK] zkey 初始化完成`);
  }

  // 步骤 3：第一次熵贡献
  const zkeyContrib1Path = path.join(buildDir, `${CONFIG.circuitName}_contrib_0001.zkey`);
  
  if (fileExists(zkeyContrib1Path)) {
    console.log(`\n[跳过] 第一次熵贡献已完成`);
  } else {
    console.log('\n' + '='.repeat(60));
    console.log('步骤 2: 第一次熵贡献');
    console.log('='.repeat(60));
    console.log('[说明] 添加第一个参与者的随机熵，增强安全性');
    console.log('[注意] 此步骤需要生成随机数，可能需要几分钟');
    
    const ent1 = crypto.randomBytes(32).toString('hex');
    const command = `npx snarkjs zkey contribute "${zkeyInitPath}" "${zkeyContrib1Path}" -name="Contributor 1" -entropy="${ent1}"`;
    const result = execCommand(command);

    if (!result.success) {
      console.error(`\n[错误] 第一次熵贡献失败`);
      process.exit(1);
    }
    
    console.log(`[OK] 第一次熵贡献完成`);
  }

  // 步骤 4：第二次熵贡献
  const zkeyContrib2Path = path.join(buildDir, `${CONFIG.circuitName}_contrib_0002.zkey`);
  
  if (fileExists(zkeyContrib2Path)) {
    console.log(`\n[跳过] 第二次熵贡献已完成`);
  } else {
    console.log('\n' + '='.repeat(60));
    console.log('步骤 3: 第二次熵贡献');
    console.log('='.repeat(60));
    console.log('[说明] 添加第二个参与者的随机熵，进一步增强安全性');
    console.log('[注意] 此步骤需要生成随机数，可能需要几分钟');
    
    const ent2 = crypto.randomBytes(32).toString('hex');
    const command = `npx snarkjs zkey contribute "${zkeyContrib1Path}" "${zkeyContrib2Path}" -name="Contributor 2" -entropy="${ent2}"`;
    const result = execCommand(command);

    if (!result.success) {
      console.error(`\n[错误] 第二次熵贡献失败`);
      process.exit(1);
    }
    
    console.log(`[OK] 第二次熵贡献完成`);
  }

  // 步骤 5：使用第二次贡献的 zkey 作为最终 zkey
  const zkeyFinalPath = path.join(buildDir, `${CONFIG.circuitName}_final.zkey`);
  
  if (fileExists(zkeyFinalPath)) {
    console.log(`\n[跳过] 最终 zkey 已存在`);
  } else {
    console.log('\n' + '='.repeat(60));
    console.log('步骤 4: 设置最终 zkey');
    console.log('='.repeat(60));
    
    console.log(`[复制] ${zkeyContrib2Path} → ${zkeyFinalPath}`);
    fs.copyFileSync(zkeyContrib2Path, zkeyFinalPath);
    console.log(`[OK] 最终 zkey 设置完成（包含两方熵贡献）`);
  }

  // 步骤 6：导出验证密钥
  const vkeyPath = path.join(buildDir, 'vkey.json');
  
  if (fileExists(vkeyPath)) {
    console.log(`\n[跳过] 验证密钥已存在`);
  } else {
    console.log('\n' + '='.repeat(60));
    console.log('步骤 5: 导出验证密钥');
    console.log('='.repeat(60));
    console.log('[说明] 从最终 zkey 导出验证密钥，用于链上验证');
    
    const command = `npx snarkjs zkey export verificationkey "${zkeyFinalPath}" "${vkeyPath}"`;
    const result = execCommand(command);

    if (!result.success) {
      console.error(`\n[错误] 验证密钥导出失败`);
      process.exit(1);
    }
    
    console.log(`[OK] 验证密钥导出完成`);
  }

  // 步骤 7：导出 Solidity 验证器合约
  const contractsDir = path.join(circuitsRoot, '..', 'contracts', 'contracts', 'verifiers');
  ensureDir(contractsDir);
  const verifierPath = path.join(contractsDir, `${CONFIG.circuitName}_verifier.sol`);

  console.log('\n' + '='.repeat(60));
  console.log('步骤 6: 导出 Solidity 验证器合约');
  console.log('='.repeat(60));
  console.log('[说明] 生成 Solidity 验证合约，可直接部署到区块链');
  console.log(`[输出] ${path.basename(verifierPath)}`);

  const setupCmd = `npx snarkjs zkey export solidityverifier "${zkeyFinalPath}" "${verifierPath}"`;
  let setupResult = execCommand(setupCmd);

  if (!setupResult.success) {
    console.error(`\n[错误] Solidity 验证器导出失败`);
    process.exit(1);
  }
  
  console.log(`[OK] Solidity 验证器合约导出完成`);

  // 步骤 8：验证 zkey 文件（可选）
  const zkeyInfoPath = path.join(buildDir, 'zkey_info.json');
  
  console.log('\n' + '='.repeat(60));
  console.log('步骤 7: 验证 zkey 文件（可选）');
  console.log('='.repeat(60));
  console.log('[说明] 导出 zkey 文件信息，验证完整性');
  console.log('[注意] 如果此步骤失败，不影响 zkey 使用');
  
  try {
    const infoCmd = `npx snarkjs zkey info "${zkeyFinalPath}" "${zkeyInfoPath}"`;
    const infoResult = execCommand(infoCmd);

    if (!infoResult.success) {
      console.log(`[警告] zkey 信息导出失败（可忽略）`);
    } else {
      console.log(`[OK] zkey 信息已导出到 ${zkeyInfoPath}`);
    }
  } catch (error) {
    console.log(`[警告] 跳过 zkey 信息导出：${error.message}`);
  }

  // 完成
  console.log('\n' + '='.repeat(60));
  console.log('✅ Trusted Setup 完成（标准流程 - 两方熵贡献）');
  console.log('='.repeat(60));
  console.log(`[电路] ${CONFIG.circuitName}`);
  console.log(`[zkey] ${zkeyFinalPath}`);
  console.log(`[vkey] ${vkeyPath}`);
  console.log(`[Verifier] ${verifierPath}`);
  console.log(`[zkey_info] ${zkeyInfoPath}`);
  console.log('\n[下一步] cd ../contracts && npm run deploy:local');
  console.log('\n[安全说明]');
  console.log('  - 此 zkey 文件包含两方熵贡献，比快速版更安全');
  console.log('  - 但仍不是完整的多方计算仪式（MPC）');
  console.log('  - 生产环境建议进行更多轮次的熵贡献');
  console.log('='.repeat(60) + '\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
