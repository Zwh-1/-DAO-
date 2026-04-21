/**
 * 链上角色解析：与 PlatformRoleRegistry、ArbitratorPool 对齐。
 * @see ../../../../docs/链上角色与权限.md
 */

import { ethers } from "ethers";
import { config } from "../config.js";

/** 由 PlatformRoleRegistry.hasRole(bytes32) 判定的角色（与合约 keccak256(abi.encodePacked(id)) 一致） */
const REGISTRY_ROLE_IDS = ["challenger", "oracle", "guardian", "dao"];

const ACCESS_CONTROL_HAS_ROLE = "function hasRole(bytes32 role, address account) view returns (bool)";
const ARBITRATOR_POOL_IS = "function isArbitrator(address addr) view returns (bool)";

/**
 * @returns {"memory"|"chain"|"chain_with_memory_fallback"}
 */
export function getRolesSource() {
  const s = config.rolesSource || "memory";
  if (s === "chain" || s === "chain_with_memory_fallback") return s;
  return "memory";
}

/**
 * 合并链上与内存角色（去重，member 放前由调用方保证）
 * @param {string[]} chainRoles
 * @param {string[]} memoryRoles
 * @returns {string[]}
 */
export function mergeRolesFromChainAndMemory(chainRoles, memoryRoles) {
  const set = new Set([...(chainRoles || []), ...(memoryRoles || [])]);
  const order = ["member", "arbitrator", "challenger", "oracle", "guardian", "dao"];
  const out = [];
  for (const r of order) {
    if (set.has(r)) out.push(r);
  }
  for (const r of set) {
    if (!order.includes(r)) out.push(r);
  }
  return out;
}

/**
 * 从链上 view 调用聚合角色列表（不含内存表）。
 * @param {string} address checksummed or lowercase 0x address
 * @returns {Promise<string[]>}
 */
export async function resolveRolesFromChain(address) {
  const addr = ethers.getAddress(address);
  const roles = ["member"];

  if (!config.rpcUrl?.trim()) {
    throw new Error("RPC_URL 未配置，无法解析链上角色");
  }

  const provider = new ethers.JsonRpcProvider(config.rpcUrl.trim());

  if (config.arbitratorPoolAddress?.trim()) {
    const pool = new ethers.Contract(
      config.arbitratorPoolAddress.trim(),
      [ARBITRATOR_POOL_IS],
      provider
    );
    const ok = await pool.isArbitrator(addr);
    if (ok) roles.push("arbitrator");
  }

  if (config.platformRoleRegistryAddress?.trim()) {
    const reg = new ethers.Contract(
      config.platformRoleRegistryAddress.trim(),
      [ACCESS_CONTROL_HAS_ROLE],
      provider
    );
    for (const roleId of REGISTRY_ROLE_IDS) {
      const roleHash = ethers.id(roleId);
      const has = await reg.hasRole(roleHash, addr);
      if (has) roles.push(roleId);
    }
  }

  return [...new Set(roles)];
}
