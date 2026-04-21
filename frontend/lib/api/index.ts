/**
 * API 模块统一导出
 * 
 * 导出内容：
 * - API 客户端（基础请求）
 * - 各业务模块 API
 * - 错误处理
 */

// 基础客户端
export {
  request,
  get,
  post,
  put,
  del,
  setAuthToken,
  clearAuthToken,
  getAuthToken,
  buildApiUrl,
  ApiError,
  API_CONFIG,
  API_ENDPOINTS,
  V1,
  V1Mount,
  V1Routes,
} from './client';

// 业务 API
export { default as identityApi, identityApi as identity } from './identity';
export { default as anonymousClaimApi, anonymousClaimApi as anonymousClaim } from './anonymousClaim';

// 类型导出
export type {
  IdentityCommitment,
  SBTInfo,
  RegisterResponse,
  CommitmentStatus,
  ClaimRecord,
} from './types';

export type {
  ZKProof,
  AnonymousClaimSubmitPayload,
  AnonymousClaimSubmitResult,
  AnonymousClaimStatus,
  MerkleProofResponse,
  RegisterCommitmentResult,
} from './anonymousClaim';

// 导出 client 中的类型
export type { RequestConfig } from './client';
