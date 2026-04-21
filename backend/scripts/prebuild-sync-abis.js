#!/usr/bin/env node

/**
 * 后端构建前钩子：自动同步合约 ABI
 * 
 * 用途：
 * - 在运行 yarn build 之前自动执行
 * - 检测合约是否有更新
 * - 自动编译并导出最新的 ABI
 * 
 * 使用方法：
 * - 已自动添加到 package.json 的 prebuild 钩子
 * - 无需手动执行
 * 
 * 环境变量：
 * - SKIP_ABI_SYNC=true：跳过 ABI 同步
 * - FORCE_COMPILE=true：强制重新编译合约
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// 获取 __dirname（ES 模块中需要手动获取）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 目录配置
const BACKEND_ROOT = path.join(__dirname, '..');
const CONTRACTS_ROOT = path.join(BACKEND_ROOT, '..', 'contracts');
const ARTIFACTS_DIR = path.join(CONTRACTS_ROOT, 'artifacts');
const ABIS_DIR = path.join(BACKEND_ROOT, 'src', 'abis');

// 检查是否需要跳过
if (process.env.SKIP_ABI_SYNC === 'true' || process.env.SKIP_ABI_SYNC === '1') {
  console.log('[ABI 同步] 已跳过（SKIP_ABI_SYNC=true）');
  process.exit(0);
}

console.log('');
console.log('='.repeat(60));
console.log('  后端构建前钩子：同步合约 ABI');
console.log('='.repeat(60));
console.log('');

/**
 * 检查是否需要更新 ABI
 */
function needUpdateABI() {
  // 如果 ABI 目录不存在，需要更新
  if (!fs.existsSync(ABIS_DIR)) {
    console.log('[检查] ABI 目录不存在，需要生成');
    return true;
  }
  
  // 如果 artifacts 目录不存在，需要编译
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    console.log('[检查] 合约编译产物不存在，需要编译');
    return true;
  }
  
  // 检查 index.js 是否存在
  const indexFile = path.join(ABIS_DIR, 'index.js');
  if (!fs.existsSync(indexFile)) {
    console.log('[检查] index.js 不存在，需要生成');
    return true;
  }
  
  // 检查是否有 .abi.json 文件
  const abiFiles = fs.readdirSync(ABIS_DIR).filter(f => f.endsWith('.abi.json'));
  if (abiFiles.length === 0) {
    console.log('[检查] 没有 ABI 文件，需要生成');
    return true;
  }
  
  console.log('[检查] ABI 文件已存在，跳过生成');
  return false;
}

/**
 * 执行 ABI 同步
 */
function syncABIs() {
  const forceCompile = process.env.FORCE_COMPILE === 'true' || process.argv.includes('--force');
  
  const script = path.join(CONTRACTS_ROOT, 'scripts', 'compile-and-export-abis.js');
  
  if (!fs.existsSync(script)) {
    console.error('[错误] ABI 导出脚本不存在：' + script);
    process.exit(1);
  }
  
  const args = forceCompile ? ['--force'] : [];
  
  try {
    execSync(`node "${script}" ${args.join(' ')}`, {
      cwd: CONTRACTS_ROOT,
      stdio: 'inherit',
      env: { ...process.env, BACKEND_ABI_DIR: ABIS_DIR }
    });
    
    console.log('');
    console.log('✅ ABI 同步完成');
    console.log('');
  } catch (error) {
    console.error('');
    console.error('❌ ABI 同步失败，但将继续构建流程');
    console.error('   如果已存在 ABI 文件，可设置 SKIP_ABI_SYNC=true 跳过此步骤');
    console.error('');
    // 不退出，允许构建继续（使用旧的 ABI 文件）
  }
}

// 主流程
console.log('[步骤 1] 检查 ABI 更新需求');
console.log('-'.repeat(60));

if (needUpdateABI()) {
  console.log('');
  console.log('[步骤 2] 开始同步 ABI');
  console.log('-'.repeat(60));
  syncABIs();
} else {
  console.log('');
  console.log('[跳过] ABI 已是最新，无需同步');
}

console.log('='.repeat(60));
console.log('  构建前检查完成，继续构建流程...');
console.log('='.repeat(60));
console.log('');
