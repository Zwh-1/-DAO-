/**
 * 生产闸门：无链中继时多签治理不得返回假成功
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import app from "../src/server.js";
import { config } from "../src/config.js";
import { signJwt } from "../src/auth/jwt.js";

const DAO_ADDR = "0x" + "d".repeat(40);

describe("Production gates", () => {
  let snap;

  beforeEach(() => {
    snap = {
      nodeEnv: config.nodeEnv,
      rpcUrl: config.rpcUrl,
      governanceAddress: config.governanceAddress,
      relayerPrivateKey: config.relayerPrivateKey,
    };
  });

  afterEach(() => {
    Object.assign(config, snap);
  });

  it("POST /v1/multisig/governance/queue/:id returns 503 in production without relay", async () => {
    config.nodeEnv = "production";
    config.rpcUrl = "";
    config.governanceAddress = "";
    config.relayerPrivateKey = "";

    const jwt = signJwt({ address: DAO_ADDR, roles: ["member", "dao"] }, config.jwtSecret);
    const res = await request(app)
      .post("/v1/multisig/governance/queue/99")
      .set("Authorization", `Bearer ${jwt}`);

    expect(res.status).toBe(503);
    expect(res.body.code).toBe(5043);
  });
});
