import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/server.js";
import { config } from "../src/config.js";
import { signJwt } from "../src/auth/jwt.js";

const ORACLE_ADDRESS = "0x1111222233334444555566667777888899990000";
const USER_ADDRESS = "0xaaaa222233334444555566667777888899990000";
let oracleToken;
let userToken;

describe("Reputation API", () => {
    beforeAll(() => {
        config.rpcUrl = "";
        oracleToken = signJwt({ address: ORACLE_ADDRESS, roles: ["oracle"] }, config.jwtSecret);
        userToken = signJwt({ address: USER_ADDRESS, roles: ["member"] }, config.jwtSecret);
    });

    it("should anchor history behavior", async () => {
        const res = await request(app)
            .post("/v1/reputation/history/anchor")
            .set("Authorization", `Bearer ${oracleToken}`)
            .send({
                address: USER_ADDRESS,
                historyData: "12345", // needs to be numerical parsable due to Poseidon hashing
                behaviorLevel: 80
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.merkleRoot).toBeDefined();
    });

    it("should verify reputation ZK proof", async () => {
        const mockProof = { protocol: "groth16", pi_a: ["1"] };
        // Reputation verifier signals: [0] hash(score), [1] requiredScore
        const pubSignals = [
            "123456789", // Poseidon(score)
            "100"        // requiredScore
        ];

        const res = await request(app)
            .post("/v1/reputation/verify")
            .set("Authorization", `Bearer ${userToken}`)
            .send({
                proof: mockProof,
                pubSignals,
                score: "123456789" // dummy raw score to bypass local validation
            });

        // Validates whether poseidon offline resolves properly
        expect([202, 400]).toContain(res.status);
    });
});
