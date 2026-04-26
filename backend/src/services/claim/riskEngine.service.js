/**
 * 抗女巫参数推荐 — 多维度链上行为分析
 *
 * 维度：
 *   1. Nullifier 碰撞频率
 *   2. 地址 Nonce（交易总数）
 *   3. 账户账龄（Account Age）
 *   4. Gas 消耗总量
 *   5. 是否为合约地址（CA）
 *
 * 策略：
 *   - 基础质押比率 0.10
 *   - Nullifier 碰撞加权 +0.02/次，上限 +0.20
 *   - 高 Nonce（>50）降低比率 −0.02
 *   - 账户老于 90 天 降低比率 −0.02
 *   - Gas 累计消耗 > 0.1 ETH 降低比率 −0.02
 *   - 合约地址（非多签）直接标高风险 +0.15
 *   - 最终 clamp 至 [0.05, 0.35]
 */

import { ethers } from "ethers";
import { config } from "../../config.js";

/**
 * 查询地址的链上画像
 * @param {string} address
 * @returns {Promise<{ nonce: number, isContract: boolean, accountAgeDays: number|null, gasSpentWei: bigint|null }>}
 */
async function fetchOnChainProfile(address) {
  if (!config.rpcUrl) {
    return { nonce: 0, isContract: false, accountAgeDays: null, gasSpentWei: null };
  }

  const provider = new ethers.JsonRpcProvider(config.rpcUrl);

  // 并行请求 nonce + code
  const [nonce, code] = await Promise.all([
    provider.getTransactionCount(address, "latest").catch(() => 0),
    provider.getCode(address).catch(() => "0x"),
  ]);

  const isContract = code !== "0x" && code.length > 2;

  // 估算账户账龄：取最早区块（简化：取当前区块号 - nonce 的粗略估计）
  let accountAgeDays = null;
  let gasSpentWei = null;

  try {
    const currentBlock = await provider.getBlock("latest");
    if (currentBlock && nonce > 0) {
      // 粗略估算：平均出块 12 秒，账龄 ≈ (nonce 对应的区块跨度) * 12 / 86400
      // 更精确的方式需要索引服务，此处用 nonce * 平均间隔估算
      const avgBlocksPerDay = 86400 / 12;
      accountAgeDays = Math.floor(nonce / Math.max(1, avgBlocksPerDay / 10));
      // 若 nonce 很大但不知道确切起始区块，至少按 nonce 推测
      accountAgeDays = Math.max(accountAgeDays, Math.floor(nonce / 20));
    }

    // 估算 Gas 累计消耗（最近 N 笔交易采样）
    // 查询最近 5 笔交易的 gasUsed * gasPrice 作为采样
    const latestBlock = currentBlock?.number ?? 0;
    const sampleRange = Math.min(500, latestBlock);
    if (sampleRange > 0 && nonce > 0) {
      const sampleSize = Math.min(5, nonce);
      let totalGas = BigInt(0);
      // 取最近区块中该地址的交易（简化：扫描最近 sampleRange 个区块的日志）
      // 更高效的方式是通过 Indexer API，此处使用 provider 估算
      for (let i = latestBlock; i > latestBlock - sampleRange && totalGas === BigInt(0); i -= 100) {
        try {
          const block = await provider.getBlock(i, true);
          if (block?.prefetchedTransactions) {
            for (const tx of block.prefetchedTransactions) {
              if (tx.from?.toLowerCase() === address.toLowerCase()) {
                const receipt = await provider.getTransactionReceipt(tx.hash);
                if (receipt) {
                  totalGas += receipt.gasUsed * receipt.gasPrice;
                }
              }
            }
          }
        } catch {
          break;
        }
      }
      gasSpentWei = totalGas;
    }
  } catch (e) {
    console.warn("[riskEngine] 链上画像查询部分失败:", e.message);
  }

  return { nonce, isContract, accountAgeDays, gasSpentWei };
}

/**
 * 计算质押比率推荐
 * @param {{ recentNullifierCollisions?: number, address?: string }} history
 * @returns {Promise<{ staking_ratio: number, risk_level: string, factors: object }>}
 */
export async function recommendStakingRatio(history) {
  const attacks = Number(history?.recentNullifierCollisions || 0);
  const address = history?.address || "";

  // 基础比率
  let ratio = 0.10;

  // 因子追踪
  const factors = {
    base: 0.10,
    nullifierBump: 0,
    nonceBenefit: 0,
    ageBenefit: 0,
    gasBenefit: 0,
    contractPenalty: 0,
  };

  // 1. Nullifier 碰撞加权
  factors.nullifierBump = Math.min(0.20, attacks * 0.02);
  ratio += factors.nullifierBump;

  // 2-5. 链上画像（仅在有地址时查询）
  let onChain = { nonce: 0, isContract: false, accountAgeDays: null, gasSpentWei: null };
  if (address && config.rpcUrl) {
    try {
      onChain = await fetchOnChainProfile(address);
    } catch (e) {
      console.warn("[riskEngine] fetchOnChainProfile failed:", e.message);
    }
  }

  // 2. 高 Nonce 降低比率（证明非新号）
  if (onChain.nonce > 50) {
    factors.nonceBenefit = -0.02;
    ratio += factors.nonceBenefit;
  }

  // 3. 账户账龄 > 90 天 降低比率
  if (onChain.accountAgeDays != null && onChain.accountAgeDays > 90) {
    factors.ageBenefit = -0.02;
    ratio += factors.ageBenefit;
  }

  // 4. Gas 消耗 > 0.1 ETH 降低比率（证明有真实交互）
  if (onChain.gasSpentWei != null && onChain.gasSpentWei > ethers.parseEther("0.1")) {
    factors.gasBenefit = -0.02;
    ratio += factors.gasBenefit;
  }

  // 5. 合约地址标高风险
  if (onChain.isContract) {
    factors.contractPenalty = 0.15;
    ratio += factors.contractPenalty;
  }

  // Clamp
  ratio = Math.min(0.35, Math.max(0.05, ratio));

  // 风险等级
  let risk_level = "low";
  if (ratio > 0.25) risk_level = "high";
  else if (ratio > 0.15) risk_level = "medium";

  return {
    staking_ratio: Number(ratio.toFixed(3)),
    risk_level,
    factors,
    onChainProfile: {
      nonce: onChain.nonce,
      isContract: onChain.isContract,
      accountAgeDays: onChain.accountAgeDays,
      estimatedGasSpent: onChain.gasSpentWei != null
        ? ethers.formatEther(onChain.gasSpentWei) + " ETH"
        : null,
    },
  };
}
