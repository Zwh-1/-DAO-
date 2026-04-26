/**
 * 成员声誉计算服务
 *
 * 职责：
 *   - 根据链上行为与平台记录计算声誉评分
 *   - 返回声誉趋势数据（最近 N 个时间窗口的评分快照）
 *
 * 数据源：
 *   - member_activity 表 / 内存兜底
 *   - claim_records 表 / 内存兜底
 *   - nullifier_registry 表 / 内存兜底
 */

import { getPool } from "../../db/pool.js";
import { queryActivities } from "./activityWatcher.service.js";

/**
 * 计算声誉分数（0-1000）
 *
 * 维度：
 *   - 基础分 300
 *   - 活动频率：每条活动 +5，上限 200
 *   - 成功互助：每次 +20，上限 300
 *   - 参与天数：每天 +2，上限 100
 *   - 身份注册：+50
 *   - 治理参与：每次投票/提案 +10，上限 100
 *   - 惩罚：被挑战成功 -50
 *
 * @param {string} address
 * @returns {Promise<{ score: number, breakdown: Record<string, number> }>}
 */
export async function calculateReputation(address) {
  const key = String(address).toLowerCase();
  const { activities, total } = await queryActivities(key, { page: 1, limit: 200 });

  let baseScore = 300;
  let activityBonus = 0;
  let claimBonus = 0;
  let dayBonus = 0;
  let identityBonus = 0;
  let govBonus = 0;

  // 活动频率
  activityBonus = Math.min(200, total * 5);

  // 按类型统计
  const daysSet = new Set();
  for (const a of activities) {
    const day = Math.floor(a.timestamp / 86400);
    daysSet.add(day);

    switch (a.action) {
      case "CLAIM_SUBMIT":
      case "CLAIM_APPROVED":
        claimBonus = Math.min(300, claimBonus + 20);
        break;
      case "MEMBER_REGISTER":
        identityBonus = 50;
        break;
      case "GOV_PROPOSE":
      case "GOV_VOTE":
        govBonus = Math.min(100, govBonus + 10);
        break;
    }
  }

  // 参与天数
  dayBonus = Math.min(100, daysSet.size * 2);

  const score = Math.min(
    1000,
    Math.max(0, baseScore + activityBonus + claimBonus + dayBonus + identityBonus + govBonus),
  );

  return {
    score,
    breakdown: {
      base: baseScore,
      activity: activityBonus,
      claim: claimBonus,
      days: dayBonus,
      identity: identityBonus,
      governance: govBonus,
    },
  };
}

/**
 * 生成声誉趋势数据（最近 N 个窗口）
 *
 * 实现方式：将活动按时间窗口分桶，累计当时分数
 *
 * @param {string} address
 * @param {{ windows?: number, windowDays?: number }} opts
 * @returns {Promise<{ trend: { date: string, score: number }[] }>}
 */
export async function getReputationTrend(address, opts = {}) {
  const windowCount = Math.min(30, Math.max(1, Number(opts.windows) || 7));
  const windowDays = Math.min(30, Math.max(1, Number(opts.windowDays) || 7));

  const key = String(address).toLowerCase();
  const { activities } = await queryActivities(key, { page: 1, limit: 500 });

  const nowTs = Math.floor(Date.now() / 1000);
  const windowSec = windowDays * 86400;
  const trend = [];

  for (let i = windowCount - 1; i >= 0; i--) {
    const windowEnd = nowTs - i * windowSec;
    const windowStart = windowEnd - windowSec;

    // 计算窗口内的活动统计
    const windowActivities = activities.filter(
      (a) => a.timestamp >= windowStart && a.timestamp < windowEnd,
    );

    let score = 300; // 基础分
    const daysSet = new Set();
    let claimCount = 0;
    let govCount = 0;
    let hasIdentity = false;

    for (const a of windowActivities) {
      daysSet.add(Math.floor(a.timestamp / 86400));
      if (a.action === "CLAIM_SUBMIT" || a.action === "CLAIM_APPROVED") claimCount++;
      if (a.action === "GOV_PROPOSE" || a.action === "GOV_VOTE") govCount++;
      if (a.action === "MEMBER_REGISTER") hasIdentity = true;
    }

    score += Math.min(200, windowActivities.length * 5);
    score += Math.min(300, claimCount * 20);
    score += Math.min(100, daysSet.size * 2);
    score += hasIdentity ? 50 : 0;
    score += Math.min(100, govCount * 10);
    score = Math.min(1000, Math.max(0, score));

    const d = new Date(windowEnd * 1000);
    trend.push({
      date: d.toISOString().slice(0, 10),
      score,
    });
  }

  return { trend };
}
