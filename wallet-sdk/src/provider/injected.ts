import type { Eip1193Provider } from "../public/types";
import { WalletErrorCodes, WalletSdkError } from "../errors";

export class InjectedProviderClient {
  constructor(private readonly provider: Eip1193Provider | null) {}

  hasProvider() {
    return Boolean(this.provider?.request);
  }

  private ensureProvider(): Eip1193Provider {
    if (!this.provider?.request) {
      throw new WalletSdkError(WalletErrorCodes.PROVIDER_NOT_FOUND, "No injected wallet provider found");
    }
    return this.provider;
  }

  async request(method: string, params?: unknown[]) {
    const p = this.ensureProvider();
    return await p.request({ method, params });
  }

  async requestAccounts(): Promise<string[]> {
    return (await this.request("eth_requestAccounts")) as string[];
  }

  async signMessage(address: string, message: string): Promise<string> {
    return (await this.request("personal_sign", [message, address])) as string;
  }

  async signTypedDataV4(address: string, typedData: string): Promise<string> {
    return (await this.request("eth_signTypedData_v4", [address, typedData])) as string;
  }

  async sendTransaction(tx: Record<string, unknown>): Promise<string> {
    return (await this.request("eth_sendTransaction", [tx])) as string;
  }

  async switchChain(chainIdHex: string): Promise<void> {
    await this.request("wallet_switchEthereumChain", [{ chainId: chainIdHex }]);
  }

  async addChain(params: Record<string, unknown>): Promise<void> {
    await this.request("wallet_addEthereumChain", [params]);
  }

  on(event: string, cb: (...args: unknown[]) => void): void {
    const p = this.ensureProvider();
    p.on?.(event, cb);
  }

  off(event: string, cb: (...args: unknown[]) => void): void {
    const p = this.ensureProvider();
    p.removeListener?.(event, cb);
  }
}
