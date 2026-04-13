import { describe, expect, it } from "vitest";
import { decryptJson, encryptJson } from "../src/keystore/crypto";

describe("crypto", () => {
  it("encrypt/decrypt roundtrip", async () => {
    const src = { a: 1, b: "x" };
    const enc = await encryptJson(src, "password1234");
    const out = await decryptJson<typeof src>(enc, "password1234");
    expect(out).toEqual(src);
  });

  it("fails with wrong password", async () => {
    const enc = await encryptJson({ x: 1 }, "password1234");
    await expect(decryptJson(enc, "passwordxxxx")).rejects.toBeTruthy();
  });
});
