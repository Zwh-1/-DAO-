const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  VAULT_TEST_MERKLE_ROOT,
  VAULT_TEST_PARAMETER_HASH,
  VAULT_TEST_PROJECT_ID,
  buildAntiSybilPubSignals,
  signVaultClaimTypedData,
} = require("./helpers/vaultClaimTestUtil");

describe("ClaimVaultZK", function () {
  async function setup() {
    const Mock = await ethers.getContractFactory("MockAntiSybilVerifier");
    const verifier = await Mock.deploy(true);
    await verifier.waitForDeployment();
    const Registry = await ethers.getContractFactory("IdentityRegistry");
    const registry = await Registry.deploy();
    await registry.waitForDeployment();
    const Vault = await ethers.getContractFactory("ClaimVaultZK");
    const vault = await Vault.deploy(
      await verifier.getAddress(),
      await registry.getAddress(),
      1000,
      200000,
      VAULT_TEST_MERKLE_ROOT,
      VAULT_TEST_PARAMETER_HASH,
      VAULT_TEST_PROJECT_ID
    );
    await vault.waitForDeployment();
    return { verifier, registry, vault };
  }

  async function claimWithSig(vault, signer, pub) {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const sig = await signVaultClaimTypedData(
      signer,
      await vault.getAddress(),
      chainId,
      pub[2],
      pub[1],
      VAULT_TEST_PROJECT_ID
    );
    return vault.connect(signer).claimAirdrop([0, 0], [[0, 0], [0, 0]], [0, 0], pub, sig);
  }

  it("rejects replay nullifier after successful claim", async function () {
    const { registry, vault } = await setup();
    const claimant = (await ethers.getSigners())[0];
    await vault.deposit({ value: ethers.parseEther("1.0") });
    const commitment = 12345n;
    await registry.registerCommitment(commitment, 10);

    const nullifier = ethers.toBigInt(ethers.id("n1"));
    const pub = buildAntiSybilPubSignals({ nullifier, commitment, claimAmount: 5000n });
    const tx = await claimWithSig(vault, claimant, pub);
    await tx.wait();

    await expect(claimWithSig(vault, claimant, pub)).to.be.revertedWithCustomError(vault, "NullifierAlreadyUsed");
  });

  it("reverts when amount out of bounds on-chain", async function () {
    const { registry, vault } = await setup();
    const claimant = (await ethers.getSigners())[0];
    await vault.deposit({ value: ethers.parseEther("1.0") });
    const commitment = 999n;
    await registry.registerCommitment(commitment, 10);
    const nullifier = ethers.toBigInt(ethers.id("n2"));
    const pub = buildAntiSybilPubSignals({ nullifier, commitment, claimAmount: 100n });
    await expect(claimWithSig(vault, claimant, pub)).to.be.revertedWithCustomError(vault, "InvalidClaimAmount");
  });
});
