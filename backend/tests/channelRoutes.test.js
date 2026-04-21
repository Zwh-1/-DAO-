import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/server.js";
import { config } from "../src/config.js";
import { signJwt } from "../src/auth/jwt.js";

const USER1 = "0x1111222233334444555566667777888899990000";
const USER2 = "0x2222222233334444555566667777888899990000";
let token1;
let oracleToken;

describe("Channel API", () => {
    beforeAll(() => {
        config.rpcUrl = "";
        token1 = signJwt({ address: USER1, roles: ["member"] }, config.jwtSecret);
        oracleToken = signJwt({ address: USER1, roles: ["member", "oracle"] }, config.jwtSecret);
    });

    const channelId = "test-channel-01";

    it("should open a channel", async () => {
        const res = await request(app)
            .post("/v1/channel/open")
            .set("Authorization", `Bearer ${token1}`)
            .send({
                channelId,
                participant1: USER1,
                participant2: USER2,
                totalDeposit: "1000"
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.channelId).toBe(channelId);
        expect(res.body.balance1).toBe("1000");
        expect(res.body.balance2).toBe("0");
    });

    it("should get channel state", async () => {
        const res = await request(app)
            .get(`/v1/channel/${channelId}/state`);

        expect(res.status).toBe(200);
        expect(res.body.channelId).toBe(channelId);
        expect(res.body.currentNonce).toBe(0);
    });

    it("should update channel state", async () => {
        const res = await request(app)
            .post(`/v1/channel/${channelId}/update-state`)
            .set("Authorization", `Bearer ${token1}`)
            .send({
                balance1: "400",
                balance2: "600",
                nonce: 1,
                sig1: "0xsig1",
                sig2: "0xsig2" // normally validated when online, offline mode skips when channelAddress is null
            });

        expect(res.status).toBe(200);
        expect(res.body.currentNonce).toBe(1);
        expect(res.body.balance1).toBe("400");
        expect(res.body.balance2).toBe("600");
    });

    it("should list all channels", async () => {
        const res = await request(app)
            .get("/v1/channel/all")
            .set("Authorization", `Bearer ${oracleToken}`);

        expect(res.status).toBe(200);
        expect(res.body.channels).toBeInstanceOf(Array);
        expect(res.body.channels.length).toBeGreaterThan(0);
    });
});
