import { describe, expect, it } from "vitest";
import { normalizeTxRequest } from "../src/internal/tx";
import { WalletSdkError } from "../src/errors";

describe("TxRequestV1 normalize", () => {
  it("normalizes minimal tx fields", () => {
    const tx = normalizeTxRequest({ to: "0xabc", valueWei: "1" });
    expect(tx.to).toBe("0xabc");
    expect(tx.valueWei).toBe("1");
  });

  it("throws on missing required fields", () => {
    expect(() => normalizeTxRequest({})).toThrow(WalletSdkError);
  });
});
