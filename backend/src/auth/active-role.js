/**
 * 与前端 ROLE_ORDER 一致：用于在多个角色间选择默认/当前 activeRole
 */
export const ROLE_ORDER = [
  "member",
  "challenger",
  "dao",
  "arbitrator",
  "oracle",
  "guardian",
];

const VALID = new Set(ROLE_ORDER);

/**
 * @param {string[]} roles
 * @param {string | null | undefined} previous
 * @returns {string}
 */
export function pickActiveRole(roles, previous) {
  const list = Array.isArray(roles) ? roles.filter((r) => VALID.has(r)) : [];
  if (list.length === 0) return "member";
  const set = new Set(list);
  if (previous && set.has(previous)) return previous;
  const hit = ROLE_ORDER.find((r) => set.has(r));
  return hit ?? list[0];
}
