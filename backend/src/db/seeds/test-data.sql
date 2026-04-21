-- 测试数据种子文件
-- 用途：开发环境和测试环境的数据初始化
-- 注意：生产环境禁止使用此文件！

-- 插入测试身份承诺
INSERT INTO identity_commitments (commitment, nullifier, trust_level, expiry_timestamp, is_banned, created_at)
VALUES 
  ('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', 
   '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', 
   3, 
   EXTRACT(EPOCH FROM NOW()) + 86400, 
   false, 
   NOW()),
  
  ('0x2234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', 
   '0xbbcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', 
   5, 
   EXTRACT(EPOCH FROM NOW()) + 172800, 
   false, 
   NOW()),
  
  ('0x3234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', 
   '0xcbcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', 
   1, 
   EXTRACT(EPOCH FROM NOW()) - 3600, 
   true, 
   NOW());

-- 插入测试空投申领记录
INSERT INTO claims (nullifier_hash, commitment, amount, evidence_cid, is_anonymous, created_at)
VALUES 
  ('0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678', 
   '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', 
   100, 
   'QmTest1234567890', 
   true, 
   NOW()),
  
  ('0xfeedface1234567890abcdef1234567890abcdef1234567890abcdef12345678', 
   '0x2234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', 
   500, 
   'QmTest0987654321', 
   false, 
   NOW());

-- 插入测试支付通道
INSERT INTO channels (initiator, receiver, balance, timeout_timestamp, state, created_at)
VALUES 
  ('0xInitiator1234567890abcdef1234567890abcdef12', 
   '0xReceiver1234567890abcdef1234567890abcdef12', 
   1000, 
   EXTRACT(EPOCH FROM NOW()) + 3600, 
   'open', 
   NOW()),
  
  ('0xInitiator2234567890abcdef1234567890abcdef12', 
   '0xReceiver2234567890abcdef1234567890abcdef12', 
   500, 
   EXTRACT(EPOCH FROM NOW()) - 1800, 
   'closed', 
   NOW());

-- 插入测试声誉记录
INSERT INTO reputation_history (address, score, reason, evidence_cid, created_at)
VALUES 
  ('0xUser1234567890abcdef1234567890abcdef1234', 
   85, 
   '良好的社区贡献', 
   'QmReputation123', 
   NOW()),
  
  ('0xUser2234567890abcdef1234567890abcdef1234', 
   92, 
   '优秀的治理参与', 
   'QmReputation456', 
   NOW()),
  
  ('0xUser3234567890abcdef1234567890abcdef1234', 
   45, 
   '违规行为扣分', 
   'QmReputation789', 
   NOW());

-- 插入测试治理提案
INSERT INTO governance_proposals (proposer, title, description, vote_start, vote_end, status)
VALUES 
  ('0xProposer1234567890abcdef1234567890abcdef', 
   '增加空投预算', 
   '建议将空投预算从 1000 增加到 5000', 
   NOW(), 
   NOW() + INTERVAL '7 days', 
   'active'),
  
  ('0xProposer2234567890abcdef1234567890abcdef', 
   '修改声誉算法', 
   '优化声誉评分权重', 
   NOW() - INTERVAL '3 days', 
   NOW() + INTERVAL '4 days', 
   'active');

-- 插入测试投票记录
INSERT INTO governance_votes (proposal_id, voter, support, weight, created_at)
VALUES 
  (1, '0xVoter1234567890abcdef1234567890abcdef12', 
   true, 100, NOW()),
  
  (1, '0xVoter2234567890abcdef1234567890abcdef12', 
   false, 50, NOW()),
  
  (2, '0xVoter1234567890abcdef1234567890abcdef12', 
   true, 100, NOW());
