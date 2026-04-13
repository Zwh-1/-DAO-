import { verifyJwt } from "../auth/jwt.js";
import { config } from "../config.js";

export function requireAuth(req, res, next) {
  if (config.bypassAuth) {
    const addr =
      String(req.body?.address || req.body?.challenger || req.body?.arbitrator || "").toLowerCase() ||
      "0x0000000000000000000000000000000000000000";
    req.auth = { address: addr, roles: ["member"] };
    return next();
  }
  const secret = config.jwtSecret;
  if (!secret) {
    return res.status(500).json({ code: 5005, error: "JWT 未配置" });
  }
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) {
    return res.status(401).json({ code: 1001, error: "Invalid_Signature 或未登录" });
  }
  const token = h.slice("Bearer ".length);
  const payload = verifyJwt(token, secret);
  if (!payload?.address) {
    return res.status(401).json({ code: 1001, error: "JWT 无效或已过期" });
  }
  req.auth = {
    address: String(payload.address).toLowerCase(),
    roles: Array.isArray(payload.roles) ? payload.roles : ["member"],
  };
  return next();
}

export function requireRole(roleId) {
  return (req, res, next) => {
    const roles = req.auth?.roles ?? [];
    if (!roles.includes(roleId)) {
      return res.status(403).json({ code: 4003, error: `需要 ${roleId} 角色权限` });
    }
    next();
  };
}

export function requireAdmin(req, res, next) {
  const secret = config.adminToken;
  if (!secret) {
    if (config.nodeEnv === "production") {
      return res.status(403).json({ code: 9002, error: "需要配置 ADMIN_TOKEN" });
    }
    return next();
  }
  const h = req.headers.authorization || "";
  const bearer = h.startsWith("Bearer ") ? h.slice("Bearer ".length) : "";
  const xToken = String(req.headers["x-admin-token"] || "");
  const token = bearer || xToken;
  if (token !== secret) {
    return res.status(403).json({ code: 9002, error: "需要管理员权限" });
  }
  return next();
}
