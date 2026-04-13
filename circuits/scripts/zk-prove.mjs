#!/usr/bin/env node

/**
 * 零知识证明生成脚本
 *
 * 功能：
 * 1. 加载电路的 WASM 文件和最终 zkey
 * 2. 对输入 JSON 进行模式校验（Schema Validation）
 * 3. 在本地生成零知识证明（私有见证人绝不离端）
 * 4. 输出证明文件和公开信号
 *
 * 安全承诺：
 * - 私有输入（secret、trapdoor、social_id_hash、user_level 等）绝不离端
 * - 证明生成在用户本地完成，明文不发送至服务器
 * - 严禁将私有输入记录到日志或控制台
 *
 * 用法：
 *   node scripts/zk-prove.mjs <circuit_name> [input_file.json]
 *   node scripts/zk-prove.mjs anti_sybil_verifier ./inputs/my_input.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import snarkjs from 'snarkjs';

// ── Node.js 版本强制检查 ───────────────────────────────────────────────────────
const [nodeMajor] = process.versions.node.split('.').map(Number);
if (nodeMajor < 18) {
  console.error(`[环境错误] Node.js 版本不足：当前 v${process.versions.node}，要求 >= v18.0.0`);
  console.error(`           snarkjs 在旧版本 Node.js 下存在内存溢出风险`);
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const circuitsRoot = path.join(__dirname, '..');

const CONFIG = {
  circuitName: process.argv[2] || 'identity_commitment',
  inputFile:   process.argv[3] || null,
  outputDir:   path.join(circuitsRoot, 'proofs'),
};

// ═══════════════════════════════════════════════════════════════════════════════
// 电路输入 Schema 定义
//
// [修复: 输入验证缺失] snarkjs.groth16.fullProve 在缺少字段时会抛出底层
// C++/WASM 异常，开发者无法区分是"输入字段缺失"还是"电路约束不满足"。
// 本 Schema 在调用 fullProve 之前进行完整性校验，提供准确的错误定位。
//
// Schema 结构：
//   required: string[]         — 必须存在的字段名
//   arrays:   { field, length } — 必须是指定长度数组的字段
//   numeric:  string[]         — 必须是数值字符串（或 BigInt 兼容值）的字段
// ═══════════════════════════════════════════════════════════════════════════════
const CIRCUIT_SCHEMAS = {
  // ── identity_commitment 电路 ─────────────────────────────────────────────────
  // 公开: social_id_hash | 私有: secret, trapdoor
  identity_commitment: {
    required: ['social_id_hash', 'secret', 'trapdoor'],
    arrays:   [],
    numeric:  ['social_id_hash', 'secret', 'trapdoor'],
    description: '身份承诺生成电路（social_id_hash 须 < 2^254，链下预处理）',
  },

  // ── anti_sybil_verifier 电路 ──────────────────────────────────────────────────
  // 公开: merkle_root, nullifier_hash, min_level, min_amount, max_amount,
  //       claim_amount, claim_ts, ts_start, ts_end
  // 私有: secret, trapdoor, social_id_hash, user_level, airdrop_project_id,
  //       pathElements[20], pathIndex[20]
  // [修复] identity_commitment 已从公开输入移除（现在由电路内部计算）
  // [修复] nullifier → nullifier_hash（命名与电路信号一致）
  // [修复] pathElements/pathIndex 数组长度从 8 升级为 20（Merkle 层级对齐）
  anti_sybil_verifier: {
    required: [
      // 私有见证人（绝不离端）
      'secret', 'trapdoor', 'social_id_hash', 'user_level',
      'airdrop_project_id', 'pathElements', 'pathIndex',
      // 公开输入（链上可验证）
      'merkle_root', 'nullifier_hash',
      'min_level', 'min_amount', 'max_amount', 'claim_amount',
      'claim_ts', 'ts_start', 'ts_end',
    ],
    arrays: [
      { field: 'pathElements', length: 20 },
      { field: 'pathIndex',    length: 20 },
    ],
    numeric: [
      'secret', 'trapdoor', 'social_id_hash', 'user_level',
      'airdrop_project_id', 'merkle_root', 'nullifier_hash',
      'min_level', 'min_amount', 'max_amount', 'claim_amount',
      'claim_ts', 'ts_start', 'ts_end',
    ],
    description: '完整抗女巫身份验证电路（20 层 Merkle，包含等级锚定与时间窗口）',
  },

  // ── antiSybilClaim 电路 ───────────────────────────────────────────────────────
  // 公开: expectedNullifierHash, claimAmount, maxClaimAmount
  // 私有: identitySecret, airdropId
  antiSybilClaim: {
    required: [
      'identitySecret', 'airdropId',
      'expectedNullifierHash', 'claimAmount', 'maxClaimAmount',
    ],
    arrays:  [],
    numeric: [
      'identitySecret', 'airdropId',
      'expectedNullifierHash', 'claimAmount', 'maxClaimAmount',
    ],
    description: '申领防重放验证电路（轻量版，仅含 Nullifier + 金额约束）',
  },
};

/**
 * 输入字段完整性校验
 *
 * 在调用 fullProve 之前执行，将底层 WASM 异常转化为可读的字段级错误信息。
 * 同时校验数组长度、数值格式，防止因电路参数变更导致的静默错误。
 */
function validateInput(circuitName, input) {
  const schema = CIRCUIT_SCHEMAS[circuitName];
  if (!schema) {
    console.warn(`[警告] 未找到电路 "${circuitName}" 的 Schema，跳过输入校验`);
    return { valid: true, errors: [] };
  }

  const errors = [];

  // 1. 必要字段存在性检查
  for (const field of schema.required) {
    if (input[field] === undefined || input[field] === null) {
      errors.push(`缺少必要字段: "${field}"`);
    }
  }

  // 2. 数组长度检查
  for (const { field, length } of schema.arrays) {
    if (input[field] !== undefined) {
      if (!Array.isArray(input[field])) {
        errors.push(`字段 "${field}" 应为数组，实际类型: ${typeof input[field]}`);
      } else if (input[field].length !== length) {
        errors.push(
          `字段 "${field}" 数组长度错误：期望 ${length}，实际 ${input[field].length}` +
          `（请确认 Merkle 树层级配置与电路参数 merkleLevels=${length} 一致）`
        );
      }
    }
  }

  // 3. 数值格式检查（数值字段必须为数字、数字字符串或 BigInt 兼容的字符串）
  const numericRe = /^-?\d+$/;
  for (const field of schema.numeric) {
    const val = input[field];
    if (val === undefined || val === null) continue; // 已在步骤 1 报告
    const strVal = String(val);
    // 如果是数组，检查每个元素
    if (Array.isArray(val)) {
      val.forEach((el, i) => {
        if (!numericRe.test(String(el))) {
          errors.push(`字段 "${field}[${i}]" 不是合法的数值字符串: "${el}"`);
        }
      });
    } else if (!numericRe.test(strVal) && typeof val !== 'number' && typeof val !== 'bigint') {
      errors.push(`字段 "${field}" 不是合法的数值: "${val}"（需为整数或整数字符串）`);
    }
  }

  // 4. 64-bit 时间戳范围检查（claim_ts 须在合理 Unix 时间范围内）
  if (circuitName === 'anti_sybil_verifier' && input.claim_ts) {
    const ts = BigInt(String(input.claim_ts));
    const minTs = BigInt('1000000000');   // 2001-09-09
    const maxTs = BigInt('9999999999');   // 2286-11-20
    if (ts < minTs || ts > maxTs) {
      errors.push(
        `字段 "claim_ts" 值 ${ts} 超出合理 Unix 时间范围 [${minTs}, ${maxTs}]` +
        `（电路使用 64-bit 比较器，请确认时间戳单位为秒）`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 加载或生成示例输入
 */
function loadInput(circuitName, inputFile) {
  console.log('\n[输入] 加载输入数据...');

  if (inputFile && fs.existsSync(inputFile)) {
    console.log(`[OK] 从文件加载：${inputFile}`);
    return JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
  }

  console.log(`[提示] 未提供输入文件，使用示例占位输入（仅供开发调试）`);
  console.log(`[安全] 生产环境中，私有字段须由用户本地生成，绝不离端`);

  if (circuitName === 'identity_commitment') {
    return {
      // 私有输入（示例值，生产中须由用户提供）
      social_id_hash: "12345678901234567890123456789012345678901234567890123456789012",
      secret:         "98765432109876543210987654321098765432109876543210987654321098",
      trapdoor:       "11111111111111111111111111111111111111111111111111111111111111",
    };
  }

  if (circuitName === 'anti_sybil_verifier') {
    // [修复] 与重构后的 AntiSybilVerifier 电路信号完全对齐：
    //   - 移除 identity_commitment（现由电路内部计算，不再作为外部输入）
    //   - nullifier → nullifier_hash（与电路信号名一致）
    //   - pathElements/pathIndex 长度从 8 → 20（与 AntiSybilVerifier(20) 对齐）
    //   - 新增私有字段：trapdoor, social_id_hash
    //   - user_level 现为私有输入（已锚定在 Merkle 叶子中，不可从外部篡改）
    console.log(`[提示] 抗女巫验证电路需要完整的 Merkle 路径数据（深度=20）`);
    console.log(`       请提供 input.json 包含以下字段（下方为占位示例）：`);
    console.log(`       私有: secret, trapdoor, social_id_hash, user_level,`);
    console.log(`             airdrop_project_id, pathElements[20], pathIndex[20]`);
    console.log(`       公开: merkle_root, nullifier_hash, min_level,`);
    console.log(`             min_amount, max_amount, claim_amount,`);
    console.log(`             claim_ts, ts_start, ts_end`);

    return {
      // 私有见证人（占位，生产中须由 Semaphore SDK 在本地生成）
      secret:             "12345678",
      trapdoor:           "87654321",
      social_id_hash:     "99999999999999999999999999999999999999999999999999999999999999",
      user_level:         "3",
      airdrop_project_id: "1",
      pathElements: Array(20).fill("0"),
      pathIndex:    Array(20).fill("0"),

      // 公开输入（占位，生产中须来自链上或可信后端）
      merkle_root:    "0",
      nullifier_hash: "0",
      min_level:      "2",
      min_amount:     "100",
      max_amount:     "10000",
      claim_amount:   "1000",
      claim_ts:       "1712345678",
      ts_start:       "1712300000",
      ts_end:         "1799999999",
    };
  }

  if (circuitName === 'antiSybilClaim') {
    return {
      // 私有见证人
      identitySecret: "12345678",
      airdropId:      "1",
      // 公开输入
      expectedNullifierHash: "0",
      claimAmount:           "1000",
      maxClaimAmount:        "200000",
    };
  }

  throw new Error(`未知的电路名称：${circuitName}。已知电路: ${Object.keys(CIRCUIT_SCHEMAS).join(', ')}`);
}

function fileExists(p) { return fs.existsSync(p); }

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`[目录] 创建：${dirPath}`);
  }
}

/**
 * 定位 WASM 文件（标准构建目录结构）
 */
function findWasm(circuitName) {
  // 标准路径：build/<circuit>/<circuit>_js/<circuit>.wasm
  const canonicalPath = path.join(
    circuitsRoot, 'build', circuitName,
    `${circuitName}_js`, `${circuitName}.wasm`
  );
  if (fileExists(canonicalPath)) return canonicalPath;

  // 回退：build/<circuit>/<circuit>.wasm（旧版 circom 输出）
  const flatPath = path.join(circuitsRoot, 'build', circuitName, `${circuitName}.wasm`);
  if (fileExists(flatPath)) return flatPath;

  return null;
}

/**
 * 定位 zkey 文件
 */
function findZkey(circuitName) {
  const zkeyPath = path.join(
    circuitsRoot, 'build', circuitName, `${circuitName}_final.zkey`
  );
  return fileExists(zkeyPath) ? zkeyPath : null;
}

/**
 * 生成证明（核心步骤）
 *
 * 隐私保证：snarkjs.groth16.fullProve 在本地 WASM 沙箱中执行，
 * 私有输入仅进入 WASM 内存，不经过任何网络传输。
 */
async function generateProof(wasmPath, zkeyPath, input, circuitName) {
  // [修复] 在调用 fullProve 之前执行 Schema 校验
  // 将底层 C++/WASM 异常转化为精准的字段级错误信息
  console.log('\n[校验] 执行输入字段完整性校验...');
  const { valid, errors } = validateInput(circuitName, input);
  if (!valid) {
    console.error(`\n[输入错误] 发现 ${errors.length} 个校验失败项：`);
    errors.forEach((e, i) => console.error(`   ${i + 1}. ${e}`));
    console.error(`\n[提示] 请对照电路 Schema 修正 input.json 后重试`);
    console.error(`       电路公开信号说明：`);
    if (circuitName === 'anti_sybil_verifier') {
      console.error(`         merkle_root, nullifier_hash, min_level, min_amount,`);
      console.error(`         max_amount, claim_amount, claim_ts, ts_start, ts_end`);
      console.error(`       注意：identity_commitment 已从公开输入移除（电路内部计算）`);
      console.error(`             nullifier 字段已重命名为 nullifier_hash`);
      console.error(`             pathElements/pathIndex 数组长度须为 20`);
    }
    return { success: false, error: 'input_validation_failed' };
  }
  console.log(`[OK] 输入校验通过（${Object.keys(input).length} 个字段）`);

  console.log('\n[证明] 开始生成零知识证明（本地算力加密中）...');
  console.log('       您的私有身份数据正在转化为零知识证明，明文不会发送至服务器');
  console.log(`       WASM: ${wasmPath}`);
  console.log(`       ZKEY: ${zkeyPath}`);

  const startTime = Date.now();

  try {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      wasmPath,
      zkeyPath
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[OK] 证明生成成功！耗时：${duration}s`);

    return { success: true, proof, publicSignals, duration };
  } catch (error) {
    console.error(`\n[失败] 证明生成失败：${error.message}`);
    console.error(`\n[诊断] 可能的原因：`);
    console.error(`   1. 输入数据不满足电路约束（如：金额范围、等级门槛、时间窗口）`);
    console.error(`   2. Merkle 路径无效（pathElements/pathIndex 与 merkle_root 不匹配）`);
    console.error(`   3. Nullifier 计算错误（secret + airdrop_project_id 组合与 nullifier_hash 不符）`);
    console.error(`   4. social_id_hash 超出 BN128 安全范围（须 < 2^254）`);
    console.error(`   5. WASM 文件与当前电路代码不匹配（请重新编译：node scripts/compile-circuit.mjs）`);
    console.error(`   6. zkey 与 R1CS 来自不同版本（请重新运行可信设置：node scripts/zk-setup.mjs）`);
    return { success: false, error: error.message };
  }
}

/**
 * 保存证明与公开信号到文件
 */
function saveProof(proof, publicSignals, outputDir, circuitName) {
  ensureDir(outputDir);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const proofPath  = path.join(outputDir, `proof_${circuitName}_${ts}.json`);
  const publicPath = path.join(outputDir, `public_${circuitName}_${ts}.json`);

  fs.writeFileSync(proofPath,  JSON.stringify(proof, null, 2));
  fs.writeFileSync(publicPath, JSON.stringify(publicSignals, null, 2));
  console.log(`[保存] 证明文件：${proofPath}`);
  console.log(`[保存] 公开信号：${publicPath}`);

  return { proofPath, publicPath };
}

/**
 * 本地验证证明（可选步骤，使用 vkey.json）
 */
async function verifyProof(proof, publicSignals, circuitName) {
  console.log('\n[验证] 执行本地证明验证...');
  const vkeyPath = path.join(circuitsRoot, 'build', circuitName, 'vkey.json');

  if (!fileExists(vkeyPath)) {
    console.warn(`[跳过] 验证密钥不存在：${vkeyPath}`);
    console.warn(`       请先运行 node scripts/zk-setup.mjs 生成 vkey.json`);
    return { success: false, reason: 'vkey_not_found' };
  }

  const vkey = JSON.parse(fs.readFileSync(vkeyPath, 'utf-8'));
  try {
    const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    if (isValid) {
      console.log(`[OK] 本地验证通过`);
      return { success: true, isValid };
    }
    console.error(`[失败] 证明验证未通过（vkey 与 zkey 版本可能不一致）`);
    return { success: false, reason: 'invalid_proof' };
  } catch (error) {
    console.error(`[错误] 验证过程异常：${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log(' 零知识证明生成（Prove）');
  console.log('='.repeat(60));
  console.log(`\n[配置] 电路名称：${CONFIG.circuitName}`);
  console.log(`[配置] 输入文件：${CONFIG.inputFile || '（使用示例占位输入）'}`);
  console.log(`[配置] 输出目录：${CONFIG.outputDir}`);
  console.log(`[配置] Node.js： v${process.versions.node}`);

  const schema = CIRCUIT_SCHEMAS[CONFIG.circuitName];
  if (schema) {
    console.log(`[电路] ${schema.description}`);
  }

  // 步骤 1：加载输入
  let input;
  try {
    input = loadInput(CONFIG.circuitName, CONFIG.inputFile);
  } catch (error) {
    console.error(`[错误] 加载输入失败：${error.message}`);
    process.exit(1);
  }

  // 步骤 2：定位 WASM（标准路径为 build/<circuit>/<circuit>_js/<circuit>.wasm）
  const wasmPath = findWasm(CONFIG.circuitName);
  if (!wasmPath) {
    console.error(`\n[错误] WASM 文件不存在！`);
    console.error(`       期望路径：build/${CONFIG.circuitName}/${CONFIG.circuitName}_js/${CONFIG.circuitName}.wasm`);
    console.error(`\n[解决] 请先编译电路：`);
    console.error(`       node scripts/compile-circuit.mjs ${CONFIG.circuitName}`);
    process.exit(1);
  }
  console.log(`\n[OK] WASM: ${wasmPath}`);

  // 步骤 3：定位 zkey
  const zkeyPath = findZkey(CONFIG.circuitName);
  if (!zkeyPath) {
    console.error(`\n[错误] zkey 文件不存在！`);
    console.error(`       期望路径：build/${CONFIG.circuitName}/${CONFIG.circuitName}_final.zkey`);
    console.error(`\n[解决] 请先运行可信设置：`);
    console.error(`       node scripts/zk-setup.mjs ${CONFIG.circuitName}`);
    process.exit(1);
  }
  console.log(`[OK] ZKEY: ${zkeyPath}`);

  // 步骤 4：生成证明（含输入校验）
  const proofResult = await generateProof(wasmPath, zkeyPath, input, CONFIG.circuitName);
  if (!proofResult.success) {
    console.error(`\n[终止] 证明生成失败`);
    process.exit(1);
  }

  // 步骤 5：保存证明
  const { proofPath, publicPath } = saveProof(
    proofResult.proof,
    proofResult.publicSignals,
    CONFIG.outputDir,
    CONFIG.circuitName
  );

  // 步骤 6：本地验证（可选）
  const verifyResult = await verifyProof(
    proofResult.proof,
    proofResult.publicSignals,
    CONFIG.circuitName
  );

  // 完成
  console.log('\n' + '='.repeat(60));
  console.log(' 证明生成完成！');
  console.log('='.repeat(60));
  console.log('\n[产物]');
  console.log(`   证明文件: ${proofPath}`);
  console.log(`   公开信号: ${publicPath}`);
  console.log('\n[摘要]');
  console.log(`   生成耗时:     ${proofResult.duration}s`);
  console.log(`   公开信号数:   ${proofResult.publicSignals.length}`);
  console.log(`   本地验证:     ${verifyResult.success ? '通过' : '未验证（vkey 缺失或版本不符）'}`);
  console.log('\n[安全提示]');
  console.log('   - 证明（proof）和公开信号（publicSignals）可安全发送到链上');
  console.log('   - 私有输入已仅在本地 WASM 内存中处理，未经任何网络传输');
  console.log('   - AI 助手不会询问您的私钥或助记词');
}

main().catch(error => {
  console.error('\n[严重错误]', error);
  console.error(error.stack);
  process.exit(1);
});
