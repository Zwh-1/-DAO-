import { describe, expect, it } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { createNodeWalletClient } from "../src/node-client";
import { WalletSdkError } from "../src/errors";

describe("node storage", () => {
  it("throws STORAGE_CORRUPTED on malformed file", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "wallet-sdk-"));
    const filePath = path.join(dir, "keystore.json");
    await fs.writeFile(filePath, "{not json", "utf8");
    const client = createNodeWalletClient({ filePath, storageKey: "x" });
    await expect(client.signMessage("hello", { password: "pass123456" })).rejects.toBeInstanceOf(WalletSdkError);
  });
});
