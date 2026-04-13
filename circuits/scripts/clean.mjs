#!/usr/bin/env node

/**
 * 清理电路层构建产物
 *
 * 功能：
 * - 清理所有编译产物（R1CS, WASM, zkey, vkey 等）
 * - 清理 PTAU 中间文件
 * - 保留最终的 PTAU 文件
 * - 可选择性保留 zkey 文件
 *
 * 使用示例：
 *   npm run clean              # 清理所有（保留 pot*_final.ptau）
 *   npm run clean:zkey         # 仅清理 zkey 文件
 *   npm run clean:build        # 仅清理 build 目录
 *   npm run clean:all          # 清理所有（包括 PTAU）
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const circuitsRoot = path.join(__dirname, '..');
const buildDir = path.join(circuitsRoot, 'build');
const paramsDir = path.join(circuitsRoot, 'params');

/**
 * 删除文件
 */
function deleteFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`  [删除] ${path.basename(filePath)}`);
    return true;
  }
  return false;
}

/**
 * 删除目录
 */
function deleteDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    console.log(`  [删除] ${path.basename(dirPath)}/`);
    return true;
  }
  return false;
}

/**
 * 清理 build 目录
 */
function cleanBuild(keepZkey = false) {
  console.log('\n============================================================');
  console.log('  清理 build 目录');
  console.log('============================================================');

  if (!fs.existsSync(buildDir)) {
    console.log('[跳过] build 目录不存在');
    return;
  }

  const circuits = fs.readdirSync(buildDir);
  let deletedCount = 0;

  for (const circuit of circuits) {
    const circuitDir = path.join(buildDir, circuit);
    if (!fs.statSync(circuitDir).isDirectory()) {
      continue;
    }

    const files = fs.readdirSync(circuitDir);
    for (const file of files) {
      const filePath = path.join(circuitDir, file);

      // 如果保留 zkey，跳过 final.zkey 文件
      if (keepZkey && file.endsWith('_final.zkey')) {
        continue;
      }

      deleteFile(filePath);
      deletedCount++;
    }

    // 如果目录为空，删除目录
    const circuitDirPath = path.join(buildDir, circuit);
    if (fs.existsSync(circuitDirPath) && fs.readdirSync(circuitDirPath).length === 0) {
      deleteDir(circuitDirPath);
    }
  }

  console.log(`\n[完成] 清理了 ${deletedCount} 个文件`);
}

/**
 * 清理 params 目录
 */
function cleanParams(keepFinal = true) {
  console.log('\n============================================================');
  console.log('  清理 params 目录');
  console.log('============================================================');

  if (!fs.existsSync(paramsDir)) {
    console.log('[跳过] params 目录不存在');
    return;
  }

  const files = fs.readdirSync(paramsDir);
  let deletedCount = 0;

  for (const file of files) {
    const filePath = path.join(paramsDir, file);

    // 跳过最终 PTAU 文件
    if (keepFinal && file.endsWith('_final.ptau')) {
      console.log(`  [保留] ${file}`);
      continue;
    }

    // 跳过 log.txt
    if (file === 'log.txt') {
      continue;
    }

    deleteFile(filePath);
    deletedCount++;
  }

  console.log(`\n[完成] 清理了 ${deletedCount} 个文件`);
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'default';

  console.log('\n' + '='.repeat(60));
  console.log('  电路层清理工具');
  console.log('='.repeat(60));
  console.log(`[模式] ${mode}`);

  switch (mode) {
    case 'zkey':
      // 仅清理 zkey 文件
      cleanBuild(false);
      break;

    case 'build':
      // 仅清理 build 目录（保留 zkey）
      cleanBuild(true);
      break;

    case 'all':
      // 清理所有（包括 PTAU）
      cleanBuild(false);
      cleanParams(false);
      break;

    case 'default':
    default:
      // 默认：清理所有但保留最终 PTAU
      cleanBuild(false);
      cleanParams(true);
      break;
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ 清理完成');
  console.log('='.repeat(60));
  console.log('\n[提示]');
  console.log('  npm run clean              # 清理所有（保留最终 PTAU）');
  console.log('  npm run clean:zkey         # 仅清理 zkey 文件');
  console.log('  npm run clean:build        # 仅清理 build 目录');
  console.log('  npm run clean:all          # 清理所有（包括 PTAU）');
  console.log('='.repeat(60) + '\n');
}

try {
  main();
} catch (err) {
  console.error('[错误]', err);
  process.exit(1);
}
