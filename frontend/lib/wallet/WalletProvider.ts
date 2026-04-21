/**
 * 钱包统一适配层 - WalletProvider 接口定义
 * 
 * 设计目标：
 * 1. 抽象 Injected（MetaMask）和 Embedded（内置钱包）的差异
 * 2. 业务层无需判断钱包类型，统一调用接口
 * 3. 支持未来扩展更多钱包类型（WalletConnect、Ledger 等）
 */

import type { Address, Hash, TypedDataDomain, TypedDataParameter } from 'viem'

/**
 * 钱包运行时信息
 */
export interface WalletRuntimeInfo {
  /** 钱包类型 */
  type: 'injected' | 'embedded' | 'walletconnect'
  /** 是否已解锁（内置钱包需要密码解锁） */
  isUnlocked: boolean
  /** 链 ID（十进制） */
  chainId: number
  /** 账户地址列表 */
  accounts: Address[]
}

/**
 * 钱包提供者统一接口
 * 
 * 核心设计原则：
 * - 所有方法返回 Promise，统一异步处理
 * - 错误统一抛出，由上层 mapWalletError 处理
 * - 敏感操作（签名、交易）必须经过用户确认
 */
export interface WalletProvider {
  /**
   * 获取钱包运行时信息
   * 
   * @returns 钱包状态、账户列表、链 ID 等
   */
  getRuntimeInfo(): Promise<WalletRuntimeInfo>

  /**
   * 请求用户授权账户访问
   * 
   * 安全说明：
   * - Injected 模式：调用 window.ethereum.request({ method: 'eth_requestAccounts' })
   * - Embedded 模式：检查本地解锁状态，未解锁则抛出 LOCKED 错误
   * 
   * @returns 用户授权的账户地址列表
   */
  requestAccounts(): Promise<Address[]>

  /**
   * 签名消息（SIWE 登录用）
   * 
   * 安全说明：
   * - 严禁签名未知来源的消息
   * - 必须在 UI 层显示待签名消息原文
   * - Embedded 模式需先解密私钥，签名后立即清零内存
   * 
   * @param message 待签名消息（UTF-8 字符串）
   * @returns 签名结果（0x 开头的 hex 字符串）
   */
  signMessage(message: string): Promise<Hash>

  /**
   * 签名结构化数据（EIP-712）
   * 
   * 应用场景：
   * - 链下订单签名（0x Protocol）
   * - NFT 授权签名
   * - DAO 投票签名
   * 
   * @param domain EIP-712 Domain 数据
   * @param types 类型定义
   * @param message 待签名数据
   * @returns 签名结果
   */
  signTypedData(
    domain: TypedDataDomain,
    types: Record<string, TypedDataParameter[]>,
    message: Record<string, any>
  ): Promise<Hash>

  /**
   * 发送交易
   * 
   * 安全增强：
   * - 增加交易预检（Pre-flight Check）
   * - 显示预估 Gas 费、目标地址、代币数量
   * - 用户确认后才会发送
   * 
   * @param tx 交易参数（to, from, value, data）
   * @returns 交易哈希
   */
  sendTransaction(tx: {
    to: Address
    from?: Address
    value?: bigint
    data?: `0x${string}`
  }): Promise<Hash>

  /**
   * 切换网络
   * 
   * 注意：
   * - Injected 模式：调用 wallet_switchEthereumChain
   * - Embedded 模式：内部状态切换
   * - 监听 chainChanged 事件，自动更新 UI
   * 
   * @param chainId 目标链 ID（十六进制，如 '0x1'）
   */
  switchChain(chainId: string): Promise<void>

  /**
   * 断开连接
   * 
   * 清理工作：
   * - 清除本地存储的会话信息
   * - 清零内存中的私钥（Embedded 模式）
   * - 重置状态机为 DISCONNECTED
   */
  disconnect(): Promise<void>

  /**
   * 创建内置钱包（仅 Embedded 模式）
   * 
   * 安全说明：
   * - 生成随机助记词并加密存储
   * - 助记词仅显示一次，用户需自行备份
   * - 密码用于加密私钥，不存储明文
   * 
   * @param password 用户密码
   * @returns 创建结果（包含助记词和地址）
   */
  createEmbeddedWallet?(password: string): Promise<{
    mnemonic: string
    address: Address
  }>

  /**
   * 导入助记词到内置钱包（仅 Embedded 模式）
   * 
   * 安全说明：
   * - 验证助记词有效性
   * - 加密存储派生的私钥
   * - 助记词使用后应立即从内存中清除
   * 
   * @param password 用户密码
   * @param mnemonic 助记词（12/15/18/21/24 个单词）
   * @returns 导入结果（包含地址）
   */
  importEmbeddedMnemonic?(password: string, mnemonic: string): Promise<{
    address: Address
  }>

  /**
   * 派生下一个账户（仅 Embedded 模式）
   * 
   * 应用场景：
   * - 从同一助记词派生多个账户
   * - 遵循 BIP-44 派生路径
   * 
   * @param password 用户密码
   * @returns 新派生的账户地址
   */
  deriveNextEmbeddedAccount?(password: string): Promise<Address>

   /**
    * 解锁内置钱包（仅 Embedded 模式）
    * 
    * 安全说明：
    * - 使用密码解密私钥到内存
    * - 解锁后保持会话直到锁定或页面刷新
    * 
    * @param password 用户密码
    */
   unlockWallet?(password: string): Promise<void>

   /**
    * 锁定内置钱包（仅 Embedded 模式）
    * 
    * 安全说明：
    * - 清零内存中的私钥
    * - 清除解密状态
    */
   lockWallet?(): Promise<void>
}

/**
 * 钱包事件订阅接口
 */
export interface WalletEventEmitter {
  /** 账户变更 */
  on(event: 'accountsChanged', handler: (accounts: Address[]) => void): void
  /** 网络变更 */
  on(event: 'chainChanged', handler: (chainId: string) => void): void
  /** 断开连接 */
  on(event: 'disconnect', handler: () => void): void
}

/**
 * 完整钱包客户端类型（Provider + Event Emitter）
 */
export type WalletClient = WalletProvider & WalletEventEmitter
