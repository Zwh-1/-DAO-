#!/usr/bin/env node

/**
 * Git 自动提交与推送脚本 - Node.js 版本
 * 
 * 用法:
 *   node scripts/git-push.mjs                           # 使用默认提交信息
 *   node scripts/git-push.mjs "feat: 添加新功能"        # 使用自定义提交信息
 *   node scripts/git-push.mjs --preview                 # 预览变更，不提交
 *   node scripts/git-push.mjs --no-push                # 只提交，不推送
 */

import { execSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// 解析命令行参数
const args = process.argv.slice(2);
const PREVIEW = args.includes('--preview') || args.includes('-p');
const NO_PUSH = args.includes('--no-push') || args.includes('-n');
const COMMIT_MESSAGE = args.find(arg => !arg.startsWith('-')) || 'chore: 代码更新';

// 颜色代码
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  gray: '\x1b[90m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function exec(command, options = {}) {
  try {
    return execSync(command, { 
      encoding: 'utf-8', 
      cwd: PROJECT_ROOT,
      ...options 
    });
  } catch (error) {
    if (options.ignoreError) {
      return null;
    }
    throw error;
  }
}

function main() {
  log('========================================', 'cyan');
  log('TrustAid Git 自动提交工具', 'cyan');
  log('========================================', 'cyan');
  log('');

  // 切换到项目根目录
  process.chdir(PROJECT_ROOT);
  log(`项目目录：${PROJECT_ROOT}`, 'gray');
  log('');

  try {
    // 检查 Git 仓库
    try {
      exec('git rev-parse --git-dir', { ignoreError: true });
    } catch {
      log('❌ 错误：当前目录不是 Git 仓库', 'red');
      process.exit(1);
    }

    // 获取 Git 状态
    log('[1/4] 检查 Git 状态...', 'yellow');
    const statusOutput = exec('git status --porcelain', { ignoreError: true }) || '';
    const statusLines = statusOutput.split('\n').filter(line => line.trim() !== '');

    if (statusLines.length === 0) {
      log('✅ 工作区干净，无需提交', 'green');
      log('');
      process.exit(0);
    }

    log(`发现 ${statusLines.length} 个变更:`, 'cyan');
    statusLines.forEach(line => {
      const statusChar = line.substring(0, 2);
      const file = line.substring(3);
      
      let color = 'gray';
      if (statusChar.match(/^M/)) color = 'yellow';
      else if (statusChar.match(/^A/)) color = 'green';
      else if (statusChar.match(/^D/)) color = 'red';
      else if (statusChar.match(/^\?\?/)) color = 'cyan';
      
      log(`  ${statusChar} ${file}`, color);
    });
    log('');

    // 预览模式
    if (PREVIEW) {
      log('👁️  预览模式 - 未执行提交', 'cyan');
      log('');
      log('提示:', 'cyan');
      log('  node scripts/git-push.mjs                     # 使用默认提交信息', 'gray');
      log('  node scripts/git-push.mjs "feat: 新功能"      # 使用自定义提交信息', 'gray');
      log('  node scripts/git-push.mjs --preview           # 预览变更', 'gray');
      log('');
      process.exit(0);
    }

    // 添加所有变更
    log('[2/4] 添加文件到暂存区...', 'yellow');
    exec('git add .');
    log('✅ 文件已添加', 'green');
    log('');

    // 提交
    log('[3/4] 提交变更...', 'yellow');
    log(`提交信息：${COMMIT_MESSAGE}`, 'gray');
    exec(`git commit -m "${COMMIT_MESSAGE}"`);
    log('✅ 提交成功', 'green');
    log('');

    // 推送
    if (!NO_PUSH) {
      log('[4/4] 推送到远程仓库...', 'yellow');
      
      // 先拉取最新代码
      log('  → 拉取远程代码...', 'gray');
      try {
        exec('git pull --rebase origin master');
      } catch (error) {
        log('⚠️  拉取失败，可能存在冲突', 'yellow');
        log('提示：请手动解决冲突后运行 git push', 'gray');
        process.exit(1);
      }
      
      // 推送
      exec('git push origin master');
      log('✅ 推送成功', 'green');
      log('');
    } else {
      log('⏭️  跳过推送（使用 --no-push 参数）', 'cyan');
      log('');
    }

    // 显示提交摘要
    log('========================================', 'cyan');
    log('✅ 操作完成！', 'green');
    log('========================================', 'cyan');
    log('');
    
    const commitHash = exec('git rev-parse --short HEAD').trim();
    log(`提交哈希：${commitHash}`, 'gray');
    log(`仓库地址：git@github.com:Zwh-1/-DAO-.git`, 'gray');
    log('');
    log('查看历史:', 'cyan');
    log('  git log --oneline -5', 'gray');
    log('');

  } catch (error) {
    log(`❌ 发生错误：${error.message}`, 'red');
    if (error.stderr) {
      log(error.stderr.toString(), 'gray');
    }
    process.exit(1);
  }
}

main();
