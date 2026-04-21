const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SBT + OracleManager + Governance", function () {
  let owner, alice, bob, charlie;
  let registry, sbt, oracle, governance;

  const ZERO_BYTES32 = ethers.ZeroHash;

  before(async () => {
    [owner, alice, bob, charlie] = await ethers.getSigners();

    // Deploy IdentityRegistry
    const Registry = await ethers.getContractFactory("IdentityRegistry");
    registry = await Registry.deploy();
    await registry.waitForDeployment();

    // Register a commitment（仅 owner 可写）
    const commitment = 12345n;
    await registry.registerCommitment(commitment, 1);

    // Deploy SBT
    const SBT = await ethers.getContractFactory("SBT");
    sbt = await SBT.deploy(await registry.getAddress());
    await sbt.waitForDeployment();

    // Deploy OracleManager
    const Oracle = await ethers.getContractFactory("OracleManager");
    oracle = await Oracle.deploy();
    await oracle.waitForDeployment();

    // Deploy Governance
    const Gov = await ethers.getContractFactory("Governance");
    governance = await Gov.deploy(await sbt.getAddress());
    await governance.waitForDeployment();
  });

  // ── SBT 测试 ─────────────────────────────────────────────────────────────

  describe("SBT", function () {
    it("should mint SBT for registered commitment", async () => {
      const commitment = 12345n;
      await sbt.connect(owner).mint(alice.address, commitment);
      const tid = await sbt.tokenOf(alice.address);
      expect(tid).to.be.gt(0n);
    });

    it("should be permanently locked (ERC-5192)", async () => {
      const tid = await sbt.tokenOf(alice.address);
      expect(await sbt.locked(tid)).to.equal(true);
    });

    it("should reject double minting", async () => {
      const commitment = 12345n;
      await expect(sbt.connect(owner).mint(alice.address, commitment))
        .to.be.revertedWithCustomError(sbt, "AlreadyMinted");
    });

    it("should reject minting for unregistered commitment", async () => {
      const fakeCommitment = 99999n;
      await expect(sbt.connect(owner).mint(bob.address, fakeCommitment))
        .to.be.revertedWithCustomError(sbt, "NotRegistered");
    });

    it("should not be claim eligible within waiting period", async () => {
      expect(await sbt.isClaimEligible(alice.address)).to.equal(false);
    });

    it("should update credit score", async () => {
      const tid = await sbt.tokenOf(alice.address);
      await sbt.connect(owner).updateCredit(tid, 800);
      const data = await sbt.tokenData(tid);
      expect(data.creditScore).to.equal(800);
    });

    it("should blacklist holder", async () => {
      // Register another commitment for charlie test
      const commitment2 = 67890n;
      await registry.register(commitment2, charlie.address);
      await sbt.connect(owner).mint(charlie.address, commitment2);

      await sbt.connect(owner).banHolder(charlie.address, "sybil detected");
      expect(await sbt.isClaimEligible(charlie.address)).to.equal(false);
    });
  });

  // ── OracleManager 测试 ────────────────────────────────────────────────────

  describe("OracleManager", function () {
    let oracle1, oracle2, oracle3;

    before(async () => {
      [,, oracle1, oracle2, oracle3] = await ethers.getSigners();
      await oracle.connect(owner).addOracle(oracle1.address);
      await oracle.connect(owner).addOracle(oracle2.address);
      await oracle.connect(owner).addOracle(oracle3.address);
    });

    it("should add oracles", async () => {
      expect(await oracle.oracleCount()).to.equal(3n);
      expect(await oracle.isOracle(oracle1.address)).to.equal(true);
    });

    it("oracle should submit report", async () => {
      const reportId = ethers.id("report-001");
      const claimId  = ethers.id("claim-001");
      const dataHash = ethers.id("data-hash-001");

      await oracle.connect(oracle1).submitReport(reportId, claimId, dataHash);
      const status = await oracle.reportStatus(reportId);
      expect(status.signatures).to.equal(1);
      expect(status.finalized).to.equal(false);
    });

    it("second oracle signature should finalize (MIN_QUORUM=3 means not yet)", async () => {
      const reportId = ethers.id("report-001");
      await oracle.connect(oracle2).signReport(reportId);
      const status = await oracle.reportStatus(reportId);
      expect(status.signatures).to.equal(2);
    });

    it("third oracle signature should finalize with quorum", async () => {
      const reportId = ethers.id("report-001");
      await oracle.connect(oracle3).signReport(reportId);
      const status = await oracle.reportStatus(reportId);
      expect(status.finalized).to.equal(true);
      expect(status.approved).to.equal(true);
    });

    it("should reject duplicate signatures", async () => {
      const reportId = ethers.id("report-001");
      await expect(oracle.connect(oracle1).signReport(reportId))
        .to.be.revertedWithCustomError(oracle, "ReportNotFound");
    });

    it("non-oracle cannot submit report", async () => {
      const reportId = ethers.id("report-bad");
      const claimId  = ethers.id("claim-x");
      const dataHash = ethers.id("data-x");
      await expect(oracle.connect(alice).submitReport(reportId, claimId, dataHash))
        .to.be.revertedWithCustomError(oracle, "NotOracle");
    });
  });

  // ── Governance 测试 ────────────────────────────────────────────────────────

  describe("Governance", function () {
    let proposalId;

    before(async () => {
      // Give alice and bob voting weight
      await governance.connect(owner).setWeight(alice.address, 60n);
      await governance.connect(owner).setWeight(bob.address, 50n);
    });

    it("should create proposal", async () => {
      const tx = await governance.connect(alice).propose(
        "升级仲裁员质押门槛至 0.5 ETH",
        ethers.ZeroAddress,
        "0x"
      );
      const receipt = await tx.wait();
      // Get proposal ID from event
      const event = receipt.logs.find(l => l.fragment?.name === "ProposalCreated");
      proposalId = event.args[0];
      expect(proposalId).to.be.gt(0n);
    });

    it("alice can vote for proposal", async () => {
      await governance.connect(alice).castVote(proposalId, 1);
      const p = await governance.proposals(proposalId);
      expect(p.forVotes).to.equal(60n);
    });

    it("bob can vote for proposal", async () => {
      await governance.connect(bob).castVote(proposalId, 1);
      const p = await governance.proposals(proposalId);
      expect(p.forVotes).to.equal(110n);
    });

    it("cannot vote twice", async () => {
      await expect(governance.connect(alice).castVote(proposalId, 0))
        .to.be.revertedWithCustomError(governance, "AlreadyVoted");
    });

    it("cannot queue before voting ends", async () => {
      await expect(governance.queue(proposalId))
        .to.be.revertedWithCustomError(governance, "ProposalNotActive");
    });

    it("should queue after voting period (time warp)", async () => {
      // 快进 4 天（VOTE_PERIOD = 3 days）
      await ethers.provider.send("evm_increaseTime", [4 * 24 * 3600]);
      await ethers.provider.send("evm_mine", []);

      await governance.queue(proposalId);
      const p = await governance.proposals(proposalId);
      expect(p.queuedAt).to.be.gt(0n);
    });

    it("cannot execute before timelock expires", async () => {
      await expect(governance.execute(proposalId))
        .to.be.revertedWithCustomError(governance, "TimelockNotExpired");
    });

    it("should execute after timelock (time warp)", async () => {
      await ethers.provider.send("evm_increaseTime", [3 * 24 * 3600]);
      await ethers.provider.send("evm_mine", []);

      await governance.execute(proposalId);
      const p = await governance.proposals(proposalId);
      expect(p.executed).to.equal(true);
    });

    it("state should be Executed", async () => {
      const s = await governance.state(proposalId);
      expect(s).to.equal(5n); // ProposalState.Executed = 5
    });
  });
});
