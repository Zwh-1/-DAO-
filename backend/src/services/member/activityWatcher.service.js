/**
 * 链上事件同步服务（Watcher）
 *
 * 职责：
 *   - 监听合约关键事件（MemberJoined, ClaimSubmitted, ProofVerified 等）
 *   - 解析事件数据并持久化到数据库 / 内存兜底
 *   - 为 GET /v1/member/activity 提供数据源
 *
 * 启动时机：server.js 启动后调用 startActivityWatcher()
 */

import { ethers } from "ethers";
import { config } from "../../config.js";
import { getPool } from "../../db/pool.js";

// ── 内存兜底（无数据库时） ─────────────────────────────────────────────────
const memoryActivities = new Map(); // address -> ActivityRow[]

const MAX_MEMORY_PER_ADDRESS = 200;

/**
 * @typedef {{ id: string, address: string, action: string, txHash: string|null, blockNumber: number|null, timestamp: number, detail: string }} ActivityRow
 */

// ── 持久化 ────────────────────────────────────────────────────────────────

/**
 * 将事件写入数据库（无 DB 时落内存）
 */
export async function insertActivity(row) {
  const key = String(row.address).toLowerCase();
  const pool = getPool();

  if (pool) {
    try {
      await pool.execute(
        `INSERT INTO member_activity (id, address, action, tx_hash, block_number, timestamp, detail)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE id = id`,
        [row.id, key, row.action, row.txHash, row.blockNumber, row.timestamp, row.detail],
      );
      return;
    } catch (e) {
      console.warn("[activityWatcher] DB insert failed, fallback memory:", e.message);
    }
  }

  // 内存兜底
  if (!memoryActivities.has(key)) memoryActivities.set(key, []);
  const arr = memoryActivities.get(key);
  arr.unshift(row);
  if (arr.length > MAX_MEMORY_PER_ADDRESS) arr.length = MAX_MEMORY_PER_ADDRESS;
}

/**
 * 按地址查询活动记录
 * @param {string} address
 * @param {{ page?: number, limit?: number }} opts
 */
export async function queryActivities(address, opts = {}) {
  const key = String(address).toLowerCase();
  const page = Math.max(1, Number(opts.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(opts.limit) || 20));
  const offset = (page - 1) * limit;

  const pool = getPool();
  if (pool) {
    try {
      const [rows] = await pool.execute(
        `SELECT id, address, action, tx_hash AS txHash, block_number AS blockNumber,
                timestamp, detail
         FROM member_activity
         WHERE address = ?
         ORDER BY timestamp DESC
         LIMIT ? OFFSET ?`,
        [key, limit, offset],
      );
      const [[{ c }]] = await pool.execute(
        "SELECT COUNT(*) AS c FROM member_activity WHERE address = ?",
        [key],
      );
      return {
        activities: rows,
        total: Number(c),
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(Number(c) / limit)),
      };
    } catch (e) {
      console.warn("[activityWatcher] DB query failed, fallback memory:", e.message);
    }
  }

  // 内存兜底
  const all = memoryActivities.get(key) || [];
  return {
    activities: all.slice(offset, offset + limit),
    total: all.length,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(all.length / limit)),
  };
}

// ── 合约事件监听 ──────────────────────────────────────────────────────────

/** ClaimVaultZK ABI 片段（事件） */
const CLAIM_VAULT_EVENTS_ABI = [
  "event ClaimSubmitted(uint256 indexed claimId, address indexed applicant, uint256 amount)",
  "event ClaimApproved(uint256 indexed claimId)",
  "event ClaimRejected(uint256 indexed claimId)",
];

/** IdentityRegistry ABI 片段 */
const IDENTITY_EVENTS_ABI = [
  "event MemberRegistered(address indexed member, uint256 commitment)",
];

/** Governance ABI 片段 */
const GOVERNANCE_EVENTS_ABI = [
  "event ProposalCreated(uint256 indexed proposalId, address indexed proposer)",
  "event VoteCast(uint256 indexed proposalId, address indexed voter, uint8 support)",
];

let watcherRunning = false;

/**
 * 启动链上事件监听
 * 条件：RPC_URL 存在 && 至少有一个合约地址配置
 */
export function startActivityWatcher() {
  if (watcherRunning) return;
  if (!config.rpcUrl) {
    console.log("[activityWatcher] RPC_URL 未配置，跳过链上事件监听");
    return;
  }

  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  watcherRunning = true;

  // Hardhat 重启后 filter 失效，自动延迟重建
  provider.on('error', (err) => {
    const msg = err?.message ?? String(err);
    if (msg.includes('filter not found') || msg.includes('could not coalesce')) {
      watcherRunning = false;
      provider.removeAllListeners();
      setTimeout(() => startActivityWatcher(), 8000);
    }
  });

  // ClaimVaultZK
  if (config.claimVaultAddress) {
    try {
      const vault = new ethers.Contract(config.claimVaultAddress, CLAIM_VAULT_EVENTS_ABI, provider);

      vault.on("ClaimSubmitted", (claimId, applicant, amount, event) => {
        insertActivity({
          id: `claim-submit-${event.log.transactionHash}-${event.log.index}`,
          address: applicant,
          action: "CLAIM_SUBMIT",
          txHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber,
          timestamp: Math.floor(Date.now() / 1000),
          detail: `提交互助申请 #${claimId}，金额 ${ethers.formatEther(amount)} ETH`,
        }).catch((e) => console.warn("[activityWatcher] insert error:", e.message));
      });

      vault.on("ClaimApproved", (claimId, event) => {
        insertActivity({
          id: `claim-approved-${event.log.transactionHash}-${event.log.index}`,
          address: "", // 将在 UI 层按 claimId 关联
          action: "CLAIM_APPROVED",
          txHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber,
          timestamp: Math.floor(Date.now() / 1000),
          detail: `互助申请 #${claimId} 已通过`,
        }).catch((e) => console.warn("[activityWatcher] insert error:", e.message));
      });

      console.log("[activityWatcher] 已监听 ClaimVaultZK 事件");
    } catch (e) {
      console.warn("[activityWatcher] ClaimVaultZK 监听失败:", e.message);
    }
  }

  // IdentityRegistry
  if (config.identityRegistryAddress) {
    try {
      const registry = new ethers.Contract(config.identityRegistryAddress, IDENTITY_EVENTS_ABI, provider);

      registry.on("MemberRegistered", (member, _commitment, event) => {
        insertActivity({
          id: `member-reg-${event.log.transactionHash}-${event.log.index}`,
          address: member,
          action: "MEMBER_REGISTER",
          txHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber,
          timestamp: Math.floor(Date.now() / 1000),
          detail: "完成身份注册",
        }).catch((e) => console.warn("[activityWatcher] insert error:", e.message));
      });

      console.log("[activityWatcher] 已监听 IdentityRegistry 事件");
    } catch (e) {
      console.warn("[activityWatcher] IdentityRegistry 监听失败:", e.message);
    }
  }

  // Governance
  if (config.governanceAddress) {
    try {
      const gov = new ethers.Contract(config.governanceAddress, GOVERNANCE_EVENTS_ABI, provider);

      gov.on("ProposalCreated", (proposalId, proposer, event) => {
        insertActivity({
          id: `gov-propose-${event.log.transactionHash}-${event.log.index}`,
          address: proposer,
          action: "GOV_PROPOSE",
          txHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber,
          timestamp: Math.floor(Date.now() / 1000),
          detail: `创建治理提案 #${proposalId}`,
        }).catch((e) => console.warn("[activityWatcher] insert error:", e.message));
      });

      gov.on("VoteCast", (proposalId, voter, support, event) => {
        const supportLabel = support === 1 ? "赞成" : support === 0 ? "反对" : "弃权";
        insertActivity({
          id: `gov-vote-${event.log.transactionHash}-${event.log.index}`,
          address: voter,
          action: "GOV_VOTE",
          txHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber,
          timestamp: Math.floor(Date.now() / 1000),
          detail: `对提案 #${proposalId} 投出 ${supportLabel} 票`,
        }).catch((e) => console.warn("[activityWatcher] insert error:", e.message));
      });

      console.log("[activityWatcher] 已监听 Governance 事件");
    } catch (e) {
      console.warn("[activityWatcher] Governance 监听失败:", e.message);
    }
  }

  console.log("[activityWatcher] 链上事件同步已启动");
}

/**
 * 补入一条平台内活动（非链上事件，如 SIWE 登录、画像同步）
 */
export async function recordPlatformActivity(address, action, detail) {
  await insertActivity({
    id: `platform-${action}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    address,
    action,
    txHash: null,
    blockNumber: null,
    timestamp: Math.floor(Date.now() / 1000),
    detail,
  });
}
