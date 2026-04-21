import { ROLE_ORDER, type RoleId } from "@/store/authStore";

export function isKnownRoleId(value: unknown): value is RoleId {
  return typeof value === "string" && (ROLE_ORDER as readonly string[]).includes(value);
}

export function sanitizeRoles(roles: unknown[] | undefined): RoleId[] {
  if (!Array.isArray(roles)) return [];
  return roles.filter(isKnownRoleId);
}

/**
 * 与后端 pickActiveRole 一致：在已有角色中选默认/保留上一身份
 */
export function pickDefaultActiveRole(roles: RoleId[], previous: RoleId | null): RoleId {
  const valid = sanitizeRoles(roles);
  if (valid.length === 0) return "member";
  if (previous && valid.includes(previous)) return previous;
  const hit = ROLE_ORDER.find((r) => valid.includes(r));
  return hit ?? valid[0];
}
