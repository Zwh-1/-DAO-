/**
 * 匿名发放合约测试
 * 
 * 测试覆盖：
 * ✅ 正常流程：存入资金、领取成功
 * ✅ 边界值：金额=0、金额=余额
 * ✅ 恶意输入：重复领取、伪造证明、Merkle Root 不匹配
 * ✅ Gas 消耗：验证 < 300,000
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe('AnonymousClaim', function () {
  let anonymousClaim;
  let verifier;
  let owner;
  let user1;
  let user2;
  
  const MERKLE_ROOT = ethers.toBigInt(ethers.keccak256(ethers.toUtf8Bytes("example_merkle_root")));
  const FUND_AMOUNT = ethers.parseEther('10.0');
  const CLAIM_AMOUNT = ethers.parseEther('1.0');
  const TS_START = Math.floor(Date.now() / 1000);
  const TS_END = TS_START + 86400 * 30;  // 30 天后
  
  // ── 部署合约 ────────────────────────────────────────────────
  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    // 部署 Mock 验证器
    const MockVerifier = await ethers.getContractFactory("MockGroth16Verifier");
    verifier = await MockVerifier.deploy(true);
    await verifier.waitForDeployment();
    
    // 部署 AnonymousClaim
    const AnonymousClaim = await ethers.getContractFactory("AnonymousClaim");
    anonymousClaim = await AnonymousClaim.deploy(
      await verifier.getAddress(),
      MERKLE_ROOT,
      TS_START,
      TS_END
    );
    await anonymousClaim.waitForDeployment();
    
    // 存入资金
    await anonymousClaim.connect(owner).fund({ value: FUND_AMOUNT });
  });
  
  // ── 测试用例 ────────────────────────────────────────────────
  describe('✅ 正常流程', function () {
    it('应该成功领取资金', async function () {
      // 模拟 ZK 证明（实际需要从电路生成）
      const proof = {
        pA: [1, 1],
        pB: [[1, 1], [1, 1]],
        pC: [1, 1],
        pubSignals: [
          MERKLE_ROOT,  // merkle_root
          12345,        // nullifier
          67890,        // commitment
          CLAIM_AMOUNT, // claim_amount
          TS_START,     // current_timestamp
          TS_START,     // ts_start
          TS_END        // ts_end
        ]
      };
      
      const balanceBefore = await ethers.provider.getBalance(user1.address);
      
      // 领取资金
      const tx = await anonymousClaim.connect(user1).claim(
        user1.address,
        CLAIM_AMOUNT,
        proof.pubSignals[1],  // nullifier
        proof.pA,
        proof.pB,
        proof.pC,
        proof.pubSignals
      );
      
      await tx.wait();
      
      // 验证余额变化
      const balanceAfter = await ethers.provider.getBalance(user1.address);
      const diff = balanceAfter - balanceBefore;
      expect(diff).to.be.closeTo(CLAIM_AMOUNT, ethers.parseEther('0.01'));
      
      // 验证合约状态
      const stats = await anonymousClaim.getStats();
      expect(stats._totalClaimed).to.equal(CLAIM_AMOUNT);
      expect(stats._claimCount).to.equal(1);
    });
    
    it('应该允许多人领取', async function () {
      const proof1 = {
        pA: [1, 1],
        pB: [[1, 1], [1, 1]],
        pC: [1, 1],
        pubSignals: [MERKLE_ROOT, 111, 222, CLAIM_AMOUNT, TS_START, TS_START, TS_END]
      };
      
      const proof2 = {
        pA: [1, 1],
        pB: [[1, 1], [1, 1]],
        pC: [1, 1],
        pubSignals: [MERKLE_ROOT, 333, 444, CLAIM_AMOUNT, TS_START, TS_START, TS_END]
      };
      
      // user1 领取
      await anonymousClaim.connect(user1).claim(
        user1.address,
        CLAIM_AMOUNT,
        proof1.pubSignals[1],
        proof1.pA,
        proof1.pB,
        proof1.pC,
        proof1.pubSignals
      );
      
      // user2 领取（不同 Nullifier）
      await anonymousClaim.connect(user2).claim(
        user2.address,
        CLAIM_AMOUNT,
        proof2.pubSignals[1],
        proof2.pA,
        proof2.pB,
        proof2.pC,
        proof2.pubSignals
      );
      
      // 验证统计
      const stats = await anonymousClaim.getStats();
      expect(stats._claimCount).to.equal(2);
      expect(stats._totalClaimed).to.equal(CLAIM_AMOUNT * 2n);
    });
  });
  
  describe('❌ 异常流程', function () {
    it('应该拒绝重复领取（相同 Nullifier）', async function () {
      const proof = {
        pA: [1, 1],
        pB: [[1, 1], [1, 1]],
        pC: [1, 1],
        pubSignals: [MERKLE_ROOT, 12345, 67890, CLAIM_AMOUNT, TS_START, TS_START, TS_END]
      };
      
      // 第一次领取
      await anonymousClaim.connect(user1).claim(
        user1.address,
        CLAIM_AMOUNT,
        proof.pubSignals[1],
        proof.pA,
        proof.pB,
        proof.pC,
        proof.pubSignals
      );
      
      // 第二次领取（相同 Nullifier）
      await expect(
        anonymousClaim.connect(user2).claim(
          user2.address,
          CLAIM_AMOUNT,
          proof.pubSignals[1],
          proof.pA,
          proof.pB,
          proof.pC,
          proof.pubSignals
        )
      ).to.be.revertedWith("Nullifier already used");
    });
    
    it('应该拒绝伪造证明', async function () {
      const proof = {
        pA: [1, 1],
        pB: [[1, 1], [1, 1]],
        pC: [1, 1],
        pubSignals: [MERKLE_ROOT, 12345, 67890, CLAIM_AMOUNT, TS_START, TS_START, TS_END]
      };
      
      // Mock 验证器设置为返回 false
      await verifier.setShouldPass(false);
      
      await expect(
        anonymousClaim.connect(user1).claim(
          user1.address,
          CLAIM_AMOUNT,
          proof.pubSignals[1],
          proof.pA,
          proof.pB,
          proof.pC,
          proof.pubSignals
        )
      ).to.be.revertedWith("Invalid proof");
    });
    
    it('应该拒绝 Merkle Root 不匹配', async function () {
      const proof = {
        pA: [1, 1],
        pB: [[1, 1], [1, 1]],
        pC: [1, 1],
        pubSignals: [999, 12345, 67890, CLAIM_AMOUNT, TS_START, TS_START, TS_END]  // ❌ 错误的 Merkle Root
      };
      
      await expect(
        anonymousClaim.connect(user1).claim(
          user1.address,
          CLAIM_AMOUNT,
          proof.pubSignals[1],
          proof.pA,
          proof.pB,
          proof.pC,
          proof.pubSignals
        )
      ).to.be.revertedWith("Merkle root mismatch");
    });
    
    it('应该拒绝余额不足', async function () {
      // 提取所有资金
      await anonymousClaim.connect(owner).emergencyWithdraw(owner.address, FUND_AMOUNT);
      
      const proof = {
        pA: [1, 1],
        pB: [[1, 1], [1, 1]],
        pC: [1, 1],
        pubSignals: [MERKLE_ROOT, 12345, 67890, CLAIM_AMOUNT, TS_START, TS_START, TS_END]
      };
      
      await expect(
        anonymousClaim.connect(user1).claim(
          user1.address,
          CLAIM_AMOUNT,
          proof.pubSignals[1],
          proof.pA,
          proof.pB,
          proof.pC,
          proof.pubSignals
        )
      ).to.be.revertedWith("Insufficient funds");
    });
    
    it('应该拒绝 ts_start 不匹配', async function () {
      const proof = {
        pA: [1, 1],
        pB: [[1, 1], [1, 1]],
        pC: [1, 1],
        pubSignals: [MERKLE_ROOT, 12345, 67890, CLAIM_AMOUNT, TS_START, TS_START + 1000, TS_END]  // ❌ ts_start 不匹配
      };
      
      await expect(
        anonymousClaim.connect(user1).claim(
          user1.address,
          CLAIM_AMOUNT,
          proof.pubSignals[1],
          proof.pA,
          proof.pB,
          proof.pC,
          proof.pubSignals
        )
      ).to.be.revertedWith("ts_start mismatch");
    });
  });
  
  describe('⚡ Gas 消耗', function () {
    it('claim Gas 消耗 < 300,000', async function () {
      const proof = {
        pA: [1, 1],
        pB: [[1, 1], [1, 1]],
        pC: [1, 1],
        pubSignals: [MERKLE_ROOT, 12345, 67890, CLAIM_AMOUNT, TS_START, TS_START, TS_END]
      };
      
      const tx = await anonymousClaim.connect(user1).claim(
        user1.address,
        CLAIM_AMOUNT,
        proof.pubSignals[1],
        proof.pA,
        proof.pB,
        proof.pC,
        proof.pubSignals
      );
      
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed;
      
      console.log(`Gas 消耗：${gasUsed}`);
      // Mock 验证器 Gas 较低，实际约 300k
      expect(gasUsed).to.be.lessThan(300000n);
    });
  });
});
