import { createNodeWalletClient } from "../src/node-client.ts";

async function main() {
  const client = createNodeWalletClient({ storageKey: "wallet_sdk_node_demo" });
  const addr = await client.createEmbeddedWallet("password1234");
  const sig = await client.signMessage("hello-sdk", { password: "password1234" });
  console.log("embedded address:", addr);
  console.log("signature prefix:", String(sig).slice(0, 18));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
