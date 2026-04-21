/**
 * 领取金额：ETH 字符串与 wei 互转（与 ethers v6 一致）
 */

import { formatUnits, parseUnits } from 'ethers';

const ETH_DECIMALS = 18;

export function parseEthInputToWei(ethString: string): string {
  const t = ethString.trim();
  if (!t) throw new Error('请输入领取金额');
  return parseUnits(t, ETH_DECIMALS).toString();
}

export function formatWeiToEth(weiString: string): string {
  return formatUnits(weiString, ETH_DECIMALS);
}
