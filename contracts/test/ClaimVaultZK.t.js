const { expect } = require("chai");
const { ethers } = require("hardhat");

/** 与 `anti_sybil_verifier.circom` public 输出顺序一致（11 项） */
function buildAntiSyPub({ nullifier, commitment, claimAmount, ts = BigInt(Math.floor(Date.now() / 1000)) }) {
  return [
    0n, // merkle_root
    commitment, // identity_commitment
    nullifier, // nullifier (uint256)
    0n, // min_level
    10n, // user_level
    1000n, // min_amount (align with vault)
    200000n, // max_amount
    claimAmount, // claim_amount
    ts, // claim_ts
    0n, // ts_start
    ts + 86400n // ts_end
  ];
}

describe("ClaimVaultZK", function () {
  async function setup() {
    const Mock = await ethers.getContractFactory("MockGroth16Verifier");
    const verifier = await Mock.deploy(true);
    await verifier.waitForDeployment();
    const Registry = await ethers.getContractFactory("IdentityRegistry");
    const registry = await Registry.deploy();
    await registry.waitForDeployment();
    const Vault = await ethers.getContractFactory("ClaimVaultZK");
    const vault = await Vault.deploy(await verifier.getAddress(), await registry.getAddress(), 1000, 200000);
    await vault.waitForDeployment();
    return { verifier, registry, vault };
  }

  it("rejects replay nullifier after successful claim", async function () {
    const { registry, vault } = await setup();
    const commitment = 12345n;
    await registry.registerCommitment(commitment, 10);

    const nullifier = ethers.toBigInt(ethers.id("n1"));
    const pub = buildAntiSyPub({ nullifier, commitment, claimAmount: 5000n });
    const tx = await vault.claimAirdrop([0, 0], [[0, 0], [0, 0]], [0, 0], pub);
    await tx.wait();

    await expect(vault.claimAirdrop([0, 0], [[0, 0], [0, 0]], [0, 0], pub)).to.be.revertedWithCustomError(
      vault,
      "NullifierAlreadyUsed"
    );
  });

  it("reverts when amount out of bounds on-chain", async function () {
    const { registry, vault } = await setup();
    const commitment = 999n;
    await registry.registerCommitment(commitment, 10);
    const nullifier = ethers.toBigInt(ethers.id("n2"));
    const pub = buildAntiSyPub({ nullifier, commitment, claimAmount: 100n });
    await expect(vault.claimAirdrop([0, 0], [[0, 0], [0, 0]], [0, 0], pub)).to.be.revertedWithCustomError(
      vault,
      "InvalidClaimAmount"
    );
  });
});
