const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Governance (phase 6)", function () {

  // ── ArbitratorPool ──────────────────────────────────────────────────────

  describe("ArbitratorPool", function () {
    it("should register arbitrators and pick them", async function () {
      const [a, b] = await ethers.getSigners();
      const Pool = await ethers.getContractFactory("ArbitratorPool");
      const pool = await Pool.deploy();
      await pool.waitForDeployment();

      await pool.connect(a).register({ value: ethers.parseEther("0.02") });
      await pool.connect(b).register({ value: ethers.parseEther("0.02") });

      const picked = await pool.pick(123n, 2);
      expect(picked.length).to.equal(2);
    });

    it("should reject double registration", async function () {
      const [a] = await ethers.getSigners();
      const Pool = await ethers.getContractFactory("ArbitratorPool");
      const pool = await Pool.deploy();
      await pool.waitForDeployment();

      await pool.connect(a).register({ value: ethers.parseEther("0.02") });
      await expect(
        pool.connect(a).register({ value: ethers.parseEther("0.02") })
      ).to.be.revertedWith("already registered");
    });
  });

  // ── ChallengeManager: 完整奖惩流程 ──────────────────────────────────────

  describe("ChallengeManager - full reward/penalty flow", function () {
    let pool, cm;
    let owner, challenger, arb1, arb2, arb3;

    const PROPOSAL_ID = 42n;
    const STAKE = ethers.parseEther("0.1");

    beforeEach(async () => {
      [owner, challenger, arb1, arb2, arb3] = await ethers.getSigners();

      const Pool = await ethers.getContractFactory("ArbitratorPool");
      pool = await Pool.deploy();
      await pool.waitForDeployment();

      // 注册仲裁员
      await pool.connect(arb1).register({ value: ethers.parseEther("0.02") });
      await pool.connect(arb2).register({ value: ethers.parseEther("0.02") });
      await pool.connect(arb3).register({ value: ethers.parseEther("0.02") });

      const CM = await ethers.getContractFactory("ChallengeManager");
      cm = await CM.deploy(await pool.getAddress());
      await cm.waitForDeployment();
    });

    async function openAndCommit(vote1 = 1, vote2 = 1) {
      // 1. 挑战者开启挑战
      await cm.connect(challenger).openChallenge(PROPOSAL_ID, { value: STAKE });

      // 2. 进入 Commit 阶段
      await cm.beginCommit(PROPOSAL_ID);

      // 3. 仲裁员提交承诺
      const salt1 = ethers.id("salt1");
      const salt2 = ethers.id("salt2");
      const commit1 = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(["uint8", "bytes32"], [vote1, salt1])
      );
      const commit2 = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(["uint8", "bytes32"], [vote2, salt2])
      );

      await cm.connect(arb1).commitVote(PROPOSAL_ID, commit1);
      await cm.connect(arb2).commitVote(PROPOSAL_ID, commit2);

      return { salt1, salt2 };
    }

    it("commit phase: open → beginCommit → commitVote", async function () {
      const { salt1 } = await openAndCommit();
      const c = await cm.challenges(PROPOSAL_ID);
      expect(c.phase).to.equal(2n); // Phase.Commit = 2
    });

    it("reveal phase: two reveals move to Reveal", async function () {
      const { salt1, salt2 } = await openAndCommit(1, 1);

      // 推进时间超过 commitDeadline（1 day）
      await ethers.provider.send("evm_increaseTime", [24 * 3600 + 10]);
      await ethers.provider.send("evm_mine", []);

      await cm.connect(arb1).revealVote(PROPOSAL_ID, 1, ethers.id("salt1"));
      await cm.connect(arb2).revealVote(PROPOSAL_ID, 1, ethers.id("salt2"));

      const c = await cm.challenges(PROPOSAL_ID);
      expect(c.votesFor).to.equal(2);
    });

    it("challenger wins: stake refunded after resolve", async function () {
      const { salt1, salt2 } = await openAndCommit(1, 1);

      await ethers.provider.send("evm_increaseTime", [24 * 3600 + 10]);
      await ethers.provider.send("evm_mine", []);

      await cm.connect(arb1).revealVote(PROPOSAL_ID, 1, ethers.id("salt1"));
      await cm.connect(arb2).revealVote(PROPOSAL_ID, 1, ethers.id("salt2"));

      // 推进超过 revealDeadline（再加 1 day）
      await ethers.provider.send("evm_increaseTime", [24 * 3600 + 10]);
      await ethers.provider.send("evm_mine", []);

      const balBefore = await ethers.provider.getBalance(challenger.address);
      const tx   = await cm.resolve(PROPOSAL_ID);
      const rcpt = await tx.wait();
      const gas  = rcpt.gasUsed * rcpt.gasPrice;

      const balAfter = await ethers.provider.getBalance(challenger.address);

      // 挑战者应拿回质押（net of gas）
      expect(balAfter + gas - balBefore).to.be.closeTo(STAKE, ethers.parseEther("0.001"));

      const c = await cm.challenges(PROPOSAL_ID);
      expect(c.challengerWins).to.equal(true);
      expect(c.phase).to.equal(4n); // Phase.Resolved = 4
    });

    it("challenger loses: stake goes to arbitrator reward pool", async function () {
      // 双方均投"反对挑战"（vote=0）
      await cm.connect(challenger).openChallenge(PROPOSAL_ID + 1n, { value: STAKE });
      await cm.beginCommit(PROPOSAL_ID + 1n);

      const vote = 0;
      const salt1 = ethers.id("salt_a");
      const salt2 = ethers.id("salt_b");
      const commit1 = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(["uint8", "bytes32"], [vote, salt1])
      );
      const commit2 = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(["uint8", "bytes32"], [vote, salt2])
      );
      await cm.connect(arb1).commitVote(PROPOSAL_ID + 1n, commit1);
      await cm.connect(arb2).commitVote(PROPOSAL_ID + 1n, commit2);

      await ethers.provider.send("evm_increaseTime", [24 * 3600 + 10]);
      await ethers.provider.send("evm_mine", []);

      await cm.connect(arb1).revealVote(PROPOSAL_ID + 1n, vote, salt1);
      await cm.connect(arb2).revealVote(PROPOSAL_ID + 1n, vote, salt2);

      await ethers.provider.send("evm_increaseTime", [24 * 3600 + 10]);
      await ethers.provider.send("evm_mine", []);

      const poolBefore = await cm.arbitratorRewardPool();
      await cm.resolve(PROPOSAL_ID + 1n);
      const poolAfter = await cm.arbitratorRewardPool();

      expect(poolAfter - poolBefore).to.equal(STAKE);

      const c = await cm.challenges(PROPOSAL_ID + 1n);
      expect(c.challengerWins).to.equal(false);
    });

    it("forceResolve: owner can force outcome", async function () {
      await cm.connect(challenger).openChallenge(PROPOSAL_ID + 2n, { value: STAKE });
      await cm.beginCommit(PROPOSAL_ID + 2n);

      await cm.connect(owner).forceResolve(PROPOSAL_ID + 2n, true);
      const c = await cm.challenges(PROPOSAL_ID + 2n);
      expect(c.phase).to.equal(4n);
      expect(c.challengerWins).to.equal(true);
    });

    it("cannot resolve before reveal deadline", async function () {
      const { salt1, salt2 } = await openAndCommit(1, 1);

      await ethers.provider.send("evm_increaseTime", [24 * 3600 + 10]);
      await ethers.provider.send("evm_mine", []);

      await cm.connect(arb1).revealVote(PROPOSAL_ID, 1, ethers.id("salt1"));
      await cm.connect(arb2).revealVote(PROPOSAL_ID, 1, ethers.id("salt2"));

      // 此时 revealDeadline 尚未过期
      await expect(cm.resolve(PROPOSAL_ID))
        .to.be.revertedWithCustomError(cm, "DeadlineNotPassed");
    });

    it("cannot reveal with wrong salt (RevealMismatch)", async function () {
      await openAndCommit(1, 1);

      await ethers.provider.send("evm_increaseTime", [24 * 3600 + 10]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        cm.connect(arb1).revealVote(PROPOSAL_ID, 1, ethers.id("WRONG_SALT"))
      ).to.be.revertedWithCustomError(cm, "RevealMismatch");
    });
  });
});
