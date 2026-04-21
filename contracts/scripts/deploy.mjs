#!/usr/bin/env node

/**
 * deploy.mjs - 多网络部署脚本
 * 
 * 功能：
 * - 支持部署到多个预配置的网络
 * - 自动保存部署地址到 JSON 文件
 * - 自动导出 ABI 到后端目录
 * - 支持环境变量配置
 */

import pkg from 'hardhat';
const hre = pkg;
const { ethers } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractsRoot = path.join(__dirname, '..');
const deploymentsDir = path.join(contractsRoot, 'deployments');
const backendABIDir = process.env.BACKEND_ABI_DIR || 
  path.join(contractsRoot, '..', 'backend', 'src', 'abis');

/**
 * 确保目录存在
 */
function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`[部署] 目录已创建：${dirPath}`);
  }
}

/**
 * 保存部署地址到 JSON 文件
 */
function saveDeployment(networkName, deployments) {
  ensureDirExists(deploymentsDir);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${networkName}-${timestamp}.json`;
  const filePath = path.join(deploymentsDir, fileName);
  
  const deploymentData = {
    network: networkName,
    timestamp: timestamp,
    deployer: deployments.deployer,
    contracts: deployments.contracts,
  };
  
  fs.writeFileSync(filePath, JSON.stringify(deploymentData, null, 2), 'utf-8');
  console.log(`\n[部署] 部署信息已保存：${filePath}`);
  
  // 同时保存为 latest-<network>.json 方便引用
  const latestPath = path.join(deploymentsDir, `latest-${networkName}.json`);
  fs.writeFileSync(latestPath, JSON.stringify(deploymentData, null, 2), 'utf-8');
  console.log(`[部署] 最新部署已更新：${latestPath}`);
  
  return filePath;
}

/**
 * 导出 ABI 到后端目录
 */
function exportABI(contractName, artifact) {
  const abi = artifact.abi;
  
  if (!abi || !Array.isArray(abi)) {
    console.warn(`[ABI] 合约 ${contractName} 没有有效的 ABI`);
    return null;
  }
  
  ensureDirExists(backendABIDir);
  
  const fileName = `${contractName}.json`;
  const filePath = path.join(backendABIDir, fileName);
  
  const formattedABI = JSON.stringify(abi, null, 2);
  fs.writeFileSync(filePath, formattedABI, 'utf-8');
  
  console.log(`[ABI] ✓ ${contractName} -> ${fileName}`);
  return filePath;
}

/**
 * 主部署函数
 */
async function main() {
  const networkName = hre.network.name;
  
  // 获取签名者
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error(
      `没有可用的签名者账户！\n` +
      `请确保：\n` +
      `1. 对于本地网络：已启动 npx hardhat node\n` +
      `2. 对于 geth/测试网：已在 .env 中配置 DEPLOYER_PRIVATE_KEY\n` +
      `3. 对于生产网络：私钥格式正确（不带 0x 前缀）`
    );
  }
  
  const deployer = signers[0];
  
  console.log('\n' + '='.repeat(70));
  console.log('  TrustAID 平台合约部署');
  console.log('='.repeat(70));
  console.log(`\n[网络] ${networkName}`);
  console.log(`[部署者] ${deployer.address}`);
  console.log(`[余额] ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH`);

  const netInfo = await deployer.provider.getNetwork();
  const chainId = Number(netInfo.chainId);
  console.log(`[链 ID] ${chainId}`);
  const MOCK_MAINNET_IDS = new Set([
    1, 137, 8453, 42161, 10, 43114, 534352, 59144,
  ]);
  console.log('\n' + '='.repeat(70) + '\n');
  
  const deployedContracts = {};

  /** 部署 ClaimVault / AnonymousClaim / IdentityCommitmentZK / AntiSybilClaimZK 所用的导出验证器 */
  const REQUIRED_ZK_VERIFIER_ARTIFACTS = [
    'contracts/verifiers/anti_sybil_verifier_verifier.sol:Groth16Verifier',
    'contracts/verifiers/anonymous_claim_verifier.sol:Groth16Verifier',
    'contracts/verifiers/identity_commitment_verifier.sol:Groth16Verifier',
    'contracts/verifiers/anti_sybil_claim_verifier.sol:Groth16Verifier',
  ];

  async function findMissingZkVerifierArtifact() {
    for (const id of REQUIRED_ZK_VERIFIER_ARTIFACTS) {
      try {
        await hre.artifacts.readArtifact(id);
      } catch {
        return id;
      }
    }
    return null;
  }

  /**
   * 默认使用 snarkjs 导出的真实 Groth16Verifier。
   * 仅当 USE_MOCK_ZK_VERIFIERS=1 时使用 Mock（主网/L2 仍禁止 Mock，除非 FORCE_MOCK_VERIFIER=1）。
   */
  const forceMockZk = process.env.USE_MOCK_ZK_VERIFIERS === '1';
  let useRealZk;
  if (forceMockZk) {
    if (MOCK_MAINNET_IDS.has(chainId) && process.env.FORCE_MOCK_VERIFIER !== '1') {
      throw new Error(
        `[部署] chainId=${chainId} 禁止使用 Mock 验证器。请使用 circuits 构建并 zk:export 真实 Verifier；若应急必须 Mock，请设置 FORCE_MOCK_VERIFIER=1`
      );
    }
    useRealZk = false;
    console.log('[ZK] 模式：Mock（USE_MOCK_ZK_VERIFIERS=1）\n');
  } else {
    const missing = await findMissingZkVerifierArtifact();
    if (missing) {
      throw new Error(
        `[部署] 默认使用真实 Groth16 验证器，但未找到 Hardhat 产物：${missing}\n` +
          `请先导出 Solidity Verifier 并编译：\n` +
          `  cd circuits && npm run zk:export:all\n` +
          `  cd ../contracts && yarn compile\n` +
          `若本地无电路产物、仅需占位调试，可设置 USE_MOCK_ZK_VERIFIERS=1 后再部署。`
      );
    }
    useRealZk = true;
    console.log('[ZK] 模式：真实 Groth16Verifier（snarkjs 导出）\n');
  }

  // ========== 1. 部署申领用 ZK 验证器（ClaimVaultZK 与 AnonymousClaim 分离） ==========
  let vaultVerifierAddress;
  let anonymousVerifierAddress;

  if (useRealZk) {
    console.log('[1a] 部署 anti_sybil Groth16Verifier（真实导出）...');
    const sybilArt = await hre.artifacts.readArtifact(
      'contracts/verifiers/anti_sybil_verifier_verifier.sol:Groth16Verifier'
    );
    const SybilVF = await ethers.getContractFactory(sybilArt.abi, sybilArt.bytecode);
    const sybilV = await SybilVF.deploy();
    await sybilV.waitForDeployment();
    vaultVerifierAddress = await sybilV.getAddress();
    deployedContracts['AntiSybilGroth16Verifier'] = vaultVerifierAddress;
    console.log(`✓ AntiSybilGroth16Verifier: ${vaultVerifierAddress}`);

    console.log('[1b] 部署 anonymous_claim Groth16Verifier（真实导出）...');
    const anonArt = await hre.artifacts.readArtifact(
      'contracts/verifiers/anonymous_claim_verifier.sol:Groth16Verifier'
    );
    const AnonVF = await ethers.getContractFactory(anonArt.abi, anonArt.bytecode);
    const anonV = await AnonVF.deploy();
    await anonV.waitForDeployment();
    anonymousVerifierAddress = await anonV.getAddress();
    deployedContracts['AnonymousClaimGroth16Verifier'] = anonymousVerifierAddress;
    console.log(`✓ AnonymousClaimGroth16Verifier: ${anonymousVerifierAddress}\n`);
  } else {
    console.log('[1a] 部署 MockAntiSybilVerifier（ClaimVaultZK / 8 public）...');
    const MockSybil = await ethers.getContractFactory('MockAntiSybilVerifier');
    const mSybil = await MockSybil.deploy(true);
    await mSybil.waitForDeployment();
    vaultVerifierAddress = await mSybil.getAddress();
    deployedContracts['MockAntiSybilVerifier'] = vaultVerifierAddress;
    console.log(`✓ MockAntiSybilVerifier: ${vaultVerifierAddress}`);

    console.log('[1b] 部署 MockGroth16Verifier（AnonymousClaim / uint256[]）...');
    const MockVerifier = await ethers.getContractFactory('MockGroth16Verifier');
    const mAnon = await MockVerifier.deploy(true);
    await mAnon.waitForDeployment();
    anonymousVerifierAddress = await mAnon.getAddress();
    deployedContracts['MockGroth16Verifier'] = anonymousVerifierAddress;
    console.log(`✓ MockGroth16Verifier: ${anonymousVerifierAddress}\n`);
  }
  
  // ========== 2. 部署身份注册表 ==========
  console.log('[2/11] 部署 IdentityRegistry...');
  const IdentityRegistry = await ethers.getContractFactory('IdentityRegistry');
  const registry = await IdentityRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  deployedContracts['IdentityRegistry'] = registryAddress;
  console.log(`✓ IdentityRegistry: ${registryAddress}\n`);

  // ========== 2b. identity_commitment 验证器 + IdentityCommitmentZK 状态机 ==========
  let identityCommitmentVerifierAddr;
  if (useRealZk) {
    console.log('[2b] 部署 identity_commitment Groth16Verifier（真实导出）...');
    const idCommArt = await hre.artifacts.readArtifact(
      'contracts/verifiers/identity_commitment_verifier.sol:Groth16Verifier'
    );
    const IdVF = await ethers.getContractFactory(idCommArt.abi, idCommArt.bytecode);
    const idV = await IdVF.deploy();
    await idV.waitForDeployment();
    identityCommitmentVerifierAddr = await idV.getAddress();
    deployedContracts['IdentityCommitmentGroth16Verifier'] = identityCommitmentVerifierAddr;
    console.log(`✓ IdentityCommitmentGroth16Verifier: ${identityCommitmentVerifierAddr}`);
  } else {
    console.log('[2b] 部署 MockIdentityCommitmentGroth16Verifier（2 public）...');
    const MockId = await ethers.getContractFactory('MockIdentityCommitmentGroth16Verifier');
    const mId = await MockId.deploy(true);
    await mId.waitForDeployment();
    identityCommitmentVerifierAddr = await mId.getAddress();
    deployedContracts['MockIdentityCommitmentGroth16Verifier'] = identityCommitmentVerifierAddr;
    console.log(`✓ MockIdentityCommitmentGroth16Verifier: ${identityCommitmentVerifierAddr}`);
  }
  const IdentityCommitmentZK = await ethers.getContractFactory('IdentityCommitmentZK');
  const identityCommitmentZk = await IdentityCommitmentZK.deploy(identityCommitmentVerifierAddr);
  await identityCommitmentZk.waitForDeployment();
  const identityCommitmentZkAddr = await identityCommitmentZk.getAddress();
  deployedContracts['IdentityCommitmentZK'] = identityCommitmentZkAddr;
  console.log(`✓ IdentityCommitmentZK: ${identityCommitmentZkAddr}\n`);

  // ========== 2c. anti_sybil_claim 验证器 + AntiSybilClaimZK 状态机 ==========
  let antiSybilClaimVerifierAddr;
  if (useRealZk) {
    console.log('[2c] 部署 anti_sybil_claim Groth16Verifier（真实导出）...');
    const claimArt = await hre.artifacts.readArtifact(
      'contracts/verifiers/anti_sybil_claim_verifier.sol:Groth16Verifier'
    );
    const ClaimVF = await ethers.getContractFactory(claimArt.abi, claimArt.bytecode);
    const claimV = await ClaimVF.deploy();
    await claimV.waitForDeployment();
    antiSybilClaimVerifierAddr = await claimV.getAddress();
    deployedContracts['AntiSybilClaimGroth16Verifier'] = antiSybilClaimVerifierAddr;
    console.log(`✓ AntiSybilClaimGroth16Verifier: ${antiSybilClaimVerifierAddr}`);
  } else {
    console.log('[2c] 部署 MockAntiSybilClaimGroth16Verifier（3 public）...');
    const MockClaim = await ethers.getContractFactory('MockAntiSybilClaimGroth16Verifier');
    const mClaim = await MockClaim.deploy(true);
    await mClaim.waitForDeployment();
    antiSybilClaimVerifierAddr = await mClaim.getAddress();
    deployedContracts['MockAntiSybilClaimGroth16Verifier'] = antiSybilClaimVerifierAddr;
    console.log(`✓ MockAntiSybilClaimGroth16Verifier: ${antiSybilClaimVerifierAddr}`);
  }
  const AntiSybilClaimZK = await ethers.getContractFactory('AntiSybilClaimZK');
  const antiSybilClaimZk = await AntiSybilClaimZK.deploy(antiSybilClaimVerifierAddr);
  await antiSybilClaimZk.waitForDeployment();
  const antiSybilClaimZkAddr = await antiSybilClaimZk.getAddress();
  deployedContracts['AntiSybilClaimZK'] = antiSybilClaimZkAddr;
  console.log(`✓ AntiSybilClaimZK: ${antiSybilClaimZkAddr}\n`);
  
  // ========== 3. 部署 ClaimVaultZK ==========
  console.log('[3/11] 部署 ClaimVaultZK...');
  const minAmount = process.env.MIN_CLAIM || '1000';
  const maxAmount = process.env.MAX_CLAIM || '200000';
  const expectedMerkleRoot = process.env.CLAIM_VAULT_MERKLE_ROOT
    ? ethers.toBigInt(process.env.CLAIM_VAULT_MERKLE_ROOT)
    : 0n;
  const expectedParameterHash = process.env.CLAIM_VAULT_PARAMETER_HASH
    ? ethers.toBigInt(process.env.CLAIM_VAULT_PARAMETER_HASH)
    : 0n;
  const airdropProjectId = process.env.CLAIM_VAULT_PROJECT_ID
    ? ethers.toBigInt(process.env.CLAIM_VAULT_PROJECT_ID)
    : 1n;

  const ClaimVaultZK = await ethers.getContractFactory('ClaimVaultZK');
  const vault = await ClaimVaultZK.deploy(
    vaultVerifierAddress,
    registryAddress,
    minAmount,
    maxAmount,
    expectedMerkleRoot,
    expectedParameterHash,
    airdropProjectId
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  deployedContracts['ClaimVaultZK'] = vaultAddress;
  console.log(`✓ ClaimVaultZK: ${vaultAddress}`);
  console.log(`  最小申领：${minAmount}`);
  console.log(`  最大申领：${maxAmount}\n`);
  
  // ========== 4. 部署 SBT（ERC-5192 灵魂绑定代币） ==========
  console.log('[4/11] 部署 SBT...');
  const SBT = await ethers.getContractFactory('SBT');
  const sbt = await SBT.deploy(registryAddress);
  await sbt.waitForDeployment();
  const sbtAddress = await sbt.getAddress();
  deployedContracts['SBT'] = sbtAddress;
  console.log(`✓ SBT: ${sbtAddress}\n`);
  
  // ========== 5. 部署仲裁池 ==========
  console.log('[5/11] 部署 ArbitratorPool...');
  const ArbitratorPool = await ethers.getContractFactory('ArbitratorPool');
  const pool = await ArbitratorPool.deploy();
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();
  deployedContracts['ArbitratorPool'] = poolAddress;
  console.log(`✓ ArbitratorPool: ${poolAddress}\n`);

  // ========== 6. 部署 PlatformRoleRegistry（链上应用角色；后端 ROLES_SOURCE=chain 时使用）==========
  console.log('[6/11] 部署 PlatformRoleRegistry...');
  const PlatformRoleRegistry = await ethers.getContractFactory('PlatformRoleRegistry');
  const platformRoleRegistry = await PlatformRoleRegistry.deploy(deployer.address);
  await platformRoleRegistry.waitForDeployment();
  const platformRoleRegistryAddress = await platformRoleRegistry.getAddress();
  deployedContracts['PlatformRoleRegistry'] = platformRoleRegistryAddress;
  console.log(`✓ PlatformRoleRegistry: ${platformRoleRegistryAddress}`);
  console.log(`  DEFAULT_ADMIN_ROLE: ${deployer.address}\n`);
  
  // ========== 7. 部署挑战管理器 ==========
  console.log('[7/11] 部署 ChallengeManager...');
  const ChallengeManager = await ethers.getContractFactory('ChallengeManager');
  const challenges = await ChallengeManager.deploy(
    poolAddress,
    sbtAddress,
    registryAddress
  );
  await challenges.waitForDeployment();
  const challengesAddress = await challenges.getAddress();
  deployedContracts['ChallengeManager'] = challengesAddress;
  console.log(`✓ ChallengeManager: ${challengesAddress}\n`);
  
  // ========== 8. 部署预言机管理器 ==========
  console.log('[8/11] 部署 OracleManager...');
  const OracleManager = await ethers.getContractFactory('OracleManager');
  const oracle = await OracleManager.deploy();
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  deployedContracts['OracleManager'] = oracleAddress;
  console.log(`✓ OracleManager: ${oracleAddress}\n`);
  
  // ========== 9. 部署治理合约 ==========
  console.log('[9/11] 部署 Governance...');
  const Governance = await ethers.getContractFactory('Governance');
  const governance = await Governance.deploy(sbtAddress);
  await governance.waitForDeployment();
  const governanceAddress = await governance.getAddress();
  deployedContracts['Governance'] = governanceAddress;
  console.log(`✓ Governance: ${governanceAddress}\n`);
  
  // ========== 10. 部署支付通道 ==========
  console.log('[10/11] 部署 PaymentChannel...');
  const PaymentChannel = await ethers.getContractFactory('PaymentChannel');
  const participant1 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';  // 发起人（测试地址）
  const participant2 = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';  // 受助者（测试地址）
  const totalDeposit = ethers.parseEther('1.0');  // 锁定 1 ETH
  
  const paymentChannel = await PaymentChannel.deploy(
    participant1,
    participant2,
    totalDeposit
  );
  await paymentChannel.waitForDeployment();
  const paymentChannelAddress = await paymentChannel.getAddress();
  deployedContracts['PaymentChannel'] = paymentChannelAddress;
  console.log(`✓ PaymentChannel: ${paymentChannelAddress}`);
  console.log(`  发起人：${participant1}`);
  console.log(`  受助者：${participant2}`);
  console.log(`  锁定资金：${ethers.formatEther(totalDeposit)} ETH\n`);
  
  // ========== 11. 部署匿名申领合约 ==========
  console.log('[11/11] 部署 AnonymousClaim...');
  const merkleRoot = ethers.toBigInt(ethers.keccak256(ethers.toUtf8Bytes('example_merkle_root')));
  const tsStart = Math.floor(Date.now() / 1000);  // 当前时间戳
  const tsEnd = tsStart + 86400 * 30;  // 30 天后
  
  const AnonymousClaim = await ethers.getContractFactory('AnonymousClaim');
  const anonymousClaim = await AnonymousClaim.deploy(
    anonymousVerifierAddress,
    merkleRoot,
    tsStart,
    tsEnd
  );
  await anonymousClaim.waitForDeployment();
  const anonymousClaimAddress = await anonymousClaim.getAddress();
  deployedContracts['AnonymousClaim'] = anonymousClaimAddress;
  console.log(`✓ AnonymousClaim: ${anonymousClaimAddress}`);
  console.log(`  Merkle Root: ${merkleRoot}`);
  console.log(`  开始时间：${new Date(tsStart * 1000).toISOString()}`);
  console.log(`  结束时间：${new Date(tsEnd * 1000).toISOString()}\n`);

  // ========== 11+. 部署其余电路 Groth16Verifier（登记地址，混合方案链下校验用） ==========
  const extraVerifierFiles = [
    'history_anchor_verifier',
    'confidential_transfer_verifier',
    'multi_sig_proposal_verifier',
    'privacy_payment_verifier',
    'private_payment_verifier',
    'reputation_verifier_verifier',
  ];
  for (const base of extraVerifierFiles) {
    try {
      const art = await hre.artifacts.readArtifact(`contracts/verifiers/${base}.sol:Groth16Verifier`);
      const Factory = await ethers.getContractFactory(art.abi, art.bytecode);
      const c = await Factory.deploy();
      await c.waitForDeployment();
      const addr = await c.getAddress();
      deployedContracts[`Verifier__${base}`] = addr;
      console.log(`✓ Verifier__${base}: ${addr}`);
    } catch (e) {
      console.warn(`[跳过] ${base}: ${e.message || e}`);
    }
  }
  console.log('');
  
  // ========== 部署完成摘要 ==========
  console.log('\n' + '='.repeat(70));
  console.log('  部署完成摘要');
  console.log('='.repeat(70));
  console.log(`\n[网络] ${networkName}`);
  console.log(`[部署者] ${deployer.address}`);
  console.log('\n[合约地址]');
  
  // 按照 backend/.env 配置顺序输出合约地址（确保与后端配置一致）
  // 顺序来源：d:\Desktop\projects\trustaid-platform\backend\.env#L29-37
  const envOrder = [
    'ClaimVaultZK',                    // CLAIM_VAULT_ADDRESS
    'IdentityRegistry',                // IDENTITY_REGISTRY_ADDRESS
    'SBT',                             // SBT_ADDRESS
    'AnonymousClaim',                  // ANONYMOUS_CLAIM_ADDRESS
    'Governance',                      // GOVERNANCE_ADDRESS
    'PlatformRoleRegistry',            // PLATFORM_ROLE_REGISTRY_ADDRESS
    'ArbitratorPool',                  // ARBITRATOR_POOL_ADDRESS
    // 以下为其他合约（保持原有逻辑顺序）
    'AntiSybilGroth16Verifier',
    'AnonymousClaimGroth16Verifier',
    'IdentityCommitmentGroth16Verifier',
    'IdentityCommitmentZK',
    'AntiSybilClaimGroth16Verifier',
    'AntiSybilClaimZK',
    'ChallengeManager',
    'OracleManager',
    'PaymentChannel',
  ];
  
  // 先输出 .env 中配置的合约
  for (const name of envOrder) {
    if (deployedContracts[name]) {
      console.log(`  ${name}: ${deployedContracts[name]}`);
    }
  }
  
  // 再输出额外的 Verifier 合约（Verifier__* 前缀）
  for (const [name, address] of Object.entries(deployedContracts)) {
    if (name.startsWith('Verifier__')) {
      console.log(`  ${name}: ${address}`);
    }
  }
  
  // 最后输出 Mock 合约（如果使用 Mock 模式）
  if (!useRealZk) {
    for (const [name, address] of Object.entries(deployedContracts)) {
      if (name.startsWith('Mock') && !envOrder.includes(name)) {
        console.log(`  ${name}: ${address}`);
      }
    }
  }
  
  // ========== Mock 验证器审计警告 ==========
  if (!useRealZk) {
    console.log('\n' + '⚠'.repeat(35));
    console.log('  ⚠ 安全警告：当前部署使用 Mock ZK 验证器');
    console.log('  ⚠ 所有 ZK 证明验证将无条件通过（shouldPass=true）');
    console.log('  ⚠ 此配置仅适用于本地开发与测试网，严禁用于生产环境');
    console.log('  ⚠ Mock 合约地址：');
    for (const [name, addr] of Object.entries(deployedContracts)) {
      if (name.startsWith('Mock')) {
        console.log(`  ⚠   ${name}: ${addr}`);
      }
    }
    console.log('  ⚠ 链上可通过 IS_MOCK() 公开常量识别 Mock 合约');
    console.log('⚠'.repeat(35) + '\n');
  }

  // ========== 保存部署信息 ==========
  const deploymentResult = {
    deployer: deployer.address,
    network: networkName,
    chainId,
    useMockVerifiers: !useRealZk,
    timestamp: new Date().toISOString(),
    contracts: deployedContracts,
  };
  
  saveDeployment(networkName, deploymentResult);
  
  // ========== 导出 ABI ==========
  console.log('\n' + '='.repeat(70));
  console.log('  导出合约 ABI');
  console.log('='.repeat(70));
  
  let successCount = 0;
  let failCount = 0;

  /**
   * Hardhat 产物路径：默认可为 contracts/<category>/<Name>.sol/<Name>.json；
   * 多合约同文件时在 verifiers/MockZkStateMachineVerifiers.sol/<Name>.json
   */
  function resolveArtifactJsonPath(contractName, category) {
    const base = path.join(contractsRoot, "artifacts", "contracts", category);
    const shared = path.join(base, "MockZkStateMachineVerifiers.sol", `${contractName}.json`);
    if (fs.existsSync(shared)) return shared;
    return path.join(base, `${contractName}.sol`, `${contractName}.json`);
  }
  
  // 合约目录映射（根据实际 artifacts 结构）
  const contractDirs = {
    'MockGroth16Verifier': 'verifiers',
    'MockAntiSybilVerifier': 'verifiers',
    'MockIdentityCommitmentGroth16Verifier': 'verifiers',
    'MockAntiSybilClaimGroth16Verifier': 'verifiers',
    'IdentityRegistry': 'core',
    'IdentityCommitmentZK': 'core',
    'AntiSybilClaimZK': 'core',
    'ClaimVaultZK': 'core',
    'ArbitratorPool': 'governance',
    'PlatformRoleRegistry': 'governance',
    'ChallengeManager': 'governance',
    'SBT': 'core',
    'OracleManager': 'core',
    'Governance': 'governance',
    'PaymentChannel': 'channels',
    'AnonymousClaim': 'anonymous',
  };
  
  for (const [contractName, category] of Object.entries(contractDirs)) {
    if (!deployedContracts[contractName]) {
      continue; // 跳过未部署的合约
    }
    
    try {
      const artifactPath = resolveArtifactJsonPath(contractName, category);
      
      if (fs.existsSync(artifactPath)) {
        const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
        if (exportABI(contractName, artifact)) {
          successCount++;
        } else {
          failCount++;
        }
      } else {
        console.warn(`[ABI] 编译产物不存在：${contractName}`);
        console.warn(`  路径：${artifactPath}`);
        failCount++;
      }
    } catch (error) {
      console.error(`[ABI] 导出失败 ${contractName}:`, error.message);
      failCount++;
    }
  }
  
  console.log(`\n[ABI] 成功：${successCount} 个合约`);
  console.log(`[ABI] 失败：${failCount} 个合约`);
  console.log(`[ABI] 存储目录：${backendABIDir}`);

  if (useRealZk) {
    try {
      const idArt = await hre.artifacts.readArtifact(
        'contracts/verifiers/identity_commitment_verifier.sol:Groth16Verifier'
      );
      exportABI('IdentityCommitmentGroth16Verifier', { abi: idArt.abi });
      const claimArt = await hre.artifacts.readArtifact(
        'contracts/verifiers/anti_sybil_claim_verifier.sol:Groth16Verifier'
      );
      exportABI('AntiSybilClaimGroth16Verifier', { abi: claimArt.abi });
    } catch (e) {
      console.warn('[ABI] 导出独立电路 Verifier ABI 跳过:', e.message || e);
    }
  }
  
  // ========== 完成 ==========
  console.log('\n' + '='.repeat(70));
  console.log('✅ 所有合约部署完成！');
  console.log('='.repeat(70));
  console.log(`\n[提示] 部署文件位于：${deploymentsDir}`);
  console.log(`[提示] ABI 文件位于：${backendABIDir}`);
  console.log(`[提示] 使用最新部署：cat deployments/latest-${networkName}.json`);
  console.log();
}

// 执行部署
main().catch((error) => {
  console.error('\n❌ 部署失败:', error);
  process.exitCode = 1;
});
