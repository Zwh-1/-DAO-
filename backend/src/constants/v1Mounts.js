/**
 * Express `app.use()` 挂载前缀（与 frontend/lib/api/v1Routes.ts 中 V1Mount 保持一致）。
 * `V1Routes` 为未挂子路由器的全局端点完整路径（与 frontend V1Routes 对齐）。
 * 新增模块或全局端点时两边同步更新。
 */

export const V1 = "/v1";

/** Docker / 运维探活（无版本前缀，见 docker-compose healthcheck） */
export const ROOT_HEALTH_PATH = "/health";

/** 挂载到子路由文件的 URL 前缀 */
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
};

/** server.js 内直连 app.get/post 的路径（非 Router 挂载） */
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
};
