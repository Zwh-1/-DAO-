/** 成员资料「加入时间」展示：过滤无效时间戳（如 1970） */

export function formatJoinedAtDisplay(raw: unknown): string {
  if (raw == null) return "—";
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return "—";
  const ms = n < 1e12 ? n * 1000 : n;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime()) || d.getUTCFullYear() < 2000) return "—";
  return d.toLocaleDateString("zh-CN");
}
