/**
 * Smoke tests for workbench-related routes (challenge list, oracle reports list, guardian blacklist).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/server.js";
import { config } from "../src/config.js";
import { signJwt } from "../src/auth/jwt.js";

const CHALLENGER_ADDR = "0xaa00112233445566778899001122334455667788";
const ORACLE_ADDR = "0xbb00112233445566778899001122334455667788";

describe("Workbench API smoke", () => {
    let challengerJwt;
    let oracleJwt;
    let prevAllowInsecureAdmin;

    beforeAll(() => {
        prevAllowInsecureAdmin = config.allowInsecureAdmin;
        config.allowInsecureAdmin = true;
        config.rpcUrl = "";
        challengerJwt = signJwt(
            { address: CHALLENGER_ADDR, roles: ["member", "challenger"] },
            config.jwtSecret,
        );
        oracleJwt = signJwt({ address: ORACLE_ADDR, roles: ["oracle"] }, config.jwtSecret);
    });

    afterAll(() => {
        config.allowInsecureAdmin = prevAllowInsecureAdmin;
    });

    it("GET /v1/challenge/list returns challenges array for challenger JWT", async () => {
        const res = await request(app)
            .get("/v1/challenge/list")
            .set("Authorization", `Bearer ${challengerJwt}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("challenges");
        expect(Array.isArray(res.body.challenges)).toBe(true);
    });

    it("GET /v1/challenge/list rejects without challenger role", async () => {
        const memberOnly = signJwt({ address: CHALLENGER_ADDR, roles: ["member"] }, config.jwtSecret);
        const res = await request(app).get("/v1/challenge/list").set("Authorization", `Bearer ${memberOnly}`);
        expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("GET /v1/oracle/reports returns paginated reports for oracle JWT", async () => {
        const res = await request(app).get("/v1/oracle/reports").set("Authorization", `Bearer ${oracleJwt}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("reports");
        expect(Array.isArray(res.body.reports)).toBe(true);
        expect(res.body).toHaveProperty("totalPages");
    });

    it("GET /v1/guardian/blacklist returns entries array", async () => {
        const headers = {};
        if (config.adminToken) {
            headers.Authorization = `Bearer ${config.adminToken}`;
        }
        const res = await request(app).get("/v1/guardian/blacklist").set(headers);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("entries");
        expect(Array.isArray(res.body.entries)).toBe(true);
    });
});
