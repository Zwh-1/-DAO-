/**
 * Channel Model - 支付通道数据访问层
 * 
 * 职责：
 * - 封装支付通道的数据库操作
 * - 支持通道状态管理
 * - 支持链下支付状态通道
 */

import pool from '../db/pool.js';

/**
 * 创建支付通道
 * 
 * @param {Object} params - 参数对象
 * @param {string} params.initiator - 发起方地址
 * @param {string} params.receiver - 接收方地址
 * @param {number} params.balance - 初始余额
 * @param {number} params.timeout - 超时时间戳
 * @returns {Promise<Object>} 创建的通道记录
 */
export async function createChannel({ initiator, receiver, balance, timeout }) {
  const query = `
    INSERT INTO channels (
      initiator,
      receiver,
      balance,
      timeout_timestamp,
      state,
      created_at
    ) VALUES ($1, $2, $3, $4, 'open', NOW())
    RETURNING id, initiator, receiver, balance, timeout_timestamp, state
  `;
  
  const values = [initiator, receiver, balance, timeout];
  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * 更新通道状态
 * 
 * @param {number} channelId - 通道 ID
 * @param {number} newBalance - 新余额
 * @param {string} newState - 新状态（open/closed/disputed）
 * @returns {Promise<Object>} 更新后的记录
 */
export async function updateChannelState(channelId, newBalance, newState = 'open') {
  const query = `
    UPDATE channels
    SET balance = $2,
        state = $3,
        updated_at = NOW()
    WHERE id = $1
    RETURNING id, balance, state, updated_at
  `;
  
  const result = await pool.query(query, [channelId, newBalance, newState]);
  
  if (result.rows.length === 0) {
    throw new Error('[Model 验证] 通道不存在');
  }
  
  return result.rows[0];
}

/**
 * 查询通道信息
 * 
 * @param {number} channelId - 通道 ID
 * @returns {Promise<Object|null>} 通道记录或 null
 */
export async function getChannelById(channelId) {
  const query = `
    SELECT id, initiator, receiver, balance, timeout_timestamp, state, created_at
    FROM channels
    WHERE id = $1
    LIMIT 1
  `;
  
  const result = await pool.query(query, [channelId]);
  return result.rows[0] || null;
}

/**
 * 查询用户的所有通道
 * 
 * @param {string} userAddress - 用户地址
 * @returns {Promise<Array>} 通道列表
 */
export async function getChannelsByUser(userAddress) {
  const query = `
    SELECT id, initiator, receiver, balance, state, created_at
    FROM channels
    WHERE initiator = $1 OR receiver = $1
    ORDER BY created_at DESC
  `;
  
  const result = await pool.query(query, [userAddress]);
  return result.rows;
}

/**
 * 关闭通道
 * 
 * @param {number} channelId - 通道 ID
 * @returns {Promise<Object>} 更新后的记录
 */
export async function closeChannel(channelId) {
  const query = `
    UPDATE channels
    SET state = 'closed',
        closed_at = NOW()
    WHERE id = $1
    RETURNING id, state, closed_at
  `;
  
  const result = await pool.query(query, [channelId]);
  
  if (result.rows.length === 0) {
    throw new Error('[Model 验证] 通道不存在');
  }
  
  return result.rows[0];
}

/**
 * 统计通道数据
 * 
 * @returns {Promise<Object>} 统计数据
 */
export async function getChannelStats() {
  const query = `
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE state = 'open') as open,
      COUNT(*) FILTER (WHERE state = 'closed') as closed,
      COUNT(*) FILTER (WHERE state = 'disputed') as disputed,
      COALESCE(SUM(balance), 0) as total_balance
    FROM channels
  `;
  
  const result = await pool.query(query);
  const stats = result.rows[0];
  
  return {
    total: parseInt(stats.total, 10),
    open: parseInt(stats.open, 10),
    closed: parseInt(stats.closed, 10),
    disputed: parseInt(stats.disputed, 10),
    totalBalance: parseInt(stats.total_balance, 10),
  };
}
