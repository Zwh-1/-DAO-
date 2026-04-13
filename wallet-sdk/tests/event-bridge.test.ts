import { describe, expect, it } from "vitest";
import { InjectedProviderClient } from "../src/provider/injected";
import { attachInjectedEvents } from "../src/internal/event-bridge";

describe("event bridge", () => {
  it("dedupes same chainChanged event", async () => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const provider = {
      request: async () => [],
      on: (event: string, cb: (...args: unknown[]) => void) => handlers.set(event, cb),
      removeListener: (event: string) => handlers.delete(event)
    };
    const injected = new InjectedProviderClient(provider);
    const chains: string[] = [];
    const off = attachInjectedEvents(injected, { onChainChanged: (cid) => chains.push(cid) });

    handlers.get("chainChanged")?.("0x1");
    handlers.get("chainChanged")?.("0x1");
    handlers.get("chainChanged")?.("0x2");
    off();

    expect(chains).toEqual(["0x1", "0x2"]);
  });
});
