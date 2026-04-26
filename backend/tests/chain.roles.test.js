import { describe, it, expect } from "vitest";
import { mergeRolesFromChainAndMemory } from "../src/chain/roles.js";

describe("mergeRolesFromChainAndMemory", () => {
  it("合并去重并保留预设顺序", () => {
    const out = mergeRolesFromChainAndMemory(
      ["member", "oracle"],
      ["member", "dao", "arbitrator"]
    );
    expect(out).toEqual(["member", "arbitrator", "oracle", "dao"]);
  });
});
