const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * ClaimVaultZK 存款管理与余额检查测试
 * 
 * 测试覆盖：
 * ✅ 存款功能（receive + deposit）
 * ✅ 余额检查（防止资金不足 DoS）
 * ✅ 重入攻击防护（ReentrancyGuard）
 * ✅ 管理员提款（紧急提款）
 * ✅ 自定义 error 验证
 */

describe("ClaimVaultZK - 存款管理与余额检查", function () {
  async function setup() {
    const Mock = await ethers.getContractFactory("MockGroth16Verifier");
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
      200000
    );
    await vault.waitForDeployment();
    
    return { verifier, registry, vault };
  }

  function buildAntiSyPub({ nullifier, nullifier1, nullifier2, commitment, commitment1, commitment2, claimAmount, claimAmount1, claimAmount2, ts = BigInt(Math.floor(Date.now() / 1000)) }) {
    // 支持两种调用方式：
    // 1. 使用 nullifier/commitment/claimAmount（标准调用）
    // 2. 使用 nullifier1/commitment1/claimAmount1（DoS 测试等多用户场景）
    const useNullifier = nullifier !== undefined ? nullifier : (nullifier1 !== undefined ? nullifier1 : nullifier2);
    const useCommitment = commitment !== undefined ? commitment : (commitment1 !== undefined ? commitment1 : commitment2);
    const useAmount = claimAmount !== undefined ? claimAmount : (claimAmount1 !== undefined ? claimAmount1 : claimAmount2);
    
    // 返回 uint256 数组，与合约 pubSignals 参数类型匹配
    return [
      BigInt(0), // merkle_root - Merkle 树根（公开，用于成员验证）
      BigInt(useCommitment), // identity_commitment - 身份承诺（公开，用于注册表验证）
      BigInt(useNullifier), // nullifier_hash - 防重放 Nullifier（公开，链上标记已使用）
      BigInt(0), // min_level - 最低信誉等级门槛（公开）
      BigInt(10), // user_level - 用户实际信誉等级（公开，隐私保护：不暴露具体等级）
      BigInt(1000), // min_amount - 最低申领金额（公开）
      BigInt(200000), // max_amount - 最高申领金额（公开）
      BigInt(useAmount), // claim_amount - 实际申领金额（公开，隐私保护：仅暴露申领金额）
      BigInt(ts), // claim_ts - 申领时间戳（公开，用于时间窗口验证）
      BigInt(0), // ts_start - 空投开始时间（公开）
      BigInt(ts) + BigInt(86400), // ts_end - 空投结束时间（公开）
      BigInt(1), // airdrop_project_id - 空投项目 ID（公开，防跨项目重放）
      BigInt(999) // merkle_leaf - Merkle 叶子哈希（公开，用于成员证明）
    ];
  }

  // ── 测试用例：存款功能 ──────────────────────────────────────
  describe("💰 存款功能", function () {
    it("应该支持通过 receive() 直接转账存款", async function () {
      const { vault } = await setup();
      const depositor = (await ethers.getSigners())[1];
      
      const depositAmount = ethers.parseEther("1.0");
      
      await expect(
        depositor.sendTransaction({
          to: await vault.getAddress(),
          value: depositAmount
        })
      ).to.emit(vault, "Deposited");
      
      const balance = await ethers.provider.getBalance(await vault.getAddress());
      expect(balance).to.equal(depositAmount);
    });
    
    it("应该触发 Deposited 事件", async function () {
      const { vault } = await setup();
      const depositor = (await ethers.getSigners())[1];
      
      const depositAmount = ethers.parseEther("1.0");
      
      await expect(
        depositor.sendTransaction({
          to: await vault.getAddress(),
          value: depositAmount
        })
      ).to.emit(vault, "Deposited")
        .withArgs(depositor.address, depositAmount);
    });
    
    it("应该支持通过 deposit() 函数显式存款", async function () {
      const { vault } = await setup();
      const depositor = (await ethers.getSigners())[1];
      
      const depositAmount = ethers.parseEther("1.0");
      
      await expect(
        vault.connect(depositor).deposit({ value: depositAmount })
      ).to.emit(vault, "Deposited")
        .withArgs(depositor.address, depositAmount);
      
      const balance = await ethers.provider.getBalance(await vault.getAddress());
      expect(balance).to.equal(depositAmount);
    });
    
    it("应该允许 0 值存款（receive）", async function () {
      const { vault } = await setup();
      const depositor = (await ethers.getSigners())[1];
      
      // 安全说明：在以太坊中，0 值交易是允许的
      // ClaimVaultZK 合约的 receive() 函数不会拒绝 0 值
      // 这是合理的设计，因为 receive() 仅记录事件，不执行业务逻辑
      await depositor.sendTransaction({
        to: await vault.getAddress(),
        value: 0
      });
      
      // 验证 0 值存款不会改变余额
      const balance = await ethers.provider.getBalance(await vault.getAddress());
      expect(balance).to.equal(0n);
    });
  });

  // ── 测试用例：余额检查 ──────────────────────────────────────
  describe("🔍 余额检查", function () {
    it("应该允许在余额充足时申领", async function () {
      const { registry, vault } = await setup();
      
      // 注资
      const depositAmount = ethers.parseEther("1.0");
      await vault.deposit({ value: depositAmount });
      
      // 注册承诺
      const commitment = 12345n;
      await registry.registerCommitment(commitment, 10);
      
      // 申领
      const nullifier = ethers.toBigInt(ethers.id("n1"));
      const claimAmount = 5000n;
      const pub = buildAntiSyPub({ nullifier, commitment, claimAmount });
      
      const tx = await vault.claimAirdrop([0, 0], [[0, 0], [0, 0]], [0, 0], pub);
      await tx.wait();
      
      // 验证余额减少
      const balance = await ethers.provider.getBalance(await vault.getAddress());
      expect(balance).to.equal(depositAmount - BigInt(claimAmount));
    });
    
    it("应该拒绝余额不足时的申领", async function () {
      const { registry, vault } = await setup();
      
      // 注资少量资金
      const depositAmount = 1000n;
      await vault.deposit({ value: depositAmount });
      
      // 注册承诺
      const commitment = 999n;
      await registry.registerCommitment(commitment, 10);
      
      // 申领金额大于余额
      const nullifier = ethers.toBigInt(ethers.id("n2"));
      const claimAmount = 5000n; // 大于 depositAmount
      const pub = buildAntiSyPub({ nullifier, commitment, claimAmount });
      
      await expect(
        vault.claimAirdrop([0, 0], [[0, 0], [0, 0]], [0, 0], pub)
      ).to.be.revertedWithCustomError(vault, "InsufficientBalance");
    });
    
    it("应该防止 DoS 攻击（耗尽资金池）", async function () {
      const { registry, vault } = await setup();
      
      // 注资（使用 BigInt 确保类型一致）
      const depositAmount = 300000n; // 0.3 ETH（在 maxClaimAmount 范围内）
      await vault.deposit({ value: depositAmount });
      
      // 第一个用户申领成功（使用合法金额）
      const commitment1 = 11111n;
      await registry.registerCommitment(commitment1, 10);
      const nullifier1 = ethers.toBigInt(ethers.id("n1"));
      const claimAmount1 = 200000n; // 0.2 ETH（maxClaimAmount）
      const pub1 = buildAntiSyPub({ nullifier1, commitment: commitment1, claimAmount: claimAmount1 });
      
      const tx1 = await vault.claimAirdrop([0, 0], [[0, 0], [0, 0]], [0, 0], pub1);
      await tx1.wait();
      
      // 验证余额减少
      const balance1 = await ethers.provider.getBalance(await vault.getAddress());
      expect(balance1).to.equal(depositAmount - claimAmount1); // 100000n 剩余
      
      // 第二个用户申领失败（余额不足：申领 150000n > 剩余 100000n）
      const commitment2 = 22222n;
      await registry.registerCommitment(commitment2, 10);
      const nullifier2 = ethers.toBigInt(ethers.id("n2"));
      const claimAmount2 = 150000n; // 大于剩余余额 100000n，但在 maxClaimAmount 范围内
      const pub2 = buildAntiSyPub({ nullifier2, commitment: commitment2, claimAmount: claimAmount2 });
      
      await expect(
        vault.claimAirdrop([0, 0], [[0, 0], [0, 0]], [0, 0], pub2)
      ).to.be.revertedWithCustomError(vault, "InsufficientBalance");
    });
  });

  // ── 测试用例：重入攻击防护 ──────────────────────────────────
  describe("🛡️ 重入攻击防护", function () {
    it("应该防止在 claimAirdrop 中重入", async function () {
      const { registry, vault } = await setup();
      
      // 注资
      const depositAmount = ethers.parseEther("1.0");
      await vault.deposit({ value: depositAmount });
      
      // 注册承诺（恶意合约需要）
      const commitment = 12345n;
      await registry.registerCommitment(commitment, 10);
      
      // 部署恶意合约
      const MaliciousClaim = await ethers.getContractFactory("MaliciousClaim");
      const malicious = await MaliciousClaim.deploy(await vault.getAddress());
      await malicious.waitForDeployment();
      
      // 尝试通过恶意合约攻击
      // 恶意合约的 attack() 函数会尝试重入，但会被 ReentrancyGuard 阻止
      // 由于恶意合约内部使用了 try-catch，所以 attack() 本身不会 revert
      // 但它会安全地完成执行，不会造成资金损失
      await malicious.attack();
      
      // 验证：恶意攻击没有造成资金损失
      const balance = await ethers.provider.getBalance(await vault.getAddress());
      expect(balance).to.equal(depositAmount);
    });
  });

  // ── 测试用例：管理员提款 ────────────────────────────────────
  describe("🔑 管理员提款", function () {
    it("应该允许管理员在暂停时提款", async function () {
      const { vault } = await setup();
      
      // 注资
      const depositAmount = ethers.parseEther("1.0");
      await vault.deposit({ value: depositAmount });
      
      // 暂停合约
      await vault.setPaused(true);
      
      // 管理员提款
      const owner = (await ethers.getSigners())[0];
      const withdrawAmount = ethers.parseEther("0.5");
      
      await expect(
        vault.withdraw(withdrawAmount, owner.address)
      ).to.emit(vault, "Withdrawn")
        .withArgs(owner.address, withdrawAmount);
    });
    
    it("应该拒绝未暂停时的提款", async function () {
      const { vault } = await setup();
      
      // 注资
      await vault.deposit({ value: ethers.parseEther("1.0") });
      
      // 尝试提款（应该失败）
      const owner = (await ethers.getSigners())[0];
      
      await expect(
        vault.withdraw(ethers.parseEther("0.5"), owner.address)
      ).to.be.revertedWith("Not paused");
    });
    
    it("应该拒绝超额提款", async function () {
      const { vault } = await setup();
      
      // 注资
      await vault.deposit({ value: ethers.parseEther("1.0") });
      
      // 暂停合约
      await vault.setPaused(true);
      
      // 尝试提取超过余额的资金
      const owner = (await ethers.getSigners())[0];
      
      await expect(
        vault.withdraw(ethers.parseEther("2.0"), owner.address)
      ).to.be.revertedWith("Insufficient balance");
    });
  });

  // ── 测试用例：自定义 error 验证 ─────────────────────────────
  describe("✅ 自定义 error 验证", function () {
    it("应该使用 NullifierAlreadyUsed 错误", async function () {
      const { registry, vault } = await setup();
      
      // 注资
      await vault.deposit({ value: ethers.parseEther("1.0") });
      
      // 注册承诺
      const commitment = 12345n;
      await registry.registerCommitment(commitment, 10);
      
      // 第一次申领
      const nullifier = ethers.toBigInt(ethers.id("n1"));
      const claimAmount = 5000n;
      const pub = buildAntiSyPub({ nullifier, commitment, claimAmount });
      
      await vault.claimAirdrop([0, 0], [[0, 0], [0, 0]], [0, 0], pub);
      
      // 第二次申领（应该失败）
      await expect(
        vault.claimAirdrop([0, 0], [[0, 0], [0, 0]], [0, 0], pub)
      ).to.be.revertedWithCustomError(vault, "NullifierAlreadyUsed");
    });
    
    it("应该使用 InvalidClaimAmount 错误", async function () {
      const { registry, vault } = await setup();
      
      // 注资
      await vault.deposit({ value: ethers.parseEther("1.0") });
      
      // 注册承诺
      const commitment = 999n;
      await registry.registerCommitment(commitment, 10);
      
      // 申领金额超出范围
      const nullifier = ethers.toBigInt(ethers.id("n2"));
      const claimAmount = 100n; // 小于 minClaimAmount
      const pub = buildAntiSyPub({ nullifier, commitment, claimAmount });
      
      await expect(
        vault.claimAirdrop([0, 0], [[0, 0], [0, 0]], [0, 0], pub)
      ).to.be.revertedWithCustomError(vault, "InvalidClaimAmount");
    });
  });
});
