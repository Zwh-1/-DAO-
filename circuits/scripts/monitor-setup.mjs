#!/usr/bin/env node

/**
 * Trusted Setup 进度监控脚本（整合版）
 * 
 * 用法：
 *   node scripts/monitor-setup.mjs              # 监控所有电路
 *   node scripts/monitor-setup.mjs <circuit>    # 监控单个电路
 * 
 * 功能：
 *   - 实时监控所有电路的 Trusted Setup 进度
 *   - 检测运行中的进程并估算进度
 *   - 显示文件大小和预计剩余时间
 *   - 每 5 秒自动刷新
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const circuitsRoot = join(__dirname, '..');

// 命令行参数：可选的电路名称
const circuitArg = process.argv[2];

// 电路列表
const ALL_CIRCUITS = [
  'identity_commitment',
  'anti_sybil_verifier',
  'history_anchor',
  'confidential_transfer',
  'multi_sig_proposal',
  'privacy_payment',
  'private_payment',
  'reputation_verifier',
];

// 根据参数决定监控范围
const circuitsToMonitor = circuitArg ? [circuitArg] : ALL_CIRCUITS;

// 各电路预计耗时（分钟）
const CIRCUIT_ESTIMATES = {
  'identity_commitment': 10,
  'reputation_verifier': 5,
  'privacy_payment': 15,
  'confidential_transfer': 15,
  'multi_sig_proposal': 20,
  'history_anchor': 30,
  'anti_sybil_verifier': 35,
  'private_payment': 50,
};

// ──────────────────────────────────────────────────────────────
// 工具函数
// ──────────────────────────────────────────────────────────────

/**
 * 清屏
 */
function clearScreen() {
  console.clear();
}

/**
 * 检查文件是否存在
 */
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

/**
 * 获取文件大小（MB）
 */
function getFileSizeMB(filePath) {
  if (!fileExists(filePath)) return 0;
  const stats = fs.statSync(filePath);
  return (stats.size / (1024 * 1024)).toFixed(1);
}

/**
 * 获取文件大小（KB）
 */
function getFileSizeKB(filePath) {
  if (!fileExists(filePath)) return 0;
  const stats = fs.statSync(filePath);
  return (stats.size / 1024).toFixed(1);
}

/**
 * 检查是否有正在运行的 Trusted Setup 进程
 */
function isProcessRunning(circuit) {
  try {
    const result = execSync(
      `powershell -Command "Get-Process | Where-Object {$_.CommandLine -like '*zk-setup-fast*' -and $_.CommandLine -like '*${circuit}*'}"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    );
    return result.trim().length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * 获取进程运行开始时间
 */
function getProcessStartTime(circuit) {
  try {
    const result = execSync(
      `powershell -Command "(Get-Process | Where-Object {$_.CommandLine -like '*${circuit}*'} | Select-Object -First 1).StartTime"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    );
    return new Date(result.trim());
  } catch (error) {
    return null;
  }
}

/**
 * 估算进度百分比
 */
function estimateProgress(circuit, hasZkeyInit) {
  // 如果进程正在运行
  if (isProcessRunning(circuit)) {
    const startTime = getProcessStartTime(circuit);
    if (startTime) {
      const elapsed = Date.now() - startTime.getTime();
      const elapsedMinutes = elapsed / (1000 * 60);
      
      const estimatedTotal = CIRCUIT_ESTIMATES[circuit] || 20;
      const progress = Math.min(90, Math.floor((elapsedMinutes / estimatedTotal) * 100));
      return { 
        progress, 
        elapsed: elapsedMinutes.toFixed(1),
        estimatedTotal 
      };
    }
    return { progress: 50, elapsed: '未知', estimatedTotal: 0 };
  }
  
  // 进程未运行，但有 zkey_0000 文件，说明刚完成步骤 1
  if (hasZkeyInit) {
    return { progress: 60, elapsed: '0', estimatedTotal: 0 };
  }
  
  return { progress: 0, elapsed: '0', estimatedTotal: 0 };
}

// ──────────────────────────────────────────────────────────────
// 监控单个电路
// ──────────────────────────────────────────────────────────────

/**
 * 监控并显示单个电路的状态
 */
function monitorCircuit(circuit, index, total) {
  const buildDir = join(circuitsRoot, 'build', circuit);
  
  const r1csPath = join(buildDir, `${circuit}.r1cs`);
  const zkeyInitPath = join(buildDir, `${circuit}_0000.zkey`);
  const zkeyFinalPath = join(buildDir, `${circuit}_final.zkey`);
  const vkeyPath = join(buildDir, 'vkey.json');

  let status = '⏳ 等待中';
  let details = '';
  let progress = 0;

  // 检查是否有正在运行的进程
  const processRunning = isProcessRunning(circuit);
  const hasZkeyInit = fileExists(zkeyInitPath);
  const progressInfo = estimateProgress(circuit, hasZkeyInit);

  // 确定状态
  if (!fileExists(r1csPath)) {
    status = '❌ 未编译';
    progress = 0;
  } else if (fileExists(zkeyFinalPath) && fileExists(vkeyPath)) {
    status = '✅ 已完成';
    progress = 100;
    const zkeySize = getFileSizeMB(zkeyFinalPath);
    const vkeySize = getFileSizeKB(vkeyPath);
    details = `zkey: ${zkeySize} MB, vkey: ${vkeySize} KB`;
  } else if (processRunning) {
    status = '🔧 Setup 中 (进程运行中)';
    progress = progressInfo.progress;
    details = `已运行 ${progressInfo.elapsed}/${progressInfo.estimatedTotal} 分钟`;
  } else if (hasZkeyInit) {
    status = '🔧 Setup 中';
    const zkeySize = getFileSizeMB(zkeyInitPath);
    progress = Math.min(70, 50 + Math.floor(zkeySize / 2));
    details = `zkey_0000: ${zkeySize} MB (等待后续步骤)`;
  } else if (fileExists(r1csPath)) {
    status = '⏳ 准备中';
    progress = 10;
  }

  // 显示电路状态
  const circuitNum = index + 1;
  console.log(`[${circuitNum}/${total}] ${circuit}`);
  console.log(`    状态：${status}`);
  
  if (progress > 0 && progress < 100) {
    const barLength = 30;
    const filledLength = Math.floor((progress / 100) * barLength);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    console.log(`    进度：[${bar}] ${progress}%`);
  }
  
  if (details) {
    console.log(`    文件：${details}`);
  }
  
  console.log();
  
  return status === '✅ 已完成';
}

// ──────────────────────────────────────────────────────────────
// 主监控循环
// ──────────────────────────────────────────────────────────────

/**
 * 主监控函数
 */
function main() {
  console.log('\n' + '='.repeat(80));
  console.log('  Trusted Setup 进度监控');
  console.log('='.repeat(80));
  console.log(`  监控范围：${circuitArg ? circuitArg : '所有 8 个电路'}`);
  console.log(`  刷新间隔：5 秒`);
  console.log('='.repeat(80));
  console.log();

  let completedCount = 0;
  let inProgressCount = 0;

  circuitsToMonitor.forEach((circuit, index) => {
    const isCompleted = monitorCircuit(circuit, index, circuitsToMonitor.length);
    if (isCompleted) {
      completedCount++;
    } else {
      // 检查是否在进行中
      const buildDir = join(circuitsRoot, 'build', circuit);
      const zkeyInitPath = join(buildDir, `${circuit}_0000.zkey`);
      if (fileExists(zkeyInitPath) || isProcessRunning(circuit)) {
        inProgressCount++;
      }
    }
  });

  console.log('='.repeat(80));
  console.log(`进度：${completedCount}/${circuitsToMonitor.length} 完成，${inProgressCount} 进行中`);
  
  if (completedCount === circuitsToMonitor.length) {
    console.log('✅ 所有电路 Trusted Setup 完成！');
    console.log('='.repeat(80));
    process.exit(0);
  } else {
    console.log('⏳ 继续监控中... (Ctrl+C 停止)');
    console.log('='.repeat(80));
  }
}

// ──────────────────────────────────────────────────────────────
// 启动监控
// ──────────────────────────────────────────────────────────────

clearScreen();
main();

// 每 5 秒刷新一次
setInterval(() => {
  clearScreen();
  main();
}, 20000);
