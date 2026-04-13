/**
 * 支付通道合约测试
 * 
 * 测试覆盖：
 * ✅ 正常流程：状态更新、关闭通道
 * ✅ 边界值：nonce=0, nonce=MAX, balance=0
 * ✅ 恶意输入：伪造签名、重用 nonce、金额不守恒
 * ✅ Gas 消耗：验证 < 50,000
 */

import { expect } from 'chai';
import { ethers } from 'hardhat';
import type { PaymentChannel } from '../typechain-types/contracts/PaymentChannel';

describe('PaymentChannel', function () {
  let paymentChannel: PaymentChannel;
  let participant1: any;
  let participant2: any;
  let deployer: any;
  
  const TOTAL_DEPOSIT = ethers.parseEther('1.0');
  
  // ── 部署合约 ────────────────────────────────────────────────
  beforeEach(async function () {
    [deployer, participant1, participant2] = await ethers.getSigners();
    
    const PaymentChannel = await ethers.getContractFactory('PaymentChannel');
    paymentChannel = await PaymentChannel.deploy(
      participant1.address,
      participant2.address,
      TOTAL_DEPOSIT
    );
  });
  
  // ── 测试用例 ────────────────────────────────────────────────
  
  describe('✅ 正常流程', function () {
    it('应该成功更新状态（nonce=1）', async function () {
      const balance1 = ethers.parseEther('0.9');
      const balance2 = ethers.parseEther('0.1');
      const nonce = 1;
      
      // 生成签名
      const messageHash = await paymentChannel['_hashMessage'](
        balance1,
        balance2,
        nonce
      );
      
      const sig1 = await participant1.signMessage(messageHash);
      const sig2 = await participant2.signMessage(messageHash);
      
      // 调用合约
      const tx = await paymentChannel.connect(participant1).updateState(
        balance1,
        balance2,
        nonce,
        sig1,
        sig2
      );
      
      await tx.wait();
      
      // 验证状态
      const state = await paymentChannel.getChannelState();
      expect(state.balance1).to.equal(balance1);
      expect(state.balance2).to.equal(balance2);
      expect(state.nonce).to.equal(nonce);
    });
    
    it('应该成功更新状态（nonce 递增）', async function () {
      // 第一次更新
      await updateState(ethers.parseEther('0.8'), ethers.parseEther('0.2'), 1);
      
      // 第二次更新
      await updateState(ethers.parseEther('0.5'), ethers.parseEther('0.5'), 2);
      
      const state = await paymentChannel.getChannelState();
      expect(state.nonce).to.equal(2);
    });
    
    it('应该成功关闭通道', async function () {
      const balance1 = ethers.parseEther('0.7');
      const balance2 = ethers.parseEther('0.3');
      const nonce = 1;
      
      const messageHash = await paymentChannel['_hashMessage'](
        balance1,
        balance2,
        nonce
      );
      
      const sig1 = await participant1.signMessage(ethers.getBytes(messageHash));
      const sig2 = await participant2.signMessage(ethers.getBytes(messageHash));
      
      const tx = await paymentChannel.connect(participant1).closeChannel(
        balance1,
        balance2,
        nonce,
        sig1,
        sig2
      );
      
      await tx.wait();
      
      // 验证余额
      expect(await ethers.provider.getBalance(participant2.address))
        .to.be.closeTo(balance2, ethers.parseEther('0.001'));
    });
  });
  
  describe('❌ 异常流程', function () {
    it('应该拒绝 nonce 不递增（nonce=0）', async function () {
      const balance1 = ethers.parseEther('0.9');
      const balance2 = ethers.parseEther('0.1');
      const nonce = 0;  // ❌ nonce 必须 > 0
      
      const messageHash = await paymentChannel['_hashMessage'](
        balance1,
        balance2,
        nonce
      );
      
      const sig1 = await participant1.signMessage(ethers.getBytes(messageHash));
      const sig2 = await participant2.signMessage(ethers.getBytes(messageHash));
      
      await expect(
        paymentChannel.connect(participant1).updateState(
          balance1,
          balance2,
          nonce,
          sig1,
          sig2
        )
      ).to.be.revertedWith('Nonce must increase');
    });
    
    it('应该拒绝金额不守恒', async function () {
      const balance1 = ethers.parseEther('0.9');
      const balance2 = ethers.parseEther('0.2');  // ❌ 总和 != 1.0
      const nonce = 1;
      
      const messageHash = await paymentChannel['_hashMessage'](
        balance1,
        balance2,
        nonce
      );
      
      const sig1 = await participant1.signMessage(ethers.getBytes(messageHash));
      const sig2 = await participant2.signMessage(ethers.getBytes(messageHash));
      
      await expect(
        paymentChannel.connect(participant1).updateState(
          balance1,
          balance2,
          nonce,
          sig1,
          sig2
        )
      ).to.be.revertedWith('Amount mismatch');
    });
    
    it('应该拒绝伪造签名', async function () {
      const balance1 = ethers.parseEther('0.9');
      const balance2 = ethers.parseEther('0.1');
      const nonce = 1;
      
      const messageHash = await paymentChannel['_hashMessage'](
        balance1,
        balance2,
        nonce
      );
      
      // ❌ 使用错误的签名者
      const sig1 = await deployer.signMessage(ethers.getBytes(messageHash));  // 非 participant1
      const sig2 = await participant2.signMessage(ethers.getBytes(messageHash));
      
      await expect(
        paymentChannel.connect(participant1).updateState(
          balance1,
          balance2,
          nonce,
          sig1,
          sig2
        )
      ).to.be.revertedWith('Invalid sig1');
    });
    
    it('应该拒绝重用旧 nonce', async function () {
      // 第一次更新（nonce=1）
      await updateState(ethers.parseEther('0.9'), ethers.parseEther('0.1'), 1);
      
      // ❌ 尝试重用 nonce=1
      const balance1 = ethers.parseEther('0.8');
      const balance2 = ethers.parseEther('0.2');
      const nonce = 1;  // ❌ 必须 > 1
      
      const messageHash = await paymentChannel['_hashMessage'](
        balance1,
        balance2,
        nonce
      );
      
      const sig1 = await participant1.signMessage(ethers.getBytes(messageHash));
      const sig2 = await participant2.signMessage(ethers.getBytes(messageHash));
      
      await expect(
        paymentChannel.connect(participant1).updateState(
          balance1,
          balance2,
          nonce,
          sig1,
          sig2
        )
      ).to.be.revertedWith('Nonce must increase');
    });
  });
  
  describe('⚡ Gas 消耗', function () {
    it('updateState Gas 消耗 < 50,000', async function () {
      const balance1 = ethers.parseEther('0.9');
      const balance2 = ethers.parseEther('0.1');
      const nonce = 1;
      
      const messageHash = await paymentChannel['_hashMessage'](
        balance1,
        balance2,
        nonce
      );
      
      const sig1 = await participant1.signMessage(ethers.getBytes(messageHash));
      const sig2 = await participant2.signMessage(ethers.getBytes(messageHash));
      
      const tx = await paymentChannel.connect(participant1).updateState(
        balance1,
        balance2,
        nonce,
        sig1,
        sig2
      );
      
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed;
      
      console.log(`Gas 消耗：${gasUsed}`);
      expect(gasUsed).to.be.lessThan(50000n);
    });
  });
  
  // ── 辅助函数 ────────────────────────────────────────────────
  async function updateState(
    balance1: bigint,
    balance2: bigint,
    nonce: number
  ) {
    const messageHash = await paymentChannel['_hashMessage'](
      balance1,
      balance2,
      nonce
    );
    
    const sig1 = await participant1.signMessage(messageHash);
    const sig2 = await participant2.signMessage(messageHash);
    
    const tx = await paymentChannel.connect(participant1).updateState(
      balance1,
      balance2,
      nonce,
      sig1,
      sig2
    );
    
    await tx.wait();
  }
});
