/**
 * 合约交互 Hook（ethers v6）
 *
 * - 读：优先使用钱包 Provider；无钱包时使用 NEXT_PUBLIC_RPC_URL
 * - 写：需浏览器钱包扩展（window.ethereum）
 */

import { useState, useCallback } from 'react';
import { BrowserProvider, Contract, JsonRpcProvider, type Eip1193Provider } from 'ethers';
import { getContractABI, ContractName } from '../lib/contracts/abis';
import { getContractAddress } from '../lib/contracts/addresses';

interface ContractCallResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  execute: (...args: unknown[]) => Promise<T | null>;
}

function getInjectedEthereum(): Eip1193Provider | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { ethereum?: Eip1193Provider }).ethereum;
}

function getReadOnlyProvider(): BrowserProvider | JsonRpcProvider | null {
  const injected = getInjectedEthereum();
  if (injected) {
    return new BrowserProvider(injected);
  }
  const rpc = process.env.NEXT_PUBLIC_RPC_URL;
  if (rpc) {
    return new JsonRpcProvider(rpc);
  }
  return null;
}

async function getSigner() {
  const injected = getInjectedEthereum();
  if (!injected) {
    return null;
  }
  const provider = new BrowserProvider(injected);
  return provider.getSigner();
}

export function useContractRead<T>(
  contractName: ContractName,
  functionName: string,
  _args: unknown[] = []
): ContractCallResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (...callArgs: unknown[]): Promise<T | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const provider = getReadOnlyProvider();
        if (!provider) {
          throw new Error('无可用 RPC：请配置 NEXT_PUBLIC_RPC_URL 或连接钱包');
        }

        const address = getContractAddress(contractName);
        const abi = getContractABI(contractName);
        const contract = new Contract(address, abi, provider);
        const fn = contract.getFunction(functionName);
        const result = (await fn(...callArgs)) as T;
        setData(result);
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '合约调用失败';
        setError(new Error(errorMessage));
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [contractName, functionName]
  );

  return { data, isLoading, error, execute };
}

export function useContractWrite(
  contractName: ContractName,
  functionName: string
): ContractCallResult<unknown> & { reset: () => void } {
  const [data, setData] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (...args: unknown[]): Promise<unknown> => {
      setIsLoading(true);
      setError(null);

      try {
        const signer = await getSigner();
        if (!signer) {
          throw new Error('写入合约需要连接钱包');
        }

        const address = getContractAddress(contractName);
        const abi = getContractABI(contractName);
        const contract = new Contract(address, abi, signer);
        const fn = contract.getFunction(functionName);
        const tx = await fn(...args);
        const receipt = tx.wait ? await tx.wait() : tx;
        setData(receipt);
        return receipt;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '合约调用失败';
        setError(new Error(errorMessage));
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [contractName, functionName]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { data, isLoading, error, execute, reset };
}

export function useContractInfo(contractName: ContractName) {
  const address = getContractAddress(contractName);
  const abi = getContractABI(contractName);

  return {
    address,
    abi,
    name: contractName,
  };
}
