import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { ClaimVaultABI as claimVaultAbi } from "../abis/index.js";
import { config, isOnchainRelayEnabled } from "../config.js";

let relay = null;

function getRelay() {
  if (relay) return relay;
  if (!isOnchainRelayEnabled()) return null;

  const provider = new JsonRpcProvider(config.rpcUrl);
  const wallet = new Wallet(config.relayerPrivateKey, provider);
  const contract = new Contract(config.claimVaultAddress, claimVaultAbi, wallet);
  relay = { provider, wallet, contract };
  return relay;
}

/**
 * 将 snarkjs Groth16 proof（pi_a / pi_b / pi_c）转为合约 calldata 形状。
 */
export function parseGroth16ProofForVault(proof) {
  if (!proof || typeof proof !== "object") {
    const err = new Error("proof must be an object");
    err.code = "INVALID_PROOF_SHAPE";
    throw err;
  }
  const { pi_a: piA, pi_b: piB, pi_c: piC } = proof;
  if (!Array.isArray(piA) || piA.length < 2 || !Array.isArray(piB) || piB.length < 2 || !Array.isArray(piC) || piC.length < 2) {
    const err = new Error("Invalid proof: need pi_a[0..1], pi_b rows, pi_c[0..1]");
    err.code = "INVALID_PROOF_SHAPE";
    throw err;
  }

  const a = [BigInt(piA[0]), BigInt(piA[1])];
  const row0 = piB[0];
  const row1 = piB[1];
  if (!Array.isArray(row0) || !Array.isArray(row1) || row0.length < 2 || row1.length < 2) {
    const err = new Error("Invalid proof.pi_b shape");
    err.code = "INVALID_PROOF_SHAPE";
    throw err;
  }
  const b = [
    [BigInt(row0[0]), BigInt(row0[1])],
    [BigInt(row1[0]), BigInt(row1[1])],
  ];
  const c = [BigInt(piC[0]), BigInt(piC[1])];
  return { a, b, c };
}

export async function submitClaimOnchain({ proof, publicSignals, signature }) {
  const instance = getRelay();
  if (!instance) {
    return {
      mode: "disabled",
      message: "On-chain relay disabled. Set RPC_URL/CLAIM_VAULT_ADDRESS/RELAYER_PRIVATE_KEY (use ClaimVaultZK address)."
    };
  }

  const { a, b, c } = parseGroth16ProofForVault(proof);
  if (!Array.isArray(publicSignals) || publicSignals.length !== 8) {
    const err = new Error("publicSignals must have exactly 8 entries (anti_sybil_verifier public outputs)");
    err.code = "INVALID_PUBLIC_SIGNALS";
    throw err;
  }

  if (typeof signature !== "string" || !signature.startsWith("0x") || signature.length !== 132) {
    const err = new Error("signature must be 0x-prefixed 65-byte hex (132 chars) for claimAirdrop EIP-712");
    err.code = "INVALID_CLAIM_SIGNATURE";
    throw err;
  }

  const pub = publicSignals.map((x) => BigInt(x));

  const tx = await instance.contract.claimAirdrop(a, b, c, pub, signature);
  const receipt = await tx.wait();
  return {
    mode: "enabled",
    txHash: tx.hash,
    blockNumber: receipt.blockNumber
  };
}
