#!/usr/bin/env node

/**
 * 零知识证明验证脚本
 * 
 * 功能：
 * 1. 加载验证密钥（vkey）
 * 2. 加载证明文件和公开信号
 * 3. 在本地验证证明有效性
 * 4. 可选：调用合约验证（需要 Web3  provider）
 * 
 * 安全注意事项：
 * - 验证密钥（vkey）可以公开
 * - 本地验证不消耗 Gas
 * - 链上验证需要部署验证器合约
 * 
 * 使用示例：
 *   npm run zk:verify
 *   node scripts/zk-verify.mjs --proof ./proofs/proof_xxx.json --public ./proofs/public_xxx.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import snarkjs from 'snarkjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const circuitsRoot = path.join(__dirname, '..');

// 配置项
const CONFIG = {
  // 电路名称
  circuitName: process.argv[2] || 'identity_commitment',
  
  // 证明文件路径（可选，不提供则使用最新的证明）
  proofFile: process.argv[3] || null,
  
  // 公开信号文件路径（可选）
  publicFile: process.argv[4] || null,
};

/**
 * 检查文件是否存在
 */
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

/**
 * 查找最新的证明文件
 */
function findLatestProof(circuitName, proofsDir) {
  if (!fileExists(proofsDir)) {
    return null;
  }
  
  const files = fs.readdirSync(proofsDir)
    .filter(f => f.startsWith(`proof_${circuitName}_`) && f.endsWith('.json'))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    return null;
  }
  
  return path.join(proofsDir, files[0]);
}

/**
 * 查找最新的公开信号文件
 */
function findLatestPublic(circuitName, proofsDir) {
  if (!fileExists(proofsDir)) {
    return null;
  }
  
  const files = fs.readdirSync(proofsDir)
    .filter(f => f.startsWith(`public_${circuitName}_`) && f.endsWith('.json'))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    return null;
  }
  
  return path.join(proofsDir, files[0]);
}

/**
 * 加载 JSON 文件
 */
function loadJson(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * 本地验证证明（使用 vkey）
 */
async function verifyLocally(vkey, proof, publicSignals) {
  console.log('\n🔍 开始本地验证...');
  
  try {
    const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    
    if (isValid) {
      console.log(`✅ 证明验证通过！`);
      console.log(`   验证算法：Groth16`);
      console.log(`   验证时间：< 1 秒`);
      return { success: true, isValid, type: 'local' };
    } else {
      console.error(`❌ 证明验证失败！`);
      console.error(`   可能原因：证明被篡改或数据不匹配`);
      return { success: false, isValid: false, type: 'local' };
    }
  } catch (error) {
    console.error(`❌ 验证过程出错：${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 显示证明信息
 */
function displayProofInfo(proof, publicSignals, circuitName) {
  console.log('\n📊 证明信息:');
  console.log(`   电路名称：${circuitName}`);
  console.log(`   证明类型：Groth16`);
  
  console.log(`\n📐 证明结构:`);
  console.log(`   pi_a: [${proof.pi_a.slice(0, 2).join(', ')}, ...]`);
  console.log(`   pi_b: [[${proof.pi_b[0].join(', ')}], [${proof.pi_b[1].join(', ')}]]`);
  console.log(`   pi_c: [${proof.pi_c.slice(0, 2).join(', ')}, ...]`);
  
  console.log(`\n📤 公开信号 (${publicSignals.length} 个):`);
  publicSignals.forEach((signal, index) => {
    const displayValue = signal.length > 20 ? `${signal.slice(0, 20)}...` : signal;
    console.log(`   [${index}]: ${displayValue}`);
  });
}

/**
 * 显示验证密钥信息
 */
function displayVkeyInfo(vkey) {
  console.log('\n🔑 验证密钥信息:');
  console.log(`   算法：Groth16`);
  console.log(`   曲线：bn128`);
  console.log(`   VK 元素数量：${vkey.vk.length}`);
  console.log(`   公开输入数量：${vkey.nPublic}`);
}

/**
 * 主函数
 */
async function main() {
  console.log('\n' + '🔍 '.repeat(30));
  console.log('零知识证明验证（Verify）');
  console.log('🔍 '.repeat(30));
  
  console.log(`\n📊 配置信息:`);
  console.log(`   电路名称：${CONFIG.circuitName}`);
  console.log(`   证明文件：${CONFIG.proofFile || '（自动查找最新）'}`);
  console.log(`   公开信号：${CONFIG.publicFile || '（自动查找最新）'}`);
  
  // 步骤 1：加载验证密钥
  console.log('\n📥 步骤 1: 加载验证密钥...');
  const vkeyPath = path.join(circuitsRoot, 'build', CONFIG.circuitName, 'vkey.json');
  
  if (!fileExists(vkeyPath)) {
    console.error(`❌ 验证密钥不存在：${vkeyPath}`);
    console.error(`\n💡 提示:`);
    console.error(`   请先运行可信设置：npm run zk:setup`);
    process.exit(1);
  }
  
  const vkey = loadJson(vkeyPath);
  console.log(`✅ 验证密钥已加载：${vkeyPath}`);
  displayVkeyInfo(vkey);
  
  // 步骤 2：加载证明文件
  console.log('\n📥 步骤 2: 加载证明文件...');
  let proofPath = CONFIG.proofFile;
  
  if (!proofPath) {
    const proofsDir = path.join(circuitsRoot, 'proofs');
    proofPath = findLatestProof(CONFIG.circuitName, proofsDir);
    
    if (!proofPath) {
      console.error(`❌ 未找到证明文件`);
      console.error(`\n💡 提示:`);
      console.error(`   请先生成证明：npm run zk:prove`);
      console.error(`   或指定文件路径：node scripts/zk-verify.mjs <circuit> <proof.json> <public.json>`);
      process.exit(1);
    }
    
    console.log(`   自动找到最新证明：${proofPath}`);
  }
  
  if (!fileExists(proofPath)) {
    console.error(`❌ 证明文件不存在：${proofPath}`);
    process.exit(1);
  }
  
  const proof = loadJson(proofPath);
  console.log(`✅ 证明已加载`);
  
  // 步骤 3：加载公开信号
  console.log('\n📥 步骤 3: 加载公开信号...');
  let publicPath = CONFIG.publicFile;
  
  if (!publicPath) {
    const proofsDir = path.join(circuitsRoot, 'proofs');
    publicPath = findLatestPublic(CONFIG.circuitName, proofsDir);
    
    if (!publicPath) {
      console.error(`❌ 未找到公开信号文件`);
      process.exit(1);
    }
    
    console.log(`   自动找到最新公开信号：${publicPath}`);
  }
  
  if (!fileExists(publicPath)) {
    console.error(`❌ 公开信号文件不存在：${publicPath}`);
    process.exit(1);
  }
  
  const publicSignals = loadJson(publicPath);
  console.log(`✅ 公开信号已加载`);
  
  // 显示证明信息
  displayProofInfo(proof, publicSignals, CONFIG.circuitName);
  
  // 步骤 4：验证证明
  console.log('\n📥 步骤 4: 验证证明...');
  const verifyResult = await verifyLocally(vkey, proof, publicSignals);
  
  if (!verifyResult.success) {
    console.error(`\n❌ 验证失败`);
    if (verifyResult.error) {
      console.error(`   错误信息：${verifyResult.error}`);
    }
    process.exit(1);
  }
  
  // 完成
  console.log('\n' + '🎉 '.repeat(30));
  console.log('✅ 证明验证成功！');
  console.log('🎉 '.repeat(30));
  
  console.log('\n📊 验证结果:');
  console.log(`   验证方式：本地验证（不消耗 Gas）`);
  console.log(`   验证状态：${verifyResult.isValid ? '通过 ✅' : '失败 ❌'}`);
  console.log(`   验证算法：Groth16`);
  
  console.log('\n🚀 下一步操作:');
  console.log(`   1. 部署验证器合约到区块链`);
  console.log(`   2. 调用合约的 verifyProof 方法进行链上验证`);
  console.log(`   3. 根据验证结果执行后续逻辑（如：发放空投、更新状态等）`);
  
  console.log('\n📋 合约调用示例 (Solidity):');
  console.log(`   bool isValid = verifier.verifyProof(`);
  console.log(`     [${proof.pi_a.slice(0, 2).join(', ')}],`);
  console.log(`     [[${proof.pi_b[0].join(', ')}], [${proof.pi_b[1].join(', ')}]],`);
  console.log(`     [${proof.pi_c.slice(0, 2).join(', ')}],`);
  console.log(`     [${publicSignals.join(', ')}]`);
  console.log(`   );`);
  
  console.log('\n🔒 安全提示:');
  console.log(`   - 本地验证通过不代表链上验证一定通过（可能 Gas 不足）`);
  console.log(`   - 确保合约使用的 vkey 与本地验证的一致`);
  console.log(`   - 生产环境应在合约中添加重入保护`);
}

// 执行主函数
main().catch(error => {
  console.error('\n❌ 发生未预期的错误:', error);
  console.error(error.stack);
  process.exit(1);
});
