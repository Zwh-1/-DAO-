#!/usr/bin/env node

/**
 * 本地生成 PTAU 文件（pot12）
 *
 * 适用场景：
 * - 网络下载失败
 * - 需要完全本地化的可信设置
 * - 学习 PTAU 生成流程
 *
 * 注意：
 * - 此过程需要较长时间（约 10-30 分钟）
 * - 生成的 PTAU 仅用于开发测试
 * - 生产环境应使用官方仪式生成的 PTAU
 */

import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const circuitsRoot = path.join(__dirname, '..');
const paramsDir = path.join(circuitsRoot, 'params');

// ── 配置项 ────────────────────────────────────────────────────────────────────
const CONFIG = {
  power: 16,  // 2^16 = 65536 个约束，支持超大电路
  outputFile: 'pot16_final.ptau',
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
 * 主函数：本地生成 PTAU
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  本地生成 PTAU 文件（快速仪式）');
  console.log('='.repeat(60));
  console.log(`[Power] ${CONFIG.power} (2^${CONFIG.power} = ${Math.pow(2, CONFIG.power)} 约束)`);
  console.log(`[输出] ${CONFIG.outputFile}`);
  console.log('='.repeat(60));

  ensureDir(paramsDir);
  const finalPath = path.join(paramsDir, CONFIG.outputFile);

  if (fileExists(finalPath)) {
    const stats = fs.statSync(finalPath);
    console.log(`\n[跳过] PTAU 文件已存在：${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`[路径] ${finalPath}`);
    console.log('\n[提示] 如需重新生成，请先删除现有文件');
    return;
  }

  // 步骤 1：初始化 PTAU
  console.log('\n' + '='.repeat(60));
  console.log('步骤 1: 初始化 PTAU');
  console.log('='.repeat(60));
  console.log('[说明] 创建初始的 Powers of Tau 结构');
  
  const initPath = path.join(paramsDir, `pot${CONFIG.power}_0000.ptau`);
  const command1 = `npx snarkjs powersoftau new bn128 ${CONFIG.power} "${initPath}" -c="Initial Contribution"`;
  const result1 = execCommand(command1);

  if (!result1.success) {
    console.error(`\n[错误] PTAU 初始化失败`);
    process.exit(1);
  }
  
  console.log(`[OK] PTAU 初始化完成`);

  // 步骤 2：第一次贡献
  console.log('\n' + '='.repeat(60));
  console.log('步骤 2: 第一次熵贡献');
  console.log('='.repeat(60));
  console.log('[说明] 添加第一个参与者的随机熵');
  console.log('[注意] 此步骤需要生成随机数，可能需要几分钟');
  
  const contrib1Path = path.join(paramsDir, `pot${CONFIG.power}_0001.ptau`);
  const ent1 = crypto.randomBytes(32).toString('hex');
  const command2 = `npx snarkjs powersoftau contribute "${initPath}" "${contrib1Path}" -name="Contributor 1" -entropy="${ent1}"`;
  const result2 = execCommand(command2);

  if (!result2.success) {
    console.error(`\n[错误] 第一次熵贡献失败`);
    process.exit(1);
  }
  
  console.log(`[OK] 第一次熵贡献完成`);

  // 步骤 3：第二次贡献（可选，但推荐）
  console.log('\n' + '='.repeat(60));
  console.log('步骤 3: 第二次熵贡献');
  console.log('='.repeat(60));
  console.log('[说明] 添加第二个参与者的随机熵，增强安全性');
  
  const contrib2Path = path.join(paramsDir, `pot${CONFIG.power}_0002.ptau`);
  const ent2 = crypto.randomBytes(32).toString('hex');
  const command3 = `npx snarkjs powersoftau contribute "${contrib1Path}" "${contrib2Path}" -name="Contributor 2" -entropy="${ent2}"`;
  const result3 = execCommand(command3);

  if (!result3.success) {
    console.error(`\n[错误] 第二次熵贡献失败`);
    process.exit(1);
  }
  
  console.log(`[OK] 第二次熵贡献完成`);

  // 步骤 4：导出最终 PTAU
  console.log('\n' + '='.repeat(60));
  console.log('步骤 4: 导出最终 PTAU');
  console.log('='.repeat(60));
  console.log('[说明] 从第二次贡献的文件导出最终 PTAU');
  
  const command4 = `npx snarkjs powersoftau prepare phase2 "${contrib2Path}" "${finalPath}"`;
  const result4 = execCommand(command4);

  if (!result4.success) {
    console.error(`\n[错误] 最终 PTAU 导出失败`);
    process.exit(1);
  }
  
  console.log(`[OK] 最终 PTAU 导出完成`);

  // 完成
  const stats = fs.statSync(finalPath);
  console.log('\n' + '='.repeat(60));
  console.log('✅ PTAU 生成完成（本地快速仪式）');
  console.log('='.repeat(60));
  console.log(`[文件] ${finalPath}`);
  console.log(`[大小] ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`[支持] 最多 ${Math.pow(2, CONFIG.power)} 个约束`);
  console.log('\n[下一步] 运行 Trusted Setup');
  console.log(`       npm run zk:setup identity_commitment`);
  console.log('\n[说明]');
  console.log('  - 此 PTAU 文件包含两次熵贡献，适合开发测试');
  console.log('  - 生产环境建议使用官方仪式生成的 PTAU');
  console.log('='.repeat(60) + '\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
