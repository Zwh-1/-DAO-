const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("IdentityCommitmentZK + AntiSybilClaimZK", function () {
  it("registers commitment root with mock verifier", async function () {
    const MockV = await ethers.getContractFactory("MockIdentityCommitmentGroth16Verifier");
    const mock = await MockV.deploy(true);
    await mock.waitForDeployment();
    const Zk = await ethers.getContractFactory("IdentityCommitmentZK");
    const zk = await Zk.deploy(await mock.getAddress());
    await zk.waitForDeployment();

    const pub = [1n, 2n];
    await zk.registerWithProof([0n, 0n], [[0n, 0n], [0n, 0n]], [0n, 0n], pub);
    expect(await zk.commitmentRegistered(2n)).to.equal(true);
    expect(await zk.socialIdHashUsed(1n)).to.equal(true);

    await expect(
      zk.registerWithProof([0n, 0n], [[0n, 0n], [0n, 0n]], [0n, 0n], pub)
    ).to.be.revertedWithCustomError(zk, "CommitmentAlreadyRegistered");
  });

  it("spends nullifier with mock anti_sybil_claim verifier", async function () {
    const MockV = await ethers.getContractFactory("MockAntiSybilClaimGroth16Verifier");
    const mock = await MockV.deploy(true);
    await mock.waitForDeployment();
    const Zk = await ethers.getContractFactory("AntiSybilClaimZK");
    const zk = await Zk.deploy(await mock.getAddress());
    await zk.waitForDeployment();

    const pub = [7n, 100n, 200n];
    await zk.spendWithProof([0n, 0n], [[0n, 0n], [0n, 0n]], [0n, 0n], pub);
    expect(await zk.nullifierSpent(7n)).to.equal(true);

    await expect(
      zk.spendWithProof([0n, 0n], [[0n, 0n], [0n, 0n]], [0n, 0n], pub)
    ).to.be.revertedWithCustomError(zk, "NullifierAlreadySpent");
  });

  it("reverts when mock verifier returns false", async function () {
    const MockV = await ethers.getContractFactory("MockIdentityCommitmentGroth16Verifier");
    const mock = await MockV.deploy(false);
    await mock.waitForDeployment();
    const Zk = await ethers.getContractFactory("IdentityCommitmentZK");
    const zk = await Zk.deploy(await mock.getAddress());
    await zk.waitForDeployment();

    await expect(
      zk.registerWithProof([0n, 0n], [[0n, 0n], [0n, 0n]], [0n, 0n], [1n, 2n])
    ).to.be.revertedWithCustomError(zk, "InvalidProof");
  });
});
