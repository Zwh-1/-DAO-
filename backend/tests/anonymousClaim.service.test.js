import { describe, it, expect } from "vitest";
import { normalizeGroth16ProofForSolidity, validateAnonymousClaimSignals } from "../src/services/claim/anonymousClaim.service.js";

describe("anonymousClaim.service", () => {
    it("normalizeGroth16ProofForSolidity accepts pi_* from snarkjs", () => {
        const p = normalizeGroth16ProofForSolidity({
            pi_a: ["1", "2"],
            pi_b: [
                ["3", "4"],
                ["5", "6"],
            ],
            pi_c: ["7", "8"],
        });
        expect(p.pA[0]).toBe(1n);
        expect(p.pB[1][1]).toBe(6n);
    });

    it("normalizeGroth16ProofForSolidity accepts pA/B/C alias", () => {
        const p = normalizeGroth16ProofForSolidity({
            pA: ["9", "10"],
            pB: [
                ["1", "2"],
                ["3", "4"],
            ],
            pC: ["5", "6"],
        });
        expect(p.pA[1]).toBe(10n);
    });

    it("validateAnonymousClaimSignals checks nullifier and amount", () => {
        const pubSignals = ["1", "2", "3", "100", "0", "0", "0"];
        const r = validateAnonymousClaimSignals(pubSignals, "100", "2");
        expect(r.ok).toBe(true);
        const bad = validateAnonymousClaimSignals(pubSignals, "101", "2");
        expect(bad.ok).toBe(false);
    });
});
