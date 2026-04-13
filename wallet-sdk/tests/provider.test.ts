import { describe, expect, it } from "vitest";
import { InjectedProviderClient } from "../src/provider/injected";

describe("InjectedProviderClient", () => {
  it("throws raw provider error", async () => {
    const client = new InjectedProviderClient({
      request: async () => {
        const e = new Error("reject") as Error & { code?: number };
        e.code = 4001;
        throw e;
      }
    });
    await expect(client.request("eth_requestAccounts")).rejects.toBeInstanceOf(Error);
  });
});
