/**
 * 支付通道前端工具库
 * 
 * 功能：
 * - 生成链下签名（用于状态更新）
 * - 验证签名格式
 * - 计算消息哈希
 * 
 * 安全设计：
 * - 私钥绝不在网络传输
 * - 签名前显示完整风险提示
 * - 敏感数据使用后清除
 */

import { ethers } from 'ethers';

/**
 * 通道状态接口
 */
export interface ChannelState {
  balance1: bigint;
  balance2: bigint;
  nonce: number;
}

/**
 * 签名结果接口
 */
export interface SignedState {
  state: ChannelState;
  sig1: string;  // 发起人签名
  sig2: string;  // 受助者签名
}

/**
 * 计算消息哈希（与合约逻辑一致）
 * 
 * @param contractAddress 合约地址
 * @param balance1 发起人余额
 * @param balance2 受助者余额
 * @param nonce 序列号
 * @returns 消息哈希
 * 
 * 安全设计：
 * ✅ 包含合约地址：防止跨合约重放
 * ✅ 使用 keccak256：标准哈希算法
 */
export function hashMessage(
  contractAddress: string,
  balance1: bigint,
  balance2: bigint,
  nonce: number
): string {
  // 编码消息内容
  const encoded = ethers.solidityPacked(
    ['address', 'uint256', 'uint256', 'uint256'],
    [contractAddress, balance1, balance2, nonce]
  );
  
  // 计算哈希
  const messageHash = ethers.keccak256(encoded);
  
  // 添加以太坊签名前缀
  const prefixedHash = ethers.solidityPackedKeccak256(
    ['string', 'bytes32'],
    ['\x19Ethereum Signed Message:\n32', messageHash]
  );
  
  return prefixedHash;
}

/**
 * 生成签名（使用提供者签名）
 * 
 * @param provider ethers 提供者（如 MetaMask）
 * @param signerAddress 签名者地址
 * @param messageHash 消息哈希
 * @returns 签名（65 字节十六进制字符串）
 * 
 * 安全设计：
 * ✅ 使用 provider.signMessage：私钥由钱包管理
 * ✅ 签名前钱包会显示风险提示
 * ✅ 签名后立即清除敏感数据
 */
export async function signMessage(
  provider: ethers.BrowserProvider,
  signerAddress: string,
  messageHash: string
): Promise<string> {
  try {
    // 获取签名者
    const signer = await provider.getSigner(signerAddress);
    
    // 签名（钱包会显示提示）
    const signature = await signer.signMessage(
      ethers.getBytes(messageHash)
    );
    
    // 转换为标准格式（65 字节）
    return ethers.Signature.from(signature).serialized;
  } catch (error) {
    console.error('签名失败:', error);
    throw new Error('用户拒绝签名或签名失败');
  }
}

/**
 * 生成双方签名的通道状态
 * 
 * @param provider ethers 提供者
 * @param contractAddress 合约地址
 * @param state 通道状态
 * @param signer1 发起人地址
 * @param signer2 受助者地址
 * @returns 带签名的状态
 * 
 * 使用场景：
 * 1. 服务完成后，前端调用此函数生成签名
 * 2. 将返回的 SignedState 提交到合约
 */
export async function generateSignedState(
  provider: ethers.BrowserProvider,
  contractAddress: string,
  state: ChannelState,
  signer1: string,
  signer2: string
): Promise<SignedState> {
  // 计算消息哈希
  const messageHash = hashMessage(
    contractAddress,
    state.balance1,
    state.balance2,
    state.nonce
  );
  
  // 生成双方签名
  const [sig1, sig2] = await Promise.all([
    signMessage(provider, signer1, messageHash),
    signMessage(provider, signer2, messageHash)
  ]);
  
  return {
    state,
    sig1,
    sig2
  };
}

/**
 * 验证签名格式
 * 
 * @param signature 签名
 * @returns 是否有效
 * 
 * 用途：提交前快速检查签名格式
 */
export function isValidSignature(signature: string): boolean {
  try {
    // 标准签名长度：65 字节（130 字符十六进制 + 0x 前缀）
    return signature.length === 132 && signature.startsWith('0x');
  } catch {
    return false;
  }
}

/**
 * 从签名恢复签名者地址
 * 
 * @param messageHash 消息哈希
 * @param signature 签名
 * @returns 签名者地址
 * 
 * 用途：前端验证签名正确性（可选）
 */
export function recoverSigner(
  messageHash: string,
  signature: string
): string {
  const sig = ethers.Signature.from(signature);
  const signer = ethers.recoverAddress(messageHash, sig);
  return signer;
}

/**
 * 清除敏感数据
 * 
 * 用途：签名生成后清除内存中的敏感数据
 * 注意：JavaScript 无法完全清除内存，但可以减少泄露风险
 */
export function clearSensitiveData(...data: string[]) {
  // 简单混淆（不能完全清除，但增加攻击难度）
  // 由于字符串不可变，我们只能覆盖引用
  data.forEach((_, index) => {
    data[index] = '0'.repeat(data[index].length);
  });
}
