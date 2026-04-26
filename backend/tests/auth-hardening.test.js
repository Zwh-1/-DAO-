/**
 * 权限加固回归：RBAC、body 与 JWT 地址绑定
 */
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/server.js";
import { config } from "../src/config.js";
import { signJwt } from "../src/auth/jwt.js";

const ADDR = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OTHER = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("Auth hardening", () => {
    let memberJwt;
    let challengerJwt;
    let daoJwt;
    let arbJwt;

    beforeAll(() => {
        config.rpcUrl = "";
        memberJwt = signJwt({ address: ADDR, roles: ["member"] }, config.jwtSecret);
        challengerJwt = signJwt({ address: ADDR, roles: ["member", "challenger"] }, config.jwtSecret);
        daoJwt = signJwt({ address: ADDR, roles: ["member", "dao"] }, config.jwtSecret);
        arbJwt = signJwt({ address: ADDR, roles: ["member", "arbitrator"] }, config.jwtSecret);
    });

    it("POST /v1/challenge/init rejects challenger address mismatch", async () => {
        const res = await request(app)
            .post("/v1/challenge/init")
            .set("Authorization", `Bearer ${challengerJwt}`)
            .send({
                proposalId: "p1",
                reasonCode: "INVALID_EVIDENCE",
                evidenceSnapshot: "ipfs://QmTestEvidence",
                txHash: `0x${"11".repeat(32)}`,
                challenger: OTHER,
                stakeAmount: 150,
            });
        expect(res.status).toBe(403);
        expect(res.body.code).toBe(9003);
    });

    it("POST /v1/governance/propose returns 403 without dao role", async () => {
        const res = await request(app)
            .post("/v1/governance/propose")
            .set("Authorization", `Bearer ${memberJwt}`)
            .send({ description: "x" });
        expect(res.status).toBe(403);
    });

    it("POST /v1/governance/propose succeeds with dao role when system not paused", async () => {
        const res = await request(app)
            .post("/v1/governance/propose")
            .set("Authorization", `Bearer ${daoJwt}`)
            .send({ description: "auth-hardening proposal" });
        expect(res.status).toBe(201);
        expect(res.body.proposalId).toBeDefined();
    });

    it("GET /v1/member/arb/tasks/my requires arbitrator role", async () => {
        const res = await request(app)
            .get("/v1/member/arb/tasks/my")
            .set("Authorization", `Bearer ${memberJwt}`);
        expect(res.status).toBe(403);
    });

    it("GET /v1/member/arb/tasks/my returns 200 for arbitrator", async () => {
        const res = await request(app)
            .get("/v1/member/arb/tasks/my")
            .set("Authorization", `Bearer ${arbJwt}`);
        expect(res.status).toBe(200);
        expect(res.body.tasks).toBeInstanceOf(Array);
    });
});
