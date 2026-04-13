import { describe, expect, it } from "vitest";
import { EmbeddedKeystore } from "../src/keystore/keystore";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    async read(key: string) {
      return data.get(key) ?? null;
    },
    async write(key: string, value: string) {
      data.set(key, value);
    }
  };
}

describe("EmbeddedKeystore accounts", () => {
  it("creates wallet and derives next account", async () => {
    const ks = new EmbeddedKeystore(memoryStorage(), "test_key");
    const first = await ks.create("pass123456");
    expect(first.startsWith("0x")).toBe(true);
    const second = await ks.deriveNextAccount("pass123456");
    expect(second.startsWith("0x")).toBe(true);
    expect(second.toLowerCase()).not.toBe(first.toLowerCase());
    const all = await ks.listAccounts("pass123456");
    expect(all.length).toBeGreaterThanOrEqual(2);
  });
});
