/**
 * 合约 ABI 导出脚本（增强版）
 * 
 * 用途：
 * - 从编译产物中提取合约 ABI
 * - 自动导出至后端存储目录（backend/src/abis/）
 * - 支持批量导出和单个合约导出
 * - 自动生成 index.js 统一导出文件
 * - 自动检测所有合约（无需手动维护列表）
 * 
 * 使用方法：
 * ```bash
 * # 编译并导出所有合约 ABI
 * npm run compile && npm run export-abis
 * 
 * # 导出指定合约 ABI
 * npm run export-abi -- ClaimVault
 * 
 * # 仅生成 index.js（不重新导出 ABI）
 * npm run export-abis -- --index-only
 * ```
 * 
 * 安全规范：
 * - 仅导出 ABI（接口定义），不包含敏感信息
 * - 导出的 ABI 文件可安全提交至版本控制
 * - 自动过滤测试合约和辅助合约
 */

const fs = require('fs');
const path = require('path');

// 合约编译产物目录
const ARTIFACTS_DIR = path.join(__dirname, '..', 'artifacts');

// 后端 ABI 存储目录（可配置）
const BACKEND_ABI_DIR = process.env.BACKEND_ABI_DIR ||
  path.join(__dirname, '..', '..', 'backend', 'src', 'abis');

/**
 * 需要排除的合约模式（正则表达式）
 * 
 * 说明：
 * - 测试合约：*test*、*Test*、Mock*
 * - 接口定义：I*（如 IGroth16Verifier）
 * - 库合约：*Lib（如 ECRecoverLib）
 */
const EXCLUDE_PATTERNS = [
  /.*test.*/i,           // 测试合约
  /.*Test.*/i,           // 测试合约（大写 T）
  /^Mock.*/i,            // Mock 合约
  /^I[A-Z].*/i,          // 接口定义（如 IGroth16Verifier）
  /.*Lib$/i,             // 库合约（如 ECRecoverLib）
];

/**
 * 手动指定需要导出的合约（可选）
 * 如果为空数组，则自动检测所有合约
 * 如果不为空，则只导出指定的合约（并应用排除规则）
 */
const FORCE_EXPORT_CONTRACTS = [
  // 如果需要手动指定，在这里添加合约名称
  // 例如：['ClaimVault', 'ClaimVaultZK', 'IdentityRegistry']
];

/**
 * 确保目录存在
 */
function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`[目录创建] ${dirPath}`);
  }
}

/**
 * 检查合约名称是否应该被排除
 * 
 * @param {string} contractName - 合约名称
 * @returns {boolean} true 表示应该排除
 */
function shouldExcludeContract(contractName) {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(contractName));
}

/**
 * 自动检测所有需要导出的合约
 * 
 * @returns {string[]} 合约名称数组
 */
function detectAllContracts() {
  const contracts = [];
  
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    console.error('[错误] 编译产物目录不存在，请先运行：npm run compile');
    return contracts;
  }
  
  // 只扫描 contracts 目录（排除 @openzeppelin 和 build-info）
  const contractsArtifactsDir = path.join(ARTIFACTS_DIR, 'contracts');
  
  if (!fs.existsSync(contractsArtifactsDir)) {
    console.error('[错误] 合约编译产物目录不存在，请先运行：npm run compile');
    return contracts;
  }
  
  // 遍历 contracts 目录
  const rootEntries = fs.readdirSync(contractsArtifactsDir);
  
  for (const entry of rootEntries) {
    const entryPath = path.join(contractsArtifactsDir, entry);
    
    // 跳过文件（只处理目录）
    if (!fs.statSync(entryPath).isDirectory()) {
      continue;
    }
    
    // 跳过排除的目录（如 test、libraries 等）
    if (shouldExcludeContract(entry)) {
      continue;
    }
    
    // 遍历子目录（如 anonymous/、channels/ 等）
    const subDirs = fs.readdirSync(entryPath);
    
    for (const subDir of subDirs) {
      const subDirPath = path.join(entryPath, subDir);
      
      if (!fs.statSync(subDirPath).isDirectory()) {
        continue;
      }
      
      // 查找该目录下的 JSON 文件（合约编译产物）
      const files = fs.readdirSync(subDirPath);
      
      for (const file of files) {
        // 跳过 .dbg.json 文件（调试信息）
        if (!file.endsWith('.json') || file.endsWith('.dbg.json')) {
          continue;
        }
        
        const contractName = path.basename(file, '.json');
        
        // 再次检查是否应该排除
        if (!shouldExcludeContract(contractName)) {
          // 避免重复添加
          if (!contracts.includes(contractName)) {
            contracts.push(contractName);
          }
        }
      }
    }
  }
  
  return contracts.sort();
}

/**
 * 获取需要导出的合约列表
 * 
 * @returns {string[]} 合约名称数组
 */
function getContractsToExport() {
  // 如果手动指定了合约，使用手动列表
  if (FORCE_EXPORT_CONTRACTS.length > 0) {
    return FORCE_EXPORT_CONTRACTS.filter(name => !shouldExcludeContract(name));
  }
  
  // 否则自动检测所有合约
  return detectAllContracts();
}

/**
 * 读取合约编译产物
 * 
 * @param {string} contractName - 合约名称
 * @returns {Object|null} 编译产物对象
 */
function readArtifact(contractName) {
  // 在 contracts 目录下查找合约
  const contractsArtifactsDir = path.join(ARTIFACTS_DIR, 'contracts');
  
  if (!fs.existsSync(contractsArtifactsDir)) {
    return null;
  }
  
  // 遍历所有子目录查找合约
  const categories = fs.readdirSync(contractsArtifactsDir);
  
  for (const category of categories) {
    const categoryPath = path.join(contractsArtifactsDir, category);
    
    if (!fs.statSync(categoryPath).isDirectory()) {
      continue;
    }
    
    const subDirs = fs.readdirSync(categoryPath);
    
    for (const subDir of subDirs) {
      const subDirPath = path.join(categoryPath, subDir);
      
      if (!fs.statSync(subDirPath).isDirectory()) {
        continue;
      }
      
      const artifactPath = path.join(subDirPath, `${contractName}.json`);
      
      if (fs.existsSync(artifactPath)) {
        const content = fs.readFileSync(artifactPath, 'utf-8');
        return JSON.parse(content);
      }
    }
  }
  
  return null;
}

/**
 * 提取并保存 ABI
 * 
 * @param {string} contractName - 合约名称
 * @param {Object} artifact - 编译产物
 * @returns {string} 保存的文件路径
 */
function saveABI(contractName, artifact) {
  const abi = artifact.abi;
  
  if (!abi || !Array.isArray(abi)) {
    console.error(`[错误] 合约 ${contractName} 没有有效的 ABI`);
    return null;
  }
  
  // 使用 .abi.json 后缀，便于识别
  const fileName = `${contractName}.abi.json`;
  const filePath = path.join(BACKEND_ABI_DIR, fileName);
  
  // 格式化输出（便于阅读和调试）
  const formattedABI = JSON.stringify(abi, null, 2);
  fs.writeFileSync(filePath, formattedABI, 'utf-8');
  
  console.log(`[ABI 导出] ✓ ${contractName} -> ${fileName}`);
  
  return filePath;
}

/**
 * 导出单个合约 ABI
 * 
 * @param {string} contractName - 合约名称
 */
function exportABI(contractName) {
  console.log(`\n[导出] ${contractName}...`);
  
  const artifact = readArtifact(contractName);
  
  if (!artifact) {
    console.error(`[跳过] ${contractName} 不存在`);
    return false;
  }
  
  const savedPath = saveABI(contractName, artifact);
  
  return !!savedPath;
}

/**
 * 导出所有合约 ABI
 */
function exportAllABIs() {
  console.log('[开始] 导出所有合约 ABI...\n');
  
  // 确保后端目录存在
  ensureDirExists(BACKEND_ABI_DIR);
  
  const contractsToExport = getContractsToExport();
  
  console.log(`[检测] 共找到 ${contractsToExport.length} 个合约：`);
  console.log(`       ${contractsToExport.join(', ')}\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const contractName of contractsToExport) {
    const success = exportABI(contractName);
    
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  console.log('\n[完成] 导出统计:');
  console.log(`  成功：${successCount} 个合约`);
  console.log(`  失败：${failCount} 个合约`);
  console.log(`  总计：${contractsToExport.length} 个合约`);
  console.log(`\nABI 存储目录：${BACKEND_ABI_DIR}`);
  
  // 生成 index.js
  generateIndexFile(contractsToExport);
}

/**
 * 主函数
 */
function main() {
  const args = process.argv.slice(2);
  
  // 检查是否只需要生成 index.js
  const indexOnly = args.includes('--index-only');
  
  if (indexOnly) {
    console.log('[开始] 仅生成 index.js...\n');
    ensureDirExists(BACKEND_ABI_DIR);
    generateIndexFile(getContractsToExport());
    return;
  }
  
  if (args.length === 0) {
    // 无参数：导出所有合约
    exportAllABIs();
  } else {
    // 有参数：导出指定合约
    const contractName = args[0];
    exportABI(contractName);
  }
}

// 执行
main();

/**
 * 生成 index.js 统一导出文件
 * 
 * @param {string[]} contractNames - 合约名称数组
 */
function generateIndexFile(contractNames) {
  console.log('[生成] index.js 统一导出文件...\n');
  
  const lines = [
    '/**',
    ' * abis/index.js',
    ' * 合约 ABI 统一导出文件',
    ' * ',
    ' * ⚠️  此文件由脚本自动生成，请勿手动修改！',
    ' * ',
    ' * 生成命令：npm run export-abis',
    ' * ',
    ' * 用途：',
    ' *   - 集中管理所有合约 ABI',
    ' *   - 便于 services 层导入使用',
    ' *   - 支持前端共享 ABI 文件',
    ' * ',
    ' * 安全说明：',
    ' *   - ABI 文件为纯数据，不包含任何逻辑',
    ' *   - 所有 ABI 均从合约文件手动提取，确保与链上合约一致',
    ' */',
    '',
  ];
  
  // 生成 import 语句
  for (const contractName of contractNames) {
    lines.push(`import ${contractName}ABI from './${contractName}.abi.json' assert { type: 'json' };`);
  }
  
  lines.push('');
  lines.push('/**');
  lines.push(' * 所有合约 ABI 导出对象');
  lines.push(' * ');
  lines.push(' * 使用示例：');
  lines.push(' *   import { ABIS } from \'@/abis/index.js\';');
  lines.push(' *   const contract = new ethers.Contract(address, ABIS.IdentityRegistry, signer);');
  lines.push(' */');
  lines.push('export const ABIS = {');
  
  // 生成 ABIS 对象
  for (const contractName of contractNames) {
    const comment = getContractComment(contractName);
    if (comment) {
      lines.push(`  /**`);
      lines.push(`   * ${contractName} 合约 ABI`);
      lines.push(`   * ${comment}`);
      lines.push(`   */`);
    }
    lines.push(`  ${contractName}: ${contractName}ABI,`);
  }
  
  lines.push('};');
  lines.push('');
  
  // 生成单独导出
  lines.push('/**');
  lines.push(' * 单独导出每个 ABI（便于按需导入）');
  lines.push(' */');
  for (const contractName of contractNames) {
    lines.push(`export { ${contractName}ABI };`);
  }
  lines.push('');
  
  // 生成工具函数
  lines.push('/**');
  lines.push(' * 获取合约 ABI 的工具函数');
  lines.push(' * ');
  lines.push(' * @param {string} contractName 合约名称（如 \'IdentityRegistry\'）');
  lines.push(' * @returns {Array} 合约 ABI 数组');
  lines.push(' * @throws {Error} 合约名称不存在时抛出错误');
  lines.push(' * ');
  lines.push(' * 使用示例：');
  lines.push(' *   const abi = getABI(\'IdentityRegistry\');');
  lines.push(' *   const contract = new ethers.Contract(address, abi, signer);');
  lines.push(' */');
  lines.push('export function getABI(contractName) {');
  lines.push('  const abi = ABIS[contractName];');
  lines.push('  if (!abi) {');
  lines.push('    throw new Error(`Unknown contract ABI: ${contractName}`);');
  lines.push('  }');
  lines.push('  return abi;');
  lines.push('}');
  lines.push('');
  
  const filePath = path.join(BACKEND_ABI_DIR, 'index.js');
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  
  console.log(`[✓] index.js 已生成：${filePath}`);
  console.log(`    包含 ${contractNames.length} 个合约 ABI\n`);
}

/**
 * 获取合约的中文注释（用于 index.js）
 * 
 * @param {string} contractName - 合约名称
 * @returns {string} 注释描述
 */
function getContractComment(contractName) {
  const comments = {
    'IdentityRegistry': '身份承诺注册表：不存储任何 Web2 明文，仅链上承诺与等级、黑名单',
    'SBT': 'ERC-5192 灵魂绑定代币：不可转让的链上信用凭证',
    'AnonymousClaim': '匿名资金申领合约：ZK 证明验证 + Nullifier 防重放',
    'ClaimVaultZK': 'ZK 空投申领入口：合约层二次校验金额 + Nullifier 防重放',
    'ClaimVault': '传统空投申领合约（无 ZK）',
    'PaymentChannel': '支付通道合约：高频小额支付的链下签名 + 链上结算',
    'Governance': 'DAO 治理合约：加权投票 + 时间锁执行',
    'OracleManager': '预言机管理器：快速审批与风险评估',
    'ChallengeManager': '挑战管理器：身份挑战与仲裁',
    'ArbitratorPool': '仲裁池：社区仲裁与投票',
    'MultiSigWallet': '多重签名钱包：多签授权与提案',
  };
  
  return comments[contractName] || '合约 ABI';
}
