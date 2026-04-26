import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/server.js";
import { config } from "../src/config.js";

const ADMIN_TOKEN = "test-admin-secret";
const USER_ADDRESS = "0xaaaa222233334444555566667777888899990000";

function mockGroth16Proof() {
    return {
        protocol: "groth16",
        pi_a: ["1", "2", "3"],
        pi_b: [
            ["1", "2"],
            ["3", "4"],
        ],
        pi_c: ["5", "6", "7"],
    };
}

describe("Anonymous Claim API", () => {
    beforeAll(() => {
        config.rpcUrl = ""; // Force offline relay mode
        config.adminToken = ADMIN_TOKEN;
    });

    const nullifierHex = "0x" + BigInt(666).toString(16).padStart(64, "0");
    const amountWei = "1000000000000000000"; // 1 ETH

    it("should fund the anonymous claim contract (admin)", async () => {
        const res = await request(app)
            .post("/v1/anonymous-claim/fund")
            .set("x-admin-token", ADMIN_TOKEN)
            .send({ amountWei });

        // offline mode yields 503 for funding because it expects on-chain interactions
        expect(res.status).toBe(503);
    });

    it("should check if nullifier is used", async () => {
        const res = await request(app)
            .get(`/v1/anonymous-claim/nullifier/${nullifierHex}`);

        expect(res.status).toBe(200);
        expect(res.body.used).toBe(false);
    });

    it("should submit anonymous claim successfully", async () => {
        const mockProof = mockGroth16Proof();
        // [1]=nullifier, [3]=amount
        const pubSignals = [
            "0",
            BigInt(nullifierHex).toString(),
            "0",
            amountWei,
            "0",
            "0",
            "0"
        ];

        const res = await request(app)
            .post("/v1/anonymous-claim/claim")
            .send({
                recipient: USER_ADDRESS,
                amount: amountWei,
                nullifier: nullifierHex,
                proof: mockProof,
                pubSignals: pubSignals.map(String)
            });

        // In offline mode it should return 202
        expect(res.status).toBe(202);
        expect(res.body.success).toBe(true);
        expect(res.body.mode).toBe("offchain");
    });

    it("should reject duplicate anonymous claim", async () => {
        const mockProof = mockGroth16Proof();
        const pubSignals = [
            "0",
            BigInt(nullifierHex).toString(),
            "0",
            amountWei,
            "0",
            "0",
            "0"
        ];

        const res = await request(app)
            .post("/v1/anonymous-claim/claim")
            .send({
                recipient: USER_ADDRESS,
                amount: amountWei,
                nullifier: nullifierHex,
                proof: mockProof,
                pubSignals: pubSignals.map(String)
            });

        expect(res.status).toBe(409); // Duplicate Nullifier
    });

    it("should return merkle root", async () => {
        const res = await request(app).get("/v1/anonymous-claim/merkle-root");
        expect(res.status).toBe(200);
        expect(res.body.merkleRoot).toBeDefined();
    });

    it("should register commitment and return merkle proof", async () => {
        const commitment = "12345";
        const reg = await request(app)
            .post("/v1/anonymous-claim/register-commitment")
            .send({ commitment });
        expect(reg.status).toBe(201);
        expect(reg.body.leafIndex).toBe(0);

        const pr = await request(app)
            .post("/v1/anonymous-claim/merkle-proof")
            .send({ commitment });
        expect(pr.status).toBe(200);
        expect(pr.body.pathElements.length).toBe(20);
    });
});
