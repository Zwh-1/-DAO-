import { createNodeWalletClient } from "../src/node-client.ts";

async function main() {
  const client = createNodeWalletClient({ storageKey: "wallet_sdk_node_demo" });
  const { address, mnemonic } = await client.createEmbeddedWallet("password1234");
  const sig = await client.signMessage("hello-sdk", { password: "password1234" });
  console.log("embedded address:", address);
  console.log("mnemonic (show once):", mnemonic.split(/\s+/).length, "words");
  console.log("signature prefix:", String(sig).slice(0, 18));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
