/**
 * HTTP API v1 路径唯一入口（与 backend Express 挂载及各 routes/*.js 内相对路径对齐）。
 * 新增或变更接口时请同步：`backend/src/constants/v1Mounts.js`（V1Mount + V1Routes.health/auth）。
 */

export const V1 = "/v1" as const;

/** 与后端 app.use() 挂载前缀一致（不含子路径） */
export const V1Mount = {
  identity: `${V1}/identity`,
  anonymousClaim: `${V1}/anonymous-claim`,
  channel: `${V1}/channel`,
  reputation: `${V1}/reputation`,
  multisig: `${V1}/multisig`,
  claim: `${V1}/claim`,
  oracle: `${V1}/oracle`,
  guardian: `${V1}/guardian`,
  governance: `${V1}/governance`,
  ai: `${V1}/ai`,
  security: `${V1}/security`,
  member: `${V1}/member`,
  challenge: `${V1}/challenge`,
  explorer: `${V1}/explorer`,
  zk: `${V1}/zk`,
} as const;

/** 完整 URL 路径（传给 apiFetch / client.get 等） */
export const V1Routes = {
  health: `${V1}/health`,
  healthDetailed: `${V1}/health/detailed`,

  auth: {
    nonce: `${V1}/auth/nonce`,
    verify: `${V1}/auth/verify`,
    refreshRoles: `${V1}/auth/refresh-roles`,
    activeRole: `${V1}/auth/active-role`,
    cookie: `${V1}/auth/cookie`,
  },

  claim: {
    propose: `${V1}/claim/propose`,
    status: (claimId: string) => `${V1}/claim/status/${encodeURIComponent(claimId)}`,
    nullifierAudit: `${V1}/claim/nullifier`,
  },

  governance: {
    proposals: `${V1}/governance/proposals`,
    propose: `${V1}/governance/propose`,
    vote: `${V1}/governance/vote`,
  },

  multisig: {
    verify: `${V1}/multisig/verify`,
    verifications: (proposalId: string) =>
      `${V1}/multisig/verifications/${encodeURIComponent(proposalId)}`,
    governanceQueue: (id: string | number) =>
      `${V1}/multisig/governance/queue/${encodeURIComponent(String(id))}`,
    governanceExecute: (id: string | number) =>
      `${V1}/multisig/governance/execute/${encodeURIComponent(String(id))}`,
    governanceCancel: (id: string | number) =>
      `${V1}/multisig/governance/cancel/${encodeURIComponent(String(id))}`,
    governanceOnchain: (id: string | number) =>
      `${V1}/multisig/governance/proposals/${encodeURIComponent(String(id))}/onchain`,
  },

  anonymousClaim: {
    status: `${V1}/anonymous-claim/status`,
    merkleRoot: `${V1}/anonymous-claim/merkle-root`,
    merkleProof: `${V1}/anonymous-claim/merkle-proof`,
    registerCommitment: `${V1}/anonymous-claim/register-commitment`,
    claim: `${V1}/anonymous-claim/claim`,
    nullifier: (hash: string) =>
      `${V1}/anonymous-claim/nullifier/${encodeURIComponent(hash)}`,
    fund: `${V1}/anonymous-claim/fund`,
  },

  channel: {
    open: `${V1}/channel/open`,
    all: `${V1}/channel/all`,
    state: (id: string) => `${V1}/channel/${encodeURIComponent(id)}/state`,
    updateState: (id: string) => `${V1}/channel/${encodeURIComponent(id)}/update-state`,
    startExit: (id: string) => `${V1}/channel/${encodeURIComponent(id)}/start-exit`,
    withdraw: (id: string) => `${V1}/channel/${encodeURIComponent(id)}/withdraw`,
    close: (id: string) => `${V1}/channel/${encodeURIComponent(id)}/close`,
    confidentialTransfer: `${V1}/channel/transfer/confidential`,
    privacyPayment: `${V1}/channel/transfer/privacy-payment`,
    privatePayment: `${V1}/channel/transfer/private-payment`,
  },

  zk: {
    verify: `${V1}/zk/verify`,
  },

  reputation: {
    verify: `${V1}/reputation/verify`,
    historyRoot: `${V1}/reputation/history/root`,
    historyAnchor: `${V1}/reputation/history/anchor`,
    historyProof: `${V1}/reputation/history/proof`,
    historyVerifyAnchor: `${V1}/reputation/history/verify-anchor`,
    address: (addr: string) => `${V1}/reputation/${encodeURIComponent(addr)}`,
    behaviors: (addr: string) => `${V1}/reputation/${encodeURIComponent(addr)}/behaviors`,
  },

  explorer: {
    stats: `${V1}/explorer/stats`,
    blocks: `${V1}/explorer/blocks`,
    /** 资源路径前缀，与 `${addresses}/${addr}` 组合 */
    addresses: `${V1}/explorer/addresses`,
    blockById: (id: string | number) =>
      `${V1}/explorer/blocks/${encodeURIComponent(String(id))}`,
    transactions: `${V1}/explorer/transactions`,
    transactionByHash: (hash: string) =>
      `${V1}/explorer/transactions/${encodeURIComponent(hash)}`,
    address: (address: string) =>
      `${V1}/explorer/addresses/${encodeURIComponent(address)}`,
    addressTransactions: (address: string) =>
      `${V1}/explorer/addresses/${encodeURIComponent(address)}/transactions`,
    search: `${V1}/explorer/search`,
  },

  oracle: {
    reports: `${V1}/oracle/reports`,
    reportPost: `${V1}/oracle/report`,
    sign: `${V1}/oracle/sign`,
    reportById: (reportId: string) =>
      `${V1}/oracle/report/${encodeURIComponent(reportId)}`,
    legacyReport: `${V1}/oracle/legacy-report`,
  },

  guardian: {
    blacklistGet: `${V1}/guardian/blacklist`,
    blacklistPost: `${V1}/guardian/blacklist`,
    status: `${V1}/guardian/status`,
    circuit: `${V1}/guardian/circuit`,
    auditLog: `${V1}/guardian/audit-log`,
    roles: `${V1}/guardian/roles`,
    memberRoles: (address: string) =>
      `${V1}/guardian/member-roles/${encodeURIComponent(address)}`,
  },

  ai: {
    chat: `${V1}/ai/chat`,
    securityAudit: `${V1}/ai/security-audit`,
    claimAudit: `${V1}/ai/claim-audit`,
  },

  security: {
    baseline: `${V1}/security/baseline`,
    nullifierDerive: `${V1}/security/nullifier/derive`,
    riskRecommend: `${V1}/security/recommend`,
  },

  member: {
    profile: (address: string) =>
      `${V1}/member/profile/${encodeURIComponent(address)}`,
    activity: `${V1}/member/activity`,
    reputation: `${V1}/member/reputation`,
    walletsBind: `${V1}/member/wallets/bind`,
    arbTasksMy: `${V1}/member/arb/tasks/my`,
    arbCommit: `${V1}/member/arb/commit`,
    arbReveal: `${V1}/member/arb/reveal`,
  },

  challenge: {
    init: `${V1}/challenge/init`,
    list: `${V1}/challenge/list`,
    verifyAntiSybilClaim: `${V1}/challenge/verify-anti-sybil-claim`,
  },

  identity: {
    register: `${V1}/identity/register`,
    registerWitness: `${V1}/identity/register-witness`,
    commitment: (hash: string) =>
      `${V1}/identity/commitment/${encodeURIComponent(hash)}`,
    commitmentUpdateLevel: `${V1}/identity/commitment/update-level`,
    commitmentBan: `${V1}/identity/commitment/ban`,
    commitmentExpiry: `${V1}/identity/commitment/expiry`,
    sbtMint: `${V1}/identity/sbt/mint`,
    sbtByAddress: (address: string) =>
      `${V1}/identity/sbt/${encodeURIComponent(address)}`,
    sbtUpdateCredit: `${V1}/identity/sbt/update-credit`,
    whitelistRoot: `${V1}/identity/whitelist/root`,
    whitelistProof: `${V1}/identity/whitelist/proof`,
    whitelistRegister: `${V1}/identity/whitelist/register`,
    verifyCommitmentZk: `${V1}/identity/verify-commitment-zk`,
  },
} as const;

/** client.ts / 旧代码兼容：扁平端点表（唯一维护处见上方 V1Routes） */
export const API_ENDPOINTS = {
  health: V1Routes.health,
  governance: V1Routes.governance,
  identity: {
    register: V1Routes.identity.register,
    registerWitness: V1Routes.identity.registerWitness,
    commitment: `${V1}/identity/commitment`,
    updateLevel: V1Routes.identity.commitmentUpdateLevel,
    ban: V1Routes.identity.commitmentBan,
    sbt: {
      mint: V1Routes.identity.sbtMint,
      info: (address: string) => V1Routes.identity.sbtByAddress(address),
      update: V1Routes.identity.sbtUpdateCredit,
    },
  },
  anonymousClaim: V1Routes.anonymousClaim,
  channel: {
    ...V1Routes.channel,
    listAll: V1Routes.channel.all,
  },
  reputation: V1Routes.reputation,
  multiSig: V1Routes.multisig,
  explorer: V1Routes.explorer,
  zk: V1Routes.zk,
} as const;
