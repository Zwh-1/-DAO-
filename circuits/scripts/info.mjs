#!/usr/bin/env node

/**
 * 显示电路层信息脚本
 * 
 * 功能：
 * 1. 显示电路编译状态
 * 2. 显示 zkey 文件信息
 * 3. 显示证明文件统计
 * 4. 显示约束数量和性能指标
 * 
 * 使用示例：
 *   npm run info:circuits
 *   node scripts/info.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const circuitsRoot = path.join(__dirname, '..');

/**
 * 检查文件是否存在
 */
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

/**
 * 获取文件大小（人类可读格式）
 */
function getFileSize(filePath) {
  if (!fileExists(filePath)) {
    return '不存在';
  }
  
  const stats = fs.statSync(filePath);
  const size = stats.size;
  
  if (size < 1024) {
    return `${size} B`;
  } else if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(2)} KB`;
  } else if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  } else {
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}

/**
 * 获取文件修改时间
 */
function getFileModifiedTime(filePath) {
  if (!fileExists(filePath)) {
    return '不存在';
  }
  
  const stats = fs.statSync(filePath);
  return stats.mtime.toLocaleString('zh-CN');
}

/**
 * 获取 R1CS 文件信息
 */
function getR1csInfo(r1csPath) {
  if (!fileExists(r1csPath)) {
    return null;
  }
  
  try {
    // 使用 snarkjs 获取 R1CS 信息
    const output = execSync(`npx snarkjs r1cs info "${r1csPath}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    });
    
    // 解析输出
    const info = {
      exists: true,
      path: r1csPath,
    };
    
    // 提取关键信息
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('Constraints:')) {
        info.constraints = parseInt(line.split(':')[1].trim());
      } else if (line.includes('Private Inputs:')) {
        info.privateInputs = parseInt(line.split(':')[1].trim());
      } else if (line.includes('Public Inputs:')) {
        info.publicInputs = parseInt(line.split(':')[1].trim());
      } else if (line.includes('Outputs:')) {
        info.outputs = parseInt(line.split(':')[1].trim());
      } else if (line.includes('Wires:')) {
        info.wires = parseInt(line.split(':')[1].trim());
      }
    }
    
    return info;
  } catch (error) {
    return {
      exists: true,
      path: r1csPath,
      error: '无法解析 R1CS 信息'
    };
  }
}

/**
 * 显示电路信息
 */
function displayCircuitInfo(circuitName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`电路：${circuitName}`);
  console.log('='.repeat(60));
  
  const buildDir = path.join(circuitsRoot, 'build', circuitName);
  const srcDir = path.join(circuitsRoot, 'src');
  
  // 源文件
  const circomPath = path.join(srcDir, `${circuitName}.circom`);
  console.log(`\n📄 源文件:`);
  console.log(`   路径：${circomPath}`);
  console.log(`   状态：${fileExists(circomPath) ? '✅ 存在' : '❌ 不存在'}`);
  console.log(`   大小：${getFileSize(circomPath)}`);
  console.log(`   修改时间：${getFileModifiedTime(circomPath)}`);
  
  // R1CS 文件
  const r1csPath = path.join(buildDir, `${circuitName}.r1cs`);
  const r1csInfo = getR1csInfo(r1csPath);
  console.log(`\n🔷 R1CS 文件:`);
  console.log(`   路径：${r1csPath}`);
  console.log(`   状态：${r1csInfo ? '✅ 已编译' : '❌ 未编译'}`);
  console.log(`   大小：${getFileSize(r1csPath)}`);
  
  if (r1csInfo && r1csInfo.constraints) {
    console.log(`   约束数量：${r1csInfo.constraints}`);
    console.log(`   私有输入：${r1csInfo.privateInputs || 0}`);
    console.log(`   公开输入：${r1csInfo.publicInputs || 0}`);
    console.log(`   输出：${r1csInfo.outputs || 0}`);
    console.log(`   Wires: ${r1csInfo.wires || 0}`);
  }
  
  // 符号表
  const symPath = path.join(buildDir, `${circuitName}.sym`);
  console.log(`\n📋 符号表:`);
  console.log(`   路径：${symPath}`);
  console.log(`   状态：${fileExists(symPath) ? '✅ 存在' : '❌ 不存在'}`);
  console.log(`   大小：${getFileSize(symPath)}`);
  
  // WASM 文件
  const wasmPath = path.join(buildDir, `${circuitName}_js`, `${circuitName}.wasm`);
  console.log(`\n⚙️ WASM 文件:`);
  console.log(`   路径：${wasmPath}`);
  console.log(`   状态：${fileExists(wasmPath) ? '✅ 存在' : '❌ 不存在 (需要 WSL/Docker)'}`);
  console.log(`   大小：${getFileSize(wasmPath)}`);
  
  // zkey 文件
  const zkeyInitPath = path.join(buildDir, `${circuitName}_0000.zkey`);
  const zkeyFinalPath = path.join(buildDir, `${circuitName}_final.zkey`);
  console.log(`\n🔑 ZKEY 文件:`);
  console.log(`   初始 zkey: ${getFileSize(zkeyInitPath)} (${getFileModifiedTime(zkeyInitPath)})`);
  console.log(`   最终 zkey: ${getFileSize(zkeyFinalPath)} (${getFileModifiedTime(zkeyFinalPath)})`);
  console.log(`   状态：${fileExists(zkeyFinalPath) ? '✅ 已完成可信设置' : '⚠️  需要运行 zk:setup'}`);
  
  // 验证密钥
  const vkeyPath = path.join(buildDir, 'vkey.json');
  console.log(`\n🔐 验证密钥:`);
  console.log(`   路径：${vkeyPath}`);
  console.log(`   状态：${fileExists(vkeyPath) ? '✅ 存在' : '❌ 不存在'}`);
  console.log(`   大小：${getFileSize(vkeyPath)}`);
  
  return {
    name: circuitName,
    r1csInfo,
    hasZkey: fileExists(zkeyFinalPath),
    hasWasm: fileExists(wasmPath)
  };
}

/**
 * 显示证明文件统计
 */
function displayProofsStats() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 证明文件统计');
  console.log('='.repeat(60));
  
  const proofsDir = path.join(circuitsRoot, 'proofs');
  
  if (!fileExists(proofsDir)) {
    console.log('\nℹ️  证明目录不存在');
    return;
  }
  
  const files = fs.readdirSync(proofsDir);
  const proofFiles = files.filter(f => f.startsWith('proof_') && f.endsWith('.json'));
  const publicFiles = files.filter(f => f.startsWith('public_') && f.endsWith('.json'));
  
  console.log(`\n📁 证明目录：${proofsDir}`);
  console.log(`📄 证明文件：${proofFiles.length} 个`);
  console.log(`📤 公开信号：${publicFiles.length} 个`);
  
  if (proofFiles.length > 0) {
    console.log(`\n最新证明:`);
    const latestProof = proofFiles.sort().reverse()[0];
    const proofPath = path.join(proofsDir, latestProof);
    console.log(`   文件名：${latestProof}`);
    console.log(`   大小：${getFileSize(proofPath)}`);
    console.log(`   时间：${getFileModifiedTime(proofPath)}`);
  }
}

/**
 * 显示 PTAU 文件信息
 */
function displayPTAUInfo() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('🌟 公开参数文件 (PTAU)');
  console.log('='.repeat(60));
  
  const paramsDir = path.join(circuitsRoot, 'params');
  const ptauPath = path.join(paramsDir, 'pot12_final.ptau');
  
  console.log(`\n📁 PTAU 目录：${paramsDir}`);
  console.log(`📄 文件：pot12_final.ptau`);
  console.log(`   路径：${ptauPath}`);
  console.log(`   状态：${fileExists(ptauPath) ? '✅ 存在' : '❌ 不存在 (需要手动下载)'}`);
  console.log(`   大小：${getFileSize(ptauPath)}`);
  console.log(`   修改时间：${getFileModifiedTime(ptauPath)}`);
  
  if (fileExists(ptauPath)) {
    const stats = fs.statSync(ptauPath);
    const minSize = 1.7 * 1024 * 1024 * 1024; // 1.7GB
    
    if (stats.size >= minSize) {
      console.log(`   验证：✅ 文件大小正常`);
    } else {
      console.log(`   验证：⚠️  文件可能不完整 (预期 > 1.7GB)`);
    }
  } else {
    console.log(`\n💡 下载地址:`);
    console.log(`   https://hermez.s3-eu-west-1.amazonaws.com/pot12_final.ptau`);
  }
}

/**
 * 显示整体状态
 */
function displayOverallStatus(circuits) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 整体状态');
  console.log('='.repeat(60));
  
  const totalCircuits = circuits.length;
  const compiledCircuits = circuits.filter(c => c.r1csInfo).length;
  const readyCircuits = circuits.filter(c => c.hasZkey && c.hasWasm).length;
  
  console.log(`\n📈 统计:`);
  console.log(`   总电路数：${totalCircuits}`);
  console.log(`   已编译：${compiledCircuits}`);
  console.log(`   可生成证明：${readyCircuits}`);
  
  console.log(`\n📋 电路列表:`);
  circuits.forEach(circuit => {
    const status = circuit.hasZkey && circuit.hasWasm 
      ? '✅ 就绪' 
      : circuit.r1csInfo 
        ? '⚠️  需要 WASM' 
        : '❌ 未编译';
    
    console.log(`   - ${circuit.name}: ${status}`);
  });
  
  console.log(`\n🚀 下一步:`);
  if (readyCircuits === 0) {
    console.log(`   1. 编译电路：npm run compile:identity`);
    console.log(`   2. 下载 PTAU：手动下载 pot12_final.ptau`);
    console.log(`   3. 可信设置：npm run zk:setup`);
    console.log(`   4. 生成 WASM：使用 WSL/Docker`);
  } else {
    console.log(`   ✅ 所有电路已就绪，可以生成证明`);
    console.log(`   运行：npm run zk:prove`);
  }
}

/**
 * 主函数
 */
function main() {
  console.log('\n' + '📊 '.repeat(30));
  console.log('电路层信息系统');
  console.log('📊 '.repeat(30));
  
  console.log(`\n📁 项目根目录：${circuitsRoot}`);
  console.log(`📅 当前时间：${new Date().toLocaleString('zh-CN')}`);
  
  // 检测电路
  const srcDir = path.join(circuitsRoot, 'src');
  const circuitFiles = fs.readdirSync(srcDir)
    .filter(f => f.endsWith('.circom'))
    .map(f => f.replace('.circom', ''));
  
  console.log(`\n🔍 检测到 ${circuitFiles.length} 个电路:`);
  circuitFiles.forEach(f => console.log(`   - ${f}`));
  
  // 显示每个电路的详细信息
  const circuitInfos = [];
  for (const circuitName of circuitFiles) {
    const info = displayCircuitInfo(circuitName);
    circuitInfos.push(info);
  }
  
  // 显示 PTAU 信息
  displayPTAUInfo();
  
  // 显示证明统计
  displayProofsStats();
  
  // 显示整体状态
  displayOverallStatus(circuitInfos);
  
  console.log('\n' + '✅ '.repeat(30));
  console.log('信息展示完成');
  console.log('✅ '.repeat(30));
}

// 执行主函数
main().catch(error => {
  console.error('\n❌ 发生未预期的错误:', error);
  console.error(error.stack);
  process.exit(1);
});
