import { describe, expect, it } from "vitest";
import { WalletErrorCodes, WalletSdkError } from "../src/errors";

describe("WalletSdkError", () => {
  it("keeps code and message", () => {
    const e = new WalletSdkError(WalletErrorCodes.INVALID_PARAMS, "bad");
    expect(e.code).toBe("INVALID_PARAMS");
    expect(e.message).toBe("bad");
  });
});
