/**
 * 工具函数统一导出
 */

// 哈希工具
export {
  sha256,
  keccak256,
  hashForLogging,
  doubleSha256,
  hmacSha256,
  isValidHash,
} from './hash.js';

// 日志工具
export {
  error,
  warn,
  info,
  debug,
  audit,
  zkpLog,
  performanceLog,
  loggerConfig,
} from './logger.js';

// 验证工具
export {
  isValidEthAddress,
  isValidHash,
  isValidTimestamp,
  isValidNumber,
  isValidStringLength,
  isValidIPFSCID,
  isValidArray,
  isValidObjectStructure,
  sanitizeString,
  isValidPublicSignals,
} from './validation.js';

// 常量
export {
  ERROR_CODES,
  TRUST_LEVELS,
  ROLES,
  CHANNEL_STATES,
  PROPOSAL_STATES,
  TIME_CONSTANTS,
  RATE_LIMITS,
  ZKP_CONFIG,
  PAGINATION,
  AMOUNT_CONFIG,
  LOG_MESSAGES,
} from './constants.js';

// 文件存储工具
export {
  generateUniqueFileName,
  saveABI,
  loadABI,
  saveProof,
  loadProof,
  deleteProof,
  savePublicInput,
  loadPublicInput,
  listFiles,
  getFileInfo,
  cleanupExpiredFiles,
  fileStorage,
} from './fileStorage.js';
