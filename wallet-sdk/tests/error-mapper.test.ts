import { describe, expect, it } from "vitest";
import { mapWalletError } from "../src/internal/error-mapper";

describe("error mapper", () => {
  it("maps insufficient funds", () => {
    const e = mapWalletError({ message: "insufficient funds for gas * price + value" }, "TRANSACTION_FAILED", "x");
    expect(e.code).toBe("INSUFFICIENT_FUNDS");
  });
});
