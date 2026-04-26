/**
 * contracts.js
 * 新增合约的链上读取服务
 *
 * 支持合约：
 *   - ArbitratorPool  : pendingRewards / withdraw / claimRewards
 *   - OracleManager   : oracleStakes / totalStaked / stake / unstake / slash
 *   - Treasury        : balance / flowSummary
 *   - AuditLog        : getLog / getRecentLogs
 *
 * 设计原则：
 *   - 未配置合约地址 → graceful fallback（返回零值，不抛错）
 *   - 未配置 RPC_URL  → 直接返回 { onchain: false, ... }
 *   - 链上读取失败    → warn 日志 + 返回 null，由调用方决定是否降级
 */

import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { config } from "../config.js";
import { warn } from "../utils/logger.js";

// ── 最小化 ABI 片段（只包含读取所需的函数）────────────────────────────────

const ARB_POOL_ABI = [
  "function pendingRewards(address) view returns (uint256)",
  "function arbs(address) view returns (uint256 stake, bool active)",
  "function totalRewardPool() view returns (uint256)",
  "function pool(uint256) view returns (address)",
];

const ORACLE_MANAGER_ABI = [
  "function oracleStakes(address) view returns (uint256)",
  "function totalStaked() view returns (uint256)",
  "function isOracle(address) view returns (bool)",
  "function MIN_STAKE() view returns (uint256)",
];

const CHALLENGE_MANAGER_ABI = [
  "function lockedReward(uint256) view returns (uint256)",
  "function claimArbitratorReward(uint256 proposalId) external",
];

const TREASURY_ABI = [
  "function balance() view returns (uint256)",
  "function flowSummary() view returns (uint256 currentBalance, uint256 deposited, uint256 withdrawn)",
  "function totalDeposited() view returns (uint256)",
  "function totalWithdrawn() view returns (uint256)",
];

const AUDIT_LOG_ABI = [
  "function totalLogs() view returns (uint256)",
  "function getLog(uint256 logId) view returns (tuple(uint256 logId, uint8 logType, address actor, bytes32 refId, string ipfsCid, uint256 timestamp))",
  "function getRecentLogs(uint256 n) view returns (tuple(uint256 logId, uint8 logType, address actor, bytes32 refId, string ipfsCid, uint256 timestamp)[])",
];

// ── 日志类型映射（对应 AuditLog.sol LogType 枚举）──────────────────────────

const LOG_TYPE_LABELS = [
  "SystemPause", "ClaimApproved", "ClaimRejected", "ChallengeResolved",
  "OracleSlashed", "OraclePaused", "GovernanceExecuted", "FraudDetected",
  "ReportPublished", "ContractUpgrade",
];

// ── Provider 单例（只读，不需要签名者）────────────────────────────────────

let _provider = null;

function getProvider() {
  if (_provider) return _provider;
  if (!config.rpcUrl) return null;
  _provider = new JsonRpcProvider(config.rpcUrl);
  return _provider;
}

function getContract(address, abi) {
  const provider = getProvider();
  if (!provider || !address) return null;
  return new Contract(address, abi, provider);
}

// ── ArbitratorPool 读取 ───────────────────────────────────────────────────

/**
 * 查询仲裁员待领奖励（链上）
 * @param {string} address 仲裁员地址
 * @returns {Promise<{onchain: boolean, pendingRewards: string, staked: string, active: boolean}>}
 */
export async function getArbitratorRewards(address) {
  const fallback = {
    onchain: false,
    pendingRewards: "0",
    staked: "0",
    active: false,
    totalRewardPool: "0",
  };

  const contract = getContract(config.arbitratorPoolAddress, ARB_POOL_ABI);
  if (!contract) return fallback;

  try {
    const [pendingRaw, arbData, totalPool] = await Promise.all([
      contract.pendingRewards(address),
      contract.arbs(address),
      contract.totalRewardPool(),
    ]);

    return {
      onchain: true,
      pendingRewards: pendingRaw.toString(),
      staked: arbData.stake.toString(),
      active: arbData.active,
      totalRewardPool: totalPool.toString(),
    };
  } catch (err) {
    warn(`[chain/contracts] ArbitratorPool.read failed for ${address}: ${err.message}`);
    return fallback;
  }
}

// ── OracleManager 读取 ───────────────────────────────────────────────────

/**
 * 查询预言机质押状态（链上）
 * @param {string} address 预言机地址
 * @returns {Promise<{onchain: boolean, stakedWei: string, minStakeWei: string, active: boolean, totalStaked: string}>}
 */
export async function getOracleStake(address) {
  const fallback = {
    onchain: false,
    stakedWei: "0",
    minStakeWei: "10000000000000000",
    active: false,
    totalStaked: "0",
  };

  const contract = getContract(config.oracleManagerAddress, ORACLE_MANAGER_ABI);
  if (!contract) return fallback;

  try {
    const [staked, isActive, totalStaked, minStake] = await Promise.all([
      contract.oracleStakes(address),
      contract.isOracle(address),
      contract.totalStaked(),
      contract.MIN_STAKE(),
    ]);

    return {
      onchain: true,
      stakedWei: staked.toString(),
      minStakeWei: minStake.toString(),
      active: isActive,
      totalStaked: totalStaked.toString(),
    };
  } catch (err) {
    warn(`[chain/contracts] OracleManager.read failed for ${address}: ${err.message}`);
    return fallback;
  }
}

// ── Treasury 读取 ─────────────────────────────────────────────────────────

/**
 * 查询国库资金摘要（链上）
 * @returns {Promise<{onchain: boolean, currentBalance: string, totalDeposited: string, totalWithdrawn: string}>}
 */
export async function getTreasurySummary() {
  const fallback = {
    onchain: false,
    currentBalance: "0",
    totalDeposited: "0",
    totalWithdrawn: "0",
  };

  const contract = getContract(config.treasuryAddress, TREASURY_ABI);
  if (!contract) return fallback;

  try {
    const [currentBalance, deposited, withdrawn] = await contract.flowSummary();
    return {
      onchain: true,
      currentBalance: currentBalance.toString(),
      totalDeposited: deposited.toString(),
      totalWithdrawn: withdrawn.toString(),
    };
  } catch (err) {
    warn(`[chain/contracts] Treasury.flowSummary failed: ${err.message}`);
    return fallback;
  }
}

// ── AuditLog 读取 ─────────────────────────────────────────────────────────

/**
 * 从链上读取最近 n 条审计日志
 * @param {number} n 条数（最大 50）
 * @returns {Promise<{onchain: boolean, logs: object[], total: number}>}
 */
export async function getOnchainAuditLogs(n = 20) {
  const fallback = { onchain: false, logs: [], total: 0 };

  const contract = getContract(config.auditLogAddress, AUDIT_LOG_ABI);
  if (!contract) return fallback;

  try {
    const count = Math.min(n, 50);
    const [total, rawLogs] = await Promise.all([
      contract.totalLogs(),
      contract.getRecentLogs(count),
    ]);

    const logs = rawLogs.map((entry) => ({
      logId: Number(entry.logId),
      logType: Number(entry.logType),
      logTypeLabel: LOG_TYPE_LABELS[Number(entry.logType)] ?? "Unknown",
      actor: entry.actor,
      refId: entry.refId,
      ipfsCid: entry.ipfsCid,
      timestamp: Number(entry.timestamp),
    }));

    return { onchain: true, logs, total: Number(total) };
  } catch (err) {
    warn(`[chain/contracts] AuditLog.getRecentLogs failed: ${err.message}`);
    return fallback;
  }
}

// ── 写操作：使用 Relayer 钱包签名并广播 ──────────────────────────────────

const ORACLE_MANAGER_WRITE_ABI = [
  "function addOracle(address o) external",
  "function removeOracle(address o) external",
  "function slash(address oracle, uint256 amount, string calldata reason) external",
];

let _signer = null;

function getSigner() {
  if (_signer) return _signer;
  const provider = getProvider();
  if (!provider || !config.relayerPrivateKey) return null;
  try {
    _signer = new Wallet(
      config.relayerPrivateKey.startsWith("0x")
        ? config.relayerPrivateKey
        : `0x${config.relayerPrivateKey}`,
      provider
    );
  } catch {
    return null;
  }
  return _signer;
}

/**
 * 通过 Relayer 钱包暂停或恢复一个预言机
 * @param {string} oracle   目标预言机地址（或 'all' 时跳过链上调用）
 * @param {'pause'|'resume'} action
 * @returns {Promise<{onchain: boolean, txHash: string|null}>}
 */
export async function relayOraclePause(oracle, action) {
  if (oracle === "all") {
    return { onchain: false, txHash: null, message: "'all' 模式：请逐一调用各 oracle 地址" };
  }

  const signer = getSigner();
  const contract = getContract(config.oracleManagerAddress, ORACLE_MANAGER_WRITE_ABI);
  if (!signer || !contract) {
    return { onchain: false, txHash: null };
  }

  const contractWithSigner = contract.connect(signer);
  try {
    const tx = action === "pause"
      ? await contractWithSigner.removeOracle(oracle)
      : await contractWithSigner.addOracle(oracle);
    const receipt = await tx.wait();
    return { onchain: true, txHash: tx.hash, blockNumber: receipt.blockNumber };
  } catch (err) {
    warn(`[chain/contracts] OracleManager.${action} failed for ${oracle}: ${err.message}`);
    return { onchain: false, txHash: null, error: err.message };
  }
}

// ── 仲裁奖励明细（按提案）────────────────────────────────────────────────

/**
 * 查询指定仲裁员参与的奖励明细
 * 此函数通过 ChallengeManager.lockedReward(proposalId) 检查奖励
 * @param {string[]} proposalIds 提案 ID 列表
 * @returns {Promise<object[]>}
 */
export async function getArbitratorRewardsByProposals(proposalIds) {
  const contract = getContract(config.challengeManagerAddress, CHALLENGE_MANAGER_ABI);
  if (!contract || !proposalIds?.length) return [];

  const results = await Promise.allSettled(
    proposalIds.map(async (pid) => {
      try {
        const amount = await contract.lockedReward(BigInt(pid));
        return { proposalId: String(pid), amount: amount.toString(), claimed: amount === 0n };
      } catch {
        return { proposalId: String(pid), amount: "0", claimed: false };
      }
    })
  );

  return results
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);
}
