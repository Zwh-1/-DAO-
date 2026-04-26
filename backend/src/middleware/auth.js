import { verifyJwt } from "../auth/jwt.js";
import { pickActiveRole } from "../auth/active-role.js";
import { config } from "../config.js";

/**
 * 从 JWT payload 构造 req.auth，并规范化 activeRole ⊆ roles
 */
function authFromPayload(payload) {
  const address = String(payload.address).toLowerCase();
  const roles = Array.isArray(payload.roles) ? payload.roles : ["member"];
  let prev = payload.activeRole;
  if (prev != null && prev !== "" && !roles.includes(String(prev))) {
    prev = undefined;
  }
  const activeRole = pickActiveRole(roles, prev);
  return {
    address,
    roles,
    activeRole,
    exp: payload.exp,
    iat: payload.iat,
  };
}

export function requireAuth(req, res, next) {
  // 开发环境降级认证（禁止在生产环境使用）
  if (config.bypassAuth) {
    if (config.nodeEnv === "production") {
      console.warn("[auth] 警告：生产环境启用了 BYPASS_AUTH，存在安全风险！");
    }

    /**
     * 携带 Bearer 时仍解析 JWT，避免无 body 的路由（如 POST /auth/refresh-roles）
     * 误用 req.body 地址并回退到 0x0。
     */
    const h = req.headers.authorization || "";
    if (h.startsWith("Bearer ")) {
      const secret = config.jwtSecret;
      if (!secret) {
        console.error("[auth] JWT Secret 未配置");
        return res.status(500).json({ code: 5005, error: "服务器配置错误" });
      }
      const token = h.slice("Bearer ".length);
      const payload = verifyJwt(token, secret);
      if (!payload?.address) {
        return res.status(401).json({
          code: 1001,
          error: "未登录或签名无效",
          hint: "BYPASS_AUTH 下 Bearer Token 无效或已过期",
        });
      }
      req.auth = authFromPayload(payload);
      return next();
    }

    if (!config.allowBypassBodyAuth) {
      return res.status(401).json({
        code: 1001,
        error: "BYPASS_AUTH 下未携带 Bearer，已禁止 body 伪造身份",
        hint: "请使用 Authorization: Bearer <JWT>，或设置 ALLOW_BYPASS_BODY_AUTH=1（仅限本地调试）",
      });
    }

    const addr =
      String(req.body?.address || req.body?.challenger || req.body?.arbitrator || "").toLowerCase() ||
      "0x0000000000000000000000000000000000000000";
    req.auth = { address: addr, roles: ["member"], activeRole: "member" };
    return next();
  }

  // 验证 JWT Secret
  const secret = config.jwtSecret;
  if (!secret) {
    console.error("[auth] JWT Secret 未配置");
    return res.status(500).json({ code: 5005, error: "服务器配置错误" });
  }
  
  // 检查 Authorization Header
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) {
    return res.status(401).json({ 
      code: 1001, 
      error: "未登录或签名无效",
      hint: "请在 Authorization Header 中携带 Bearer Token"
    });
  }
  
  // 解析并验证 JWT Token
  const token = h.slice("Bearer ".length);
  let payload;
  try {
    payload = verifyJwt(token, secret);
  } catch (err) {
    console.warn("[auth] JWT 验证失败:", err.message);
    return res.status(401).json({ 
      code: 1001, 
      error: "Token 无效或已过期",
      expired: err.message?.includes("expired")
    });
  }
  
  // 验证 payload 完整性
  if (!payload?.address) {
    console.warn("[auth] JWT payload 缺少 address 字段");
    return res.status(401).json({ code: 1001, error: "Token 格式错误" });
  }
  
  req.auth = authFromPayload(payload);

  return next();
}

export function requireRole(roleId) {
  return (req, res, next) => {
    const roles = req.auth?.roles ?? [];
    if (!roles.includes(roleId)) {
      return res.status(403).json({ 
        code: 4003, 
        error: `权限不足`,
        required: roleId,
        current: roles.length > 0 ? roles : "anonymous"
      });
    }
    next();
  };
}

/**
 * 多角色放行：req.auth.roles 含 roles 中任一角色则通过（逻辑 OR）。
 * @param {string[]} roles 允许的角色数组
 */
export function requireAnyRole(roles) {
  return (req, res, next) => {
    const userRoles = req.auth?.roles ?? [];
    const hasAny = roles.some((r) => userRoles.includes(r));
    if (!hasAny) {
      return res.status(403).json({
        code: 4003,
        error: "权限不足",
        required: roles,
        current: userRoles.length > 0 ? userRoles : "anonymous",
      });
    }
    next();
  };
}

/**
 * 软认证：有合法 Bearer Token 则解析并挂到 req.auth，否则静默透传。
 * 用于不强制登录但需感知角色的端点（如 AI 聊天）。
 */
export function tryAuth(req, _res, next) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return next();
  const secret = config.jwtSecret;
  if (!secret) return next();
  const token = h.slice("Bearer ".length);
  try {
    const payload = verifyJwt(token, secret);
    if (payload?.address) req.auth = authFromPayload(payload);
  } catch {
    // 软认证：失败静默忽略，不返回 401
  }
  return next();
}

export function requireAdmin(req, res, next) {
  const secret = config.adminToken;
  
  // 生产环境强制校验
  if (!secret) {
    if (config.nodeEnv === "production") {
      console.error("[auth] 生产环境未配置 ADMIN_TOKEN");
      return res.status(403).json({ 
        code: 9002, 
        error: "服务器配置错误：需要 ADMIN_TOKEN" 
      });
    }
    if (!config.allowInsecureAdmin) {
      console.warn("[auth] ADMIN_TOKEN 未配置且未设置 ALLOW_INSECURE_ADMIN=1");
      return res.status(503).json({
        code: 5032,
        error: "管理员凭证未配置",
        hint: "设置环境变量 ADMIN_TOKEN，或本地调试设置 ALLOW_INSECURE_ADMIN=1（不安全）",
      });
    }
    console.warn("[auth] 开发环境：ALLOW_INSECURE_ADMIN=1，跳过管理员验证（不安全）");
    return next();
  }
  
  // 尝试从多个位置获取 Token
  const h = req.headers.authorization || "";
  const bearer = h.startsWith("Bearer ") ? h.slice("Bearer ".length) : "";
  const xToken = String(req.headers["x-admin-token"] || "");
  const token = bearer || xToken;
  
  // 验证 Token
  if (token !== secret) {
    console.warn("[auth] 管理员 Token 验证失败");
    return res.status(403).json({ 
      code: 9002, 
      error: "管理员权限验证失败" 
    });
  }
  
  return next();
}
