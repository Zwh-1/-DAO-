const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ClaimVault", function () {
  it("rejects duplicate nullifier (anti-replay)", async function () {
    const ClaimVault = await ethers.getContractFactory("ClaimVault");
    const vault = await ClaimVault.deploy(200000);
    await vault.waitForDeployment();

    const nullifier = ethers.encodeBytes32String("n-1");
    await expect(vault.proposeClaim(nullifier, 1000, "ipfs://cid-a")).to.not.be
      .reverted;
    await expect(vault.proposeClaim(nullifier, 1000, "ipfs://cid-b")).to.be.reverted;
  });
});
