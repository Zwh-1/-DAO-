/**
 * 抗女巫参数推荐（占位）：可接历史统计与 Gas 数据。
 */
export function recommendStakingRatio(history) {
  const attacks = Number(history?.recentNullifierCollisions || 0);
  const base = 0.1;
  const bump = Math.min(0.25, attacks * 0.02);
  return { staking_ratio: Number((base + bump).toFixed(3)), note: "MVP 启发式，生产需结合链上指标" };
}
