#!/usr/bin/env node

/**
 * TrustAID 平台全量合约部署脚本 - 健壮增强版
 */

import hre from "hardhat";
const { ethers } = hre;
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractsRoot = path.join(__dirname, "..");
const deploymentsDir = path.join(contractsRoot, "deployments");
const backendABIDir = process.env.BACKEND_ABI_DIR || path.join(contractsRoot, "..", "backend", "src", "abis");

// ============================================================================
// 工具函数
// ============================================================================

function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function saveDeployment(networkName, deployments) {
  ensureDirExists(deploymentsDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const data = JSON.stringify(deployments, null, 2);
  fs.writeFileSync(path.join(deploymentsDir, `${networkName}-${timestamp}.json`), data);
  fs.writeFileSync(path.join(deploymentsDir, `latest-${networkName}.json`), data);
}

function exportABI(customName, artifact) {
  if (!artifact.abi) return;
  ensureDirExists(backendABIDir);
  fs.writeFileSync(path.join(backendABIDir, `${customName}.json`), JSON.stringify(artifact.abi, null, 2));
}

/**
 * 健壮的部署函数
 */
async function deployContract(artifactId, deployArgs = [], overrides = {}) {
  try {
    const factory = await ethers.getContractFactory(artifactId);
    
    // 获取当前网络的费率
    const feeData = await ethers.provider.getFeeData();
    const gasConfig = {
      ...overrides,
    };

    // 如果是 EIP-1559 兼容网络则自动调整
    if (feeData.maxFeePerGas) {
      gasConfig.maxFeePerGas = (feeData.maxFeePerGas * 120n) / 100n;
      gasConfig.maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas * 120n) / 100n;
    }

    const contract = await factory.deploy(...deployArgs, gasConfig);
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    return { contract, address, artifactId };
  } catch (error) {
    console.error(`  ✗ [部署严重失败] ${artifactId}:`, error.message);
    // 如果核心合约部署失败，直接退出进程，防止后续读取 undefined 报错
    process.exit(1); 
  }
}

// ============================================================================
// 主流程
// ============================================================================

async function main() {
  const networkName = hre.network.name;
  const [deployer] = await ethers.getSigners();
  
  // 检查余额
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("\n" + "=".repeat(80));
  console.log(` 🚀 TrustAID 部署任务启动`);
  console.log(` 🌐 网络: ${networkName.toUpperCase()} (ChainID: ${(await ethers.provider.getNetwork()).chainId})`);
  console.log(` 👤 部署者: ${deployer.address} | 余额: ${ethers.formatEther(balance)} ETH`);
  console.log("=".repeat(80) + "\n");

  const deployedList = [];
  const register = (name, result) => {
    if (result && result.address) {
      deployedList.push({ name, address: result.address, artifactId: result.artifactId, contract: result.contract });
      console.log(`  [已部署] ${name.padEnd(25)} -> ${result.address}`);
    }
  };
  
  // 安全获取地址的工具
  const getAddr = (name) => deployedList.find(c => c.name === name)?.address || ethers.ZeroAddress;

  // 1. ZK 验证器部署 (自动切换 Mock 或 Real)
  const useRealZk = process.env.USE_MOCK_ZK_VERIFIERS !== "1";
  const verifierPath = (file) => `contracts/verifiers/${file}.sol:Groth16Verifier`;

  console.log(` 🛠  正在部署 ZK 验证器 (模式: ${useRealZk ? "REAL" : "MOCK"})...`);
  
  const v1 = await deployContract(useRealZk ? verifierPath("anti_sybil_verifier_verifier") : "MockAntiSybilVerifier", useRealZk ? [] : [true]);
  const v2 = await deployContract(useRealZk ? verifierPath("anonymous_claim_verifier") : "MockGroth16Verifier", useRealZk ? [] : [true]);
  const v3 = await deployContract(useRealZk ? verifierPath("identity_commitment_verifier") : "MockIdentityCommitmentGroth16Verifier", useRealZk ? [] : [true]);
  const v4 = await deployContract(useRealZk ? verifierPath("anti_sybil_claim_verifier") : "MockAntiSybilClaimGroth16Verifier", useRealZk ? [] : [true]);

  // 2. 核心与业务合约
  console.log(` 🛠  正在部署核心业务逻辑...`);
  
  register("IdentityRegistry", await deployContract("IdentityRegistry"));
  
  // 使用 ?. 可选链确保 v3 不会引发崩溃
  register("IdentityCommitmentZK", await deployContract("IdentityCommitmentZK", [v3?.address || ethers.ZeroAddress]));
  register("AntiSybilClaimZK", await deployContract("AntiSybilClaimZK", [v4?.address || ethers.ZeroAddress]));
  
  register("ClaimVaultZK", await deployContract("ClaimVaultZK", [
    v1?.address || ethers.ZeroAddress,
    getAddr("IdentityRegistry"),
    process.env.MIN_CLAIM || "1000", 
    process.env.MAX_CLAIM || "200000", 
    0n, 0n, 1n
  ]));

  register("SBT", await deployContract("SBT", [getAddr("IdentityRegistry")]));
  register("FamilyMemberSBT", await deployContract("FamilyMemberSBT", [getAddr("SBT")]));
  register("ArbitratorPool", await deployContract("ArbitratorPool"));
  register("PlatformRoleRegistry", await deployContract("PlatformRoleRegistry", [deployer.address]));
  register("Governance", await deployContract("Governance", [getAddr("SBT")]));
  register("OracleManager", await deployContract("OracleManager"));

  register("AnonymousClaim", await deployContract("AnonymousClaim", [
    v2?.address || ethers.ZeroAddress,
    ethers.keccak256(ethers.toUtf8Bytes("seed")),
    Math.floor(Date.now() / 1000),
    Math.floor(Date.now() / 1000) + 86400 * 30
  ]));
  
  register("ChallengeManager", await deployContract("ChallengeManager", [getAddr("ArbitratorPool"), getAddr("SBT"), getAddr("IdentityRegistry")]));
  register("Treasury", await deployContract("Treasury"));
  register("AuditLog", await deployContract("AuditLog"));

  // 3. 初始配置
  const treasury = deployedList.find(c => c.name === "Treasury");
  if (treasury && getAddr("Governance") !== ethers.ZeroAddress) {
    console.log(` ⚙️  配置 Treasury 治理权限...`);
    const tx = await treasury.contract.setGovernance(getAddr("Governance"));
    await tx.wait();
  }

  // 4. 保存与导出
  console.log("\n" + "=".repeat(80));
  console.log(" ✨ 部署完成！正在导出 ABI 和环境配置...");
  
  const finalMap = {};
  for (const item of deployedList) {
    finalMap[item.name] = item.address;
    const art = await hre.artifacts.readArtifact(item.artifactId);
    exportABI(item.name, art);
  }
  
  const savedPath = saveDeployment(networkName, { network: networkName, contracts: finalMap });
  console.log(` ✅ 部署记录已保存至: deployments/latest-${networkName}.json`);
  console.log("=".repeat(80) + "\n");
}

main().catch(err => {
  console.error("\n 🚨 脚本异常终止:", err);
  process.exit(1);
});