#!/usr/bin/env node

/**
 * 编译合约并导出 ABI 脚本
 * 
 * 用途：
 * - 自动编译 Solidity 合约
 * - 从编译产物中提取 ABI
 * - 导出至后端存储目录（backend/src/abis/）
 * - 自动生成 index.js 统一导出文件
 * 
 * 使用方法：
 * ```bash
 * # 编译并导出所有合约 ABI
 * npm run compile-and-export
 * 
 * # 或直接在 backend 目录运行
 * npm run sync-abis
 * ```
 * 
 * 安全规范：
 * - 仅导出 ABI（接口定义），不包含敏感信息
 * - 导出的 ABI 文件可安全提交至版本控制
 * - 自动过滤测试合约和辅助合约
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// 项目根目录
const PROJECT_ROOT = path.join(__dirname, '..');

// Hardhat 命令
const HARDHAT_COMPILE = 'npx hardhat compile';

console.log('='.repeat(60));
console.log('  合约编译与 ABI 导出工具');
console.log('='.repeat(60));
console.log('');

/**
 * 执行命令并输出日志
 * 
 * @param {string} command - 要执行的命令
 * @param {string} cwd - 工作目录
 */
function runCommand(command, cwd = PROJECT_ROOT) {
  console.log(`[执行] ${command}`);
  console.log(`[目录] ${cwd}`);
  console.log('');
  
  try {
    const output = execSync(command, {
      cwd,
      stdio: 'inherit',  // 直接输出到控制台
      encoding: 'utf-8'
    });
    
    return { success: true, output };
  } catch (error) {
    console.error(`[错误] 命令执行失败：${error.message}`);
    return { success: false, error };
  }
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);
  const forceCompile = args.includes('--force') || args.includes('-f');
  const skipCompile = args.includes('--skip-compile') || args.includes('-s');
  
  // 步骤 1: 编译合约
  if (!skipCompile) {
    console.log('步骤 1: 编译 Solidity 合约');
    console.log('-'.repeat(60));
    
    // 检查是否需要编译（如果 artifacts 已存在且未强制编译，则跳过）
    const artifactsDir = path.join(PROJECT_ROOT, 'artifacts');
    const needCompile = forceCompile || !fs.existsSync(artifactsDir);
    
    if (needCompile) {
      console.log('[状态] 需要编译合约');
      const result = runCommand(HARDHAT_COMPILE);
      
      if (!result.success) {
        console.error('');
        console.error('❌ 合约编译失败，请检查错误信息');
        console.error('');
        process.exit(1);
      }
      
      console.log('');
      console.log('✅ 合约编译完成');
    } else {
      console.log('[状态] 编译产物已存在，跳过编译（使用 --force 强制编译）');
    }
    
    console.log('');
  } else {
    console.log('步骤 1: 跳过编译（使用 --skip-compile 参数）');
    console.log('');
  }
  
  // 步骤 2: 导出 ABI
  console.log('步骤 2: 导出 ABI 到后端目录');
  console.log('-'.repeat(60));
  
  const exportScript = path.join(__dirname, 'export-abis.js');
  const exportResult = runCommand(`node "${exportScript}"`, path.dirname(exportScript));
  
  if (!exportResult.success) {
    console.error('');
    console.error('❌ ABI 导出失败');
    console.error('');
    process.exit(1);
  }
  
  console.log('');
  console.log('='.repeat(60));
  console.log('  ✅ 所有步骤完成！');
  console.log('='.repeat(60));
  console.log('');
  console.log('下一步：');
  console.log('  1. 在后端项目中运行：yarn build');
  console.log('  2. 验证 services 层是否正确导入 ABI');
  console.log('');
}

// 执行
main();
