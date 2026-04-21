/**
 * 注入式钱包适配器（Injected Provider Adapter）
 * 
 * 适配对象：MetaMask、Rabby、Coinbase Wallet 等浏览器插件钱包
 * 
 * 安全说明：
 * - 不存储私钥，私钥由插件管理
 * - 所有签名/交易操作通过 window.ethereum.request 转发给插件
 * - 监听账户/网络变更事件，自动同步状态
 */

import type { Address, Hash } from 'viem'
import type { WalletClient, WalletRuntimeInfo } from './WalletProvider'

/**
 * 创建注入式钱包客户端
 * 
 * @param provider window.ethereum 对象（自动检测或手动指定）
 * @returns WalletClient 实例
 */
export function createInjectedWalletClient(provider?: any): WalletClient {
  // 1. 解析 Provider（自动检测或手动指定）
  const ethProvider = provider ?? resolveInjectedProvider()
  
  if (!ethProvider) {
    throw new Error('未检测到注入式钱包，请安装 MetaMask 或其他钱包插件')
  }

  // 2. 事件发射器实现（用于 accountsChanged/chainChanged）
  const eventHandlers = new Map<string, Set<Function>>()

  const emit = (event: string, ...args: any[]) => {
    const handlers = eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => handler(...args))
    }
  }

  // 3. 监听钱包事件（MetaMask 插件触发）
  ethProvider.on?.('accountsChanged', (accounts: string[]) => {
    console.log('[Injected] 账户变更:', accounts.map(formatAddress))
    emit('accountsChanged', accounts)
  })

  ethProvider.on?.('chainChanged', (chainId: string) => {
    console.log('[Injected] 网络变更:', chainId)
    emit('chainChanged', chainId)
    // 网络变更时刷新页面（MetaMask 推荐做法）
    // window.location.reload()
  })

  ethProvider.on?.('disconnect', () => {
    console.log('[Injected] 断开连接')
    emit('disconnect')
  })

  // 4. 实现 WalletProvider 接口
  const client: WalletClient = {
    /**
     * 获取运行时信息
     */
    async getRuntimeInfo(): Promise<WalletRuntimeInfo> {
      const accounts = await ethProvider.request({ method: 'eth_accounts' })
      const chainId = await ethProvider.request({ method: 'eth_chainId' })
      
      return {
        type: 'injected',
        isUnlocked: accounts.length > 0,
        chainId: parseInt(chainId, 16),
        accounts: accounts as Address[]
      }
    },

    /**
     * 请求账户授权（用户点击连接按钮时触发）
     * 
     * 安全说明：
     * - 必须用户主动触发（不能自动调用）
     * - MetaMask 会弹出确认窗口
     * - 用户拒绝时抛出 USER_REJECTED 错误
     */
    async requestAccounts(): Promise<Address[]> {
      try {
        const accounts = await ethProvider.request({
          method: 'eth_requestAccounts'
        })
        console.log('[Injected] 账户授权成功:', accounts.map(formatAddress))
        return accounts as Address[]
      } catch (error: any) {
        // 映射标准错误码
        if (error.code === 4001) {
          const err = new Error('用户拒绝了连接请求')
          err.name = 'USER_REJECTED'
          throw err
        }
        throw error
      }
    },

    /**
     * 签名消息（SIWE 登录用）
     * 
     * 隐私保护：
     * - 消息内容在 MetaMask 弹窗中显示
     * - 私钥在插件内部，不会暴露给本代码
     */
    async signMessage(message: string): Promise<Hash> {
      const from = (await client.getRuntimeInfo()).accounts[0]
      if (!from) {
        throw new Error('未连接钱包')
      }

      // 将 UTF-8 字符串转为 hex
      const hex = '0x' + Buffer.from(message, 'utf-8').toString('hex')
      
      const signature = await ethProvider.request({
        method: 'personal_sign',
        params: [hex, from]
      })

      console.log('[Injected] 消息签名成功')
      return signature as Hash
    },

    /**
     * 签名结构化数据（EIP-712）
     */
    async signTypedData(domain: any, types: any, message: any): Promise<Hash> {
      const from = (await client.getRuntimeInfo()).accounts[0]
      if (!from) {
        throw new Error('未连接钱包')
      }

      const signature = await ethProvider.request({
        method: 'eth_signTypedData_v4',
        params: [from, JSON.stringify({ domain, types, message })]
      })

      console.log('[Injected] EIP-712 签名成功')
      return signature as Hash
    },

    /**
     * 发送交易
     * 
     * 安全增强：
     * - MetaMask 会显示交易详情供用户确认
     * - 包括 Gas 费、目标地址、转账金额
     */
    async sendTransaction(tx: {
      to: Address
      from?: Address
      value?: bigint
      data?: `0x${string}`
    }): Promise<Hash> {
      const runtime = await client.getRuntimeInfo()
      const from = tx.from ?? runtime.accounts[0]
      
      if (!from) {
        throw new Error('未连接钱包')
      }

      const txHash = await ethProvider.request({
        method: 'eth_sendTransaction',
        params: [{
          from,
          to: tx.to,
          value: tx.value?.toString(16) ?? '0x0',
          data: tx.data ?? '0x'
        }]
      })

      console.log('[Injected] 交易已发送:', txHash)
      return txHash as Hash
    },

    /**
     * 切换网络
     * 
     * 注意：
     * - 网络不存在时会抛出错误
     * - 需要预先调用 addChain 添加网络
     */
    async switchChain(chainId: string): Promise<void> {
      try {
        await ethProvider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId }]
        })
        console.log('[Injected] 网络切换成功:', chainId)
      } catch (error: any) {
        // 网络不存在，需要先添加
        if (error.code === 4902) {
          throw new Error('该网络未配置，请先添加到钱包')
        }
        throw error
      }
    },

    /**
     * 断开连接
     * 
     * 注意：
     * - Injected 模式无法主动断开（私钥在插件）
     * - 只能清除本地状态，用户需在插件中手动断开
     */
    async disconnect(): Promise<void> {
      console.log('[Injected] 断开连接（本地状态）')
      // 不清除 MetaMask 的连接，只清除本地状态
      emit('disconnect')
    },

    /**
     * 订阅事件
     */
    on(event: string, handler: Function): void {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, new Set())
      }
      eventHandlers.get(event)!.add(handler)
    }
  }

  return client
}

/**
 * 检测注入式钱包
 * 
 * 检测顺序：
 * 1. window.ethereum (MetaMask 0.70+)
 * 2. window.web3 (旧版 MetaMask)
 * 
 * @returns Provider 对象或 undefined
 */
function resolveInjectedProvider(): any {
  // 检测 MetaMask 和其他 EIP-1193 兼容钱包
  if (typeof window !== 'undefined') {
    if ((window as any).ethereum) {
      return (window as any).ethereum
    }
    if ((window as any).web3) {
      return (window as any).web3.currentProvider
    }
  }
  return undefined
}

/**
 * 地址格式化（脱敏显示）
 */
function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
