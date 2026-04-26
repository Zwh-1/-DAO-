import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/server.js";
import { signJwt } from "../src/auth/jwt.js";
import { config } from "../src/config.js";
import { computeIdentityCommitment, computeMerkleLeaf } from "../src/services/identity/poseidon.service.js";

const ORACLE_ADDRESS = "0x1111222233334444555566667777888899990000";
const USER_ADDRESS = "0xaaaa222233334444555566667777888899990000";
let oracleToken;

describe("Identity Routes API", () => {
    beforeAll(async () => {
        // 强制离线模式测试
        config.rpcUrl = "";

        oracleToken = signJwt({
            address: ORACLE_ADDRESS,
            roles: ["oracle", "member"]
        }, Object.assign(config, { jwtSecret: "test-secret" }).jwtSecret);
    });

    const socialIdHash = "123456789";
    const secret = "987654321";
    const trapdoor = "1122334455";
    let commitmentStr;
    let sbtTokenId;

    it("should calculate commitment successfully", async () => {
        commitmentStr = await computeIdentityCommitment(socialIdHash, secret, trapdoor);
        expect(commitmentStr).toBeDefined();
        expect(typeof commitmentStr).toBe("string");
    });

    it("should register identity commitment (Oracle required)", async () => {
        const res = await request(app)
            .post("/v1/identity/register")
            .set("Authorization", `Bearer ${oracleToken}`)
            .send({
                commitment: commitmentStr,
                level: 2
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.level).toBe(2);
        expect(res.body.merkleRoot).toBeDefined();
    });

    it("should fail to register identity without Oracle role", async () => {
        const userToken = signJwt({ address: USER_ADDRESS, roles: ["member"] }, config.jwtSecret);
        const res = await request(app)
            .post("/v1/identity/register")
            .set("Authorization", `Bearer ${userToken}`)
            .send({
                commitment: "123123123",
                level: 1
            });

        expect(res.status).toBe(403);
    });

    it("should get commitment status", async () => {
        const res = await request(app)
            .get(`/v1/identity/commitment/${commitmentStr}`);

        expect(res.status).toBe(200);
        expect(res.body.registered).toBe(true);
        expect(res.body.level).toBe(2);
        expect(res.body.blacklisted).toBe(false);
    });

    it("should mint SBT for registered commitment", async () => {
        const res = await request(app)
            .post("/v1/identity/sbt/mint")
            .set("Authorization", `Bearer ${oracleToken}`)
            .send({
                address: USER_ADDRESS,
                commitment: commitmentStr
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.tokenId).toBeDefined();
        sbtTokenId = res.body.tokenId;
    });

    it("should update SBT credit score", async () => {
        const res = await request(app)
            .post("/v1/identity/sbt/update-credit")
            .set("Authorization", `Bearer ${oracleToken}`)
            .send({
                tokenId: sbtTokenId,
                creditScore: 800
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.creditScore).toBe(800);
    });

    it("should retrieve SBT info", async () => {
        const res = await request(app)
            .get(`/v1/identity/sbt/${USER_ADDRESS}`);

        expect(res.status).toBe(200);
        expect(res.body.sbtExists).toBe(true);
        expect(res.body.creditScore).toBe(800);
        expect(res.body.level).toBe(2);
    });
});
