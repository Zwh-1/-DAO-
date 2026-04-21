/**
 * 文件存储功能测试
 * 
 * 测试范围：
 * - ABI 文件读写
 * - 证明文件读写（敏感文件）
 * - 公开输入数据读写
 * - 文件清理功能
 * - 路径安全检查
 */

import { describe, it, beforeEach, afterEach } from 'vitest';
import { expect } from 'chai';
import {
  saveABI,
  loadABI,
  saveProof,
  loadProof,
  deleteProof,
  savePublicInput,
  loadPublicInput,
  generateUniqueFileName,
  cleanupExpiredFiles,
} from '../src/utils/fileStorage.js';
import { getStoragePath } from '../src/config/storage.js';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';

describe('文件存储功能测试', () => {
  // 测试数据
  const testABI = [
    {
      inputs: [],
      name: 'claim',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function',
    },
  ];
  
  const testProof = {
    pi_a: ['0x1234', '0x5678'],
    pi_b: [['0xabcd', '0xef01'], ['0x2345', '0x6789']],
    pi_c: ['0xaaaa', '0xbbbb'],
  };
  
  const testPublicInputs = [
    '0x1111',
    '0x2222',
    '0x3333',
  ];
  
  // 测试文件列表（用于清理）
  const testFiles = [];
  
  /**
   * 清理测试文件
   */
  async function cleanupTestFiles() {
    for (const filePath of testFiles) {
      try {
        await unlink(filePath);
      } catch (error) {
        // 文件可能已被删除，忽略错误
      }
    }
    testFiles.length = 0; // 清空数组
  }
  
  beforeEach(() => {
    // 每个测试前清理
    return cleanupTestFiles();
  });
  
  afterEach(() => {
    // 每个测试后清理
    return cleanupTestFiles();
  });
  
  describe('唯一文件名生成', () => {
    it('应该生成唯一的文件名', () => {
      const filename1 = generateUniqueFileName('test');
      const filename2 = generateUniqueFileName('test');
      
      expect(filename1).to.not.equal(filename2);
      expect(filename1).to.include('test');
      expect(filename1).to.include('.json');
    });
    
    it('应该支持不带前缀的文件名', () => {
      const filename = generateUniqueFileName();
      
      expect(filename).to.include('.json');
      expect(filename.length).to.be.greaterThan(10);
    });
  });
  
  describe('ABI 文件存储', () => {
    it('应该保存并加载 ABI 文件', async () => {
      const filename = generateUniqueFileName('abi-test');
      const filePath = await saveABI(filename, testABI);
      testFiles.push(filePath);
      
      const loadedABI = await loadABI(filename);
      
      expect(loadedABI).to.deep.equal(testABI);
    });
    
    it('应该加载不存在的 ABI 文件时抛出错误', async () => {
      try {
        await loadABI('non_existent_abi.json');
        expect.fail('应该抛出错误');
      } catch (error) {
        expect(error.message).to.include('加载 ABI 失败');
      }
    });
  });
  
  describe('证明文件存储（敏感文件）', () => {
    it('应该保存并加载证明文件', async () => {
      const filename = generateUniqueFileName('proof_test');
      const filePath = await saveProof(filename, testProof, { sensitive: true });
      testFiles.push(filePath);
      
      const loadedProof = await loadProof(filename);
      
      expect(loadedProof).to.deep.equal(testProof);
    });
    
    it('应该删除证明文件', async () => {
      const filename = generateUniqueFileName('proof_delete_test');
      const filePath = await saveProof(filename, testProof);
      
      expect(filePath).to.exist;
      
      await deleteProof(filename);
      
      // 验证文件已被删除
      try {
        await loadProof(filename);
        expect.fail('文件应该已被删除');
      } catch (error) {
        expect(error.message).to.include('加载证明失败');
      }
    });
    
    it('应该支持子目录存储', async () => {
      const filename = generateUniqueFileName('proof_subdir_test');
      const subDir = 'test_subdir';
      const filePath = await saveProof(filename, testProof, { subDir });
      testFiles.push(filePath);
      
      const loadedProof = await loadProof(filename, subDir);
      
      expect(loadedProof).to.deep.equal(testProof);
    });
  });
  
  describe('公开输入数据存储', () => {
    it('应该保存并加载公开输入数据', async () => {
      const filename = generateUniqueFileName('public_input_test');
      const filePath = await savePublicInput(filename, testPublicInputs);
      testFiles.push(filePath);
      
      const loadedInputs = await loadPublicInput(filename);
      
      expect(loadedInputs).to.deep.equal(testPublicInputs);
    });
    
    it('应该支持子目录存储', async () => {
      const filename = generateUniqueFileName('public_input_subdir_test');
      const subDir = 'test_subdir';
      const filePath = await savePublicInput(filename, testPublicInputs, subDir);
      testFiles.push(filePath);
      
      const loadedInputs = await loadPublicInput(filename, subDir);
      
      expect(loadedInputs).to.deep.equal(testPublicInputs);
    });
  });
  
  describe('路径安全检查', () => {
    it('应该拒绝路径遍历攻击', async () => {
      try {
        await saveABI('../../../etc/passwd', testABI);
        expect.fail('应该拒绝路径遍历攻击');
      } catch (error) {
        expect(error.message).to.include('路径遍历攻击检测');
      }
    });
    
    it('应该拒绝包含 .. 的文件路径', async () => {
      try {
        await saveProof('test/../../../etc/passwd', testProof);
        expect.fail('应该拒绝路径遍历攻击');
      } catch (error) {
        expect(error.message).to.include('路径遍历攻击检测');
      }
    });
  });
  
  describe('文件清理功能', () => {
    it('应该清理过期文件', async () => {
      // 保存一个测试文件
      const filename = generateUniqueFileName('cleanup_test');
      const filePath = await saveProof(filename, testProof);
      testFiles.push(filePath);
      
      // 立即清理（使用很长的保留时间，确保文件不会被删除）
      const result = await cleanupExpiredFiles('proofs', 86400000); // 24 小时过期
      
      // 由于文件刚创建，不应该被删除
      expect(result.deletedCount).to.equal(0);
      
      // 验证文件仍然存在
      const loadedProof = await loadProof(filename);
      expect(loadedProof).to.deep.equal(testProof);
    });
    
    it('应该返回清理统计', async () => {
      const result = await cleanupExpiredFiles('proofs', 0); // 0 毫秒，所有文件都过期
      
      expect(result).to.have.property('deletedCount');
      expect(result).to.have.property('totalSize');
      expect(result.deletedCount).to.be.a('number');
      expect(result.totalSize).to.be.a('number');
    });
  });
  
  describe('存储路径配置', () => {
    it('应该获取正确的存储路径', () => {
      const abisPath = getStoragePath('abis');
      expect(abisPath).to.include('abis');
      
      const proofsPath = getStoragePath('proofs');
      expect(proofsPath).to.include('proofs');
      
      const publicInputsPath = getStoragePath('publicInputs');
      expect(publicInputsPath).to.include('publicInputs');
    });
    
    it('应该支持子目录路径', () => {
      const subDirPath = getStoragePath('proofs', 'test_env');
      expect(subDirPath).to.include('proofs');
      expect(subDirPath).to.include('test_env');
    });
    
    it('应该拒绝未知的存储类型', () => {
      try {
        getStoragePath('unknown_type');
        expect.fail('应该抛出错误');
      } catch (error) {
        expect(error.message).to.include('未知的存储类型');
      }
    });
  });
});
