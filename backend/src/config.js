/**
 * 配置管理模块
 * 
 * 功能：
 * - 加载 .env.local（优先级低于环境变量）
 * - 类型验证和默认值
 * - 敏感信息脱敏
 * - 配置校验
 * 
 * 安全说明：
 * - 不输出敏感配置到日志
 * - 生产环境强制校验必要配置
 */

// 加载 .env.local（优先级低于已有 env vars，node --env-file 或 CI 注入的优先）
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * 安全地加载 .env.local 文件
 * 
 * @returns {Object<string, string>} 解析后的环境变量对象
 */
function loadEnvLocal() {
  const envVars = {};
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 0) continue;
      const key = t.slice(0, eq).trim();
      const val = t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
      if (key && !process.env[key]) envVars[key] = val;
    }
  } catch { /* .env.local 不存在时静默跳过 */ }
  return envVars;
}

// 应用 .env.local 中的环境变量
const envLocal = loadEnvLocal();
Object.entries(envLocal).forEach(([key, val]) => {
  if (!process.env[key]) process.env[key] = val;
});

/**
 * 验证地址格式（简化的以太坊地址验证）
 * 
 * @param {string} addr 待验证的地址
 * @returns {boolean} 是否为有效地址
 */
function isValidAddress(addr) {
  return typeof addr === "string" && /^0x[a-fA-F0-9]{40}$/.test(addr);
}

/**
 * 验证私钥格式（64 字符十六进制）
 * 
 * @param {string} key 私钥
 * @returns {boolean} 是否为有效私钥
 */
function isValidPrivateKey(key) {
  return typeof key === "string" && /^[a-fA-F0-9]{64}$/.test(key);
}

/**
 * 数据库连接字符串验证（MySQL 格式）
 * 
 * @param {string} url 数据库连接字符串
 * @returns {boolean} 是否为有效 MySQL 连接字符串
 */
function isValidMySQLUrl(url) {
  return typeof url === "string" && url.startsWith("mysql://");
}

// 配置对象（带类型和默认值）
export const config = {
  // 服务器配置
  port: Number(process.env.PORT || 3010),
  nodeEnv: process.env.NODE_ENV || "development",
  
  // 链上配置
  rpcUrl: process.env.RPC_URL || "",
  /** EIP-712 / 通道状态签名域；默认 Hardhat 31337 */
  chainId: Number(process.env.CHAIN_ID || process.env.CHAINID || 31337),
  claimVaultAddress: process.env.CLAIM_VAULT_ADDRESS || "",
  identityRegistryAddress: process.env.IDENTITY_REGISTRY_ADDRESS || "",
  sbtAddress: process.env.SBT_ADDRESS || "",
  anonymousClaimAddress: process.env.ANONYMOUS_CLAIM_ADDRESS || "",
  governanceAddress: process.env.GOVERNANCE_ADDRESS || "",
  /** 链上应用角色注册表（PlatformRoleRegistry），与 docs/链上角色与权限.md 一致 */
  platformRoleRegistryAddress: process.env.PLATFORM_ROLE_REGISTRY_ADDRESS || "",
  /** 仲裁员池，用于解析 arbitrator 角色 */
  arbitratorPoolAddress: process.env.ARBITRATOR_POOL_ADDRESS || "",
  /** 国库合约地址（资金流分析） */
  treasuryAddress: process.env.TREASURY_ADDRESS || "",
  /** 审计日志合约地址（链上日志） */
  auditLogAddress: process.env.AUDIT_LOG_ADDRESS || "",
  /** 挑战管理器地址（仲裁奖励读取） */
  challengeManagerAddress: process.env.CHALLENGE_MANAGER_ADDRESS || "",
  /** 预言机管理器地址（质押读取） */
  oracleManagerAddress: process.env.ORACLE_MANAGER_ADDRESS || "",
  /**
   * 角色来源：memory | chain | chain_with_memory_fallback
   * @see docs/链上角色与权限.md
   */
  rolesSource: (process.env.ROLES_SOURCE || "memory").toLowerCase(),
  relayerPrivateKey: process.env.RELAYER_PRIVATE_KEY || "",
  
  // 业务配置
  minChallengeStake: Number(process.env.MIN_CHALLENGE_STAKE || 100),
  
  // 数据库配置
  databaseUrl: process.env.DATABASE_URL || "",
  
  // 认证配置
  jwtSecret: process.env.JWT_SECRET || "dev-change-me-trustaid",
  adminToken: process.env.ADMIN_TOKEN || "",
  bypassAuth: process.env.BYPASS_AUTH === "1",
  
  // AI 服务配置
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || "",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  
  // ZKP 配置
  circuitWasmDir: process.env.CIRCUIT_WASM_DIR || "../circuits/build",
  /** circuits/build 绝对路径或相对 backend 的路径；空则使用 backend 内建默认指向仓库 circuits/build */
  zkCircuitsBuildDir: (process.env.ZK_CIRCUITS_BUILD_DIR || "").trim() || null,
  /** vkey 缺失时是否跳过 groth16.verify（开发默认跳过；生产建议 ZK_VERIFY_SKIP_MISSING_VKEY=0） */
  zkVerifySkipMissingVkey: process.env.ZK_VERIFY_SKIP_MISSING_VKEY !== "0",

  /**
   * BYPASS_AUTH=1 时，是否允许无 Bearer 而用 body 拼地址（伪造身份）。
   * 默认 false：开发也必须带 JWT 或使用显式开启。
   */
  allowBypassBodyAuth: process.env.ALLOW_BYPASS_BODY_AUTH === "1",

  /**
   * 未配置 ADMIN_TOKEN 时是否仍放行 requireAdmin（仅非 production）。
   * 默认 false：返回 503，需设置 ADMIN_TOKEN 或 ALLOW_INSECURE_ADMIN=1。
   */
  allowInsecureAdmin: process.env.ALLOW_INSECURE_ADMIN === "1",

  /**
   * 生产环境是否允许 POST /security/nullifier/derive 接收 secret。
   * 默认 false：生产禁用，客户端应本地派生。
   */
  allowServerNullifierDerive: process.env.ALLOW_SERVER_NULLIFIER_DERIVE === "1",
};

/**
 * 支付通道写接口是否强制调用方为 participant（生产默认开启）。
 */
export function isChannelParticipantCheckStrict() {
  return config.nodeEnv === "production" || process.env.FORCE_CHANNEL_PARTICIPANT_CHECK === "1";
}

/**
 * 配置验证器（生产环境强制校验）
 * 
 * 验证项：
 * - 生产环境 JWT_SECRET 必须修改
 * - MySQL 连接字符串格式正确
 * - 链上地址格式正确（如果配置了）
 * - 私钥格式正确（如果配置了）
 * 
 * @throws {Error} 配置校验失败时抛出错误
 */
export function validateConfig() {
  const errors = [];
  
  // 生产环境安全检查
  if (config.nodeEnv === "production") {
    if (config.jwtSecret === "dev-change-me-trustaid") {
      errors.push("生产环境必须修改 JWT_SECRET");
    }
    if (!config.adminToken) {
      errors.push("生产环境必须配置 ADMIN_TOKEN");
    }
    if (config.bypassAuth) {
      errors.push("生产环境禁止启用 BYPASS_AUTH（认证降级）");
    }
    const rs = config.rolesSource;
    if (rs === "chain") {
      if (!config.rpcUrl?.trim()) {
        errors.push("生产环境 ROLES_SOURCE=chain 时必须配置 RPC_URL");
      }
      if (!config.platformRoleRegistryAddress?.trim()) {
        errors.push("生产环境 ROLES_SOURCE=chain 时必须配置 PLATFORM_ROLE_REGISTRY_ADDRESS");
      }
    }
  }
  
  // 数据库配置验证
  if (config.databaseUrl && !isValidMySQLUrl(config.databaseUrl)) {
    errors.push("DATABASE_URL 格式错误：必须是 mysql:// 开头");
  }
  
  // 地址格式验证（仅当配置时验证）
  const addresses = {
    "CLAIM_VAULT_ADDRESS": config.claimVaultAddress,
    "IDENTITY_REGISTRY_ADDRESS": config.identityRegistryAddress,
    "SBT_ADDRESS": config.sbtAddress,
    "ANONYMOUS_CLAIM_ADDRESS": config.anonymousClaimAddress,
    "GOVERNANCE_ADDRESS": config.governanceAddress,
    "PLATFORM_ROLE_REGISTRY_ADDRESS": config.platformRoleRegistryAddress,
    "ARBITRATOR_POOL_ADDRESS": config.arbitratorPoolAddress,
  };
  
  Object.entries(addresses).forEach(([name, addr]) => {
    if (addr && !isValidAddress(addr)) {
      errors.push(`${name} 格式错误：必须是 0x 开头的 40 字符十六进制`);
    }
  });
  
  // 私钥格式验证（仅当配置时验证）
  if (config.relayerPrivateKey && !isValidPrivateKey(config.relayerPrivateKey)) {
    errors.push("RELAYER_PRIVATE_KEY 格式错误：必须是 64 字符十六进制");
  }
  
  // 抛出配置错误
  if (errors.length > 0) {
    const errorMsg = `配置验证失败：\n${errors.map(e => `  - ${e}`).join("\n")}`;
    console.error("[config] " + errorMsg);
    throw new Error(errorMsg);
  }
  
  console.log("[config] 配置验证通过");
}

/**
 * 判断是否启用了链上中继
 * 
 * 启用条件：
 * - RPC URL 存在
 * - ClaimVault 合约地址存在
 * - 中继私钥存在
 * 
 * @returns {boolean} 是否启用链上中继
 */
export function isOnchainRelayEnabled() {
  return Boolean(
    config.rpcUrl && config.claimVaultAddress && config.relayerPrivateKey
  );
}

/**
 * 匿名申领（anonymous_claim）环境是否满足链上只读 / 全量中继（与 docs/ZK申领端到端.md 一致）
 *
 * - chainReadOk：RPC + ANONYMOUS_CLAIM_ADDRESS 即可读池子、nullifier 等（无需中继私钥）
 * - relayOk：另配 RELAYER_PRIVATE_KEY 后代播 claim 交易
 */
export function getAnonymousClaimEnvSummary() {
  const rpc = Boolean(config.rpcUrl?.trim());
  const addr = Boolean(config.anonymousClaimAddress?.trim());
  const key = Boolean(config.relayerPrivateKey?.trim());
  return {
    chainReadOk: rpc && addr,
    relayOk: rpc && addr && key,
  };
}

/**
 * 获取脱敏后的配置信息（用于日志）
 * 
 * 脱敏规则：
 * - 私钥、Token 显示前 6 字符 + ***
 * - 地址显示前 10 字符 + ...
 * - 密码、密钥完全隐藏
 * 
 * @returns {Object} 脱敏后的配置对象
 */
export function getSanitizedConfig() {
  const mask = (str, show = 6) => {
    if (!str) return "***";
    return str.length > show ? `${str.slice(0, show)}***` : "***";
  };
  
  return {
    port: config.port,
    nodeEnv: config.nodeEnv,
    chainId: config.chainId,
    rpcUrl: mask(config.rpcUrl, 15),
    claimVaultAddress: mask(config.claimVaultAddress, 10),
    anonymousClaimAddress: mask(config.anonymousClaimAddress, 10),
    databaseUrl: mask(config.databaseUrl, 10),
    jwtSecret: mask(config.jwtSecret),
    adminToken: mask(config.adminToken),
    bypassAuth: config.bypassAuth,
    rolesSource: config.rolesSource,
    minChallengeStake: config.minChallengeStake,
    circuitWasmDir: config.circuitWasmDir,
    // 不输出私钥和 AI API Key
    hasRelayerKey: Boolean(config.relayerPrivateKey),
    hasDeepseekKey: Boolean(config.deepseekApiKey),
    hasOpenaiKey: Boolean(config.openaiApiKey),
    allowBypassBodyAuth: config.allowBypassBodyAuth,
    allowInsecureAdmin: config.allowInsecureAdmin,
    allowServerNullifierDerive: config.allowServerNullifierDerive,
  };
}
