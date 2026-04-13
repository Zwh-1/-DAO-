const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  const MockVerifier = await ethers.getContractFactory("MockGroth16Verifier");
  const verifier = await MockVerifier.deploy(true);
  await verifier.waitForDeployment();

  const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
  const registry = await IdentityRegistry.deploy();
  await registry.waitForDeployment();

  const minAmount = process.env.MIN_CLAIM || "1000";
  const maxAmount = process.env.MAX_CLAIM || "200000";
  const ClaimVaultZK = await ethers.getContractFactory("ClaimVaultZK");
  const vault = await ClaimVaultZK.deploy(
    await verifier.getAddress(),
    await registry.getAddress(),
    minAmount,
    maxAmount
  );
  await vault.waitForDeployment();

  const ArbitratorPool = await ethers.getContractFactory("ArbitratorPool");
  const pool = await ArbitratorPool.deploy();
  await pool.waitForDeployment();

  const ChallengeManager = await ethers.getContractFactory("ChallengeManager");
  const challenges = await ChallengeManager.deploy(await pool.getAddress());
  await challenges.waitForDeployment();

  // SBT（ERC-5192 灵魂绑定代币）
  const SBT = await ethers.getContractFactory("SBT");
  const sbt = await SBT.deploy(await registry.getAddress());
  await sbt.waitForDeployment();

  // OracleManager（多签预言机报告）
  const OracleManager = await ethers.getContractFactory("OracleManager");
  const oracle = await OracleManager.deploy();
  await oracle.waitForDeployment();

  // Governance（DAO 加权投票 + 时间锁）
  const Governance = await ethers.getContractFactory("Governance");
  const governance = await Governance.deploy();
  await governance.waitForDeployment();

  // PaymentChannel（高频小额支付通道）
  const PaymentChannel = await ethers.getContractFactory("PaymentChannel");
  const participant1 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';  // 发起人（测试地址）
  const participant2 = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';  // 受助者（测试地址）
  const totalDeposit = ethers.parseEther('1.0');  // 锁定 1 ETH
  
  const paymentChannel = await PaymentChannel.deploy(
    participant1,
    participant2,
    totalDeposit
  );
  await paymentChannel.waitForDeployment();
  
  // AnonymousClaim（匿名资金发放）
  const merkleRoot = ethers.toBigInt(ethers.keccak256(ethers.toUtf8Bytes("example_merkle_root")));
  const tsStart = Math.floor(Date.now() / 1000);  // 当前时间戳
  const tsEnd = tsStart + 86400 * 30;  // 30 天后
  
  const AnonymousClaim = await ethers.getContractFactory("AnonymousClaim");
  const anonymousClaim = await AnonymousClaim.deploy(
    await verifier.getAddress(),
    merkleRoot,
    tsStart,
    tsEnd
  );
  await anonymousClaim.waitForDeployment();

  console.log("MockGroth16Verifier:", await verifier.getAddress());
  console.log("IdentityRegistry:",    await registry.getAddress());
  console.log("ClaimVaultZK:",        await vault.getAddress());
  console.log("ArbitratorPool:",      await pool.getAddress());
  console.log("ChallengeManager:",    await challenges.getAddress());
  console.log("SBT:",                 await sbt.getAddress());
  console.log("OracleManager:",       await oracle.getAddress());
  console.log("Governance:",          await governance.getAddress());
  console.log("PaymentChannel:",      await paymentChannel.getAddress());
  console.log("AnonymousClaim:",      await anonymousClaim.getAddress());
  console.log("deployer:",            deployer.address);
  
  // PaymentChannel 信息
  console.log("\nPaymentChannel 详情:");
  console.log("  发起人:", participant1);
  console.log("  受助者:", participant2);
  console.log("  锁定资金:", ethers.formatEther(totalDeposit), "ETH");
  
  // AnonymousClaim 信息
  console.log("\nAnonymousClaim 详情:");
  console.log("  Merkle Root:", merkleRoot);
  console.log("  Verifier:", await verifier.getAddress());
  console.log("  开始时间:", new Date(tsStart * 1000).toISOString());
  console.log("  结束时间:", new Date(tsEnd * 1000).toISOString());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
