/**
 * 文件上传工具库
 * 
 * 职责：
 * - 文件类型白名单校验
 * - 文件大小限制
 * - 文件名安全校验（防止路径遍历）
 * - JWT 认证头读取
 * 
 * 安全约束：
 * - 严禁上传可执行文件（.exe, .js, .bat 等）
 * - 双重校验：MIME 类型 + 扩展名
 * - 文件名哈希化存储
 */

/** 允许的文件 MIME 类型白名单 */
export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/** 允许的文件扩展名白名单 */
export const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic',
  '.doc', '.docx',
]);

/** 单文件最大大小（10MB） */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** 单次上传最大文件数 */
export const MAX_FILE_COUNT = 5;

/**
 * 文件校验错误类型
 */
export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileValidationError';
  }
}

/**
 * 校验单个文件
 * 
 * @param file - 待校验的文件对象
 * @throws FileValidationError 如果文件不符合要求
 */
export function validateFile(file: File): void {
  // 校验 MIME 类型
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new FileValidationError(
      `不支持的文件类型：${file.name}（${file.type || '未知类型'}）`
    );
  }

  // 校验扩展名
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new FileValidationError(
      `不支持的文件扩展名：${file.name}`
    );
  }

  // 校验文件大小
  if (file.size > MAX_FILE_SIZE) {
    throw new FileValidationError(
      `文件过大：${file.name}（${(file.size / 1024 / 1024).toFixed(1)}MB，最大 ${MAX_FILE_SIZE / 1024 / 1024}MB）`
    );
  }

  // 校验文件名安全性（防止路径遍历攻击）
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    throw new FileValidationError(
      `文件名包含非法字符：${file.name}`
    );
  }
}

/**
 * 批量校验文件
 * 
 * @param files - 待校验的文件数组
 * @throws FileValidationError 如果任一文件不符合要求
 */
export function validateFiles(files: File[]): void {
  if (files.length === 0) {
    throw new FileValidationError('未选择任何文件');
  }

  if (files.length > MAX_FILE_COUNT) {
    throw new FileValidationError(
      `文件数量过多：${files.length}（最多 ${MAX_FILE_COUNT} 个）`
    );
  }

  for (const file of files) {
    validateFile(file);
  }
}

/**
 * 从 localStorage 读取 JWT token
 * 
 * @returns JWT token 字符串，或 null
 */
export function readJwtToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const raw = window.localStorage.getItem('trustaid-auth');
    if (!raw) return null;
    
    const parsed = JSON.parse(raw) as { state?: { token?: string } };
    return parsed.state?.token || null;
  } catch {
    return null;
  }
}

/**
 * 构建带认证的请求头
 * 
 * @param extraHeaders - 额外的请求头
 * @returns 完整的请求头对象
 */
export function buildAuthHeaders(
  extraHeaders?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = { ...extraHeaders };
  
  const token = readJwtToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

/**
 * 上传文件至后端
 * 
 * @param endpoint - 上传接口路径（如 /v1/claim/:claimId/evidence）
 * @param files - 文件数组
 * @returns 后端返回的证据标识（CID 或 URL）
 * @throws Error 如果上传失败
 */
export async function uploadFiles(
  endpoint: string,
  files: File[],
): Promise<string> {
  // 校验文件
  validateFiles(files);

  // 构建 FormData
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  // 发送请求
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: formData,
    // 注意：不要设置 Content-Type，让浏览器自动设置 multipart/form-data 边界
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: '上传失败' }));
    throw new Error(error.message || `上传失败（HTTP ${response.status}）`);
  }

  const data = await response.json();
  return data.evidenceCid || data.evidenceUrl || 'uploaded';
}

/**
 * 安全上传文件（带降级处理）
 * 
 * @param endpoint - 上传接口路径
 * @param files - 文件数组
 * @param fallback - 上传失败时的降级返回值（默认 'pending'）
 * @returns 证据标识或降级值
 */
export async function uploadFilesWithFallback(
  endpoint: string,
  files: File[],
  fallback: string = 'pending',
): Promise<string> {
  if (files.length === 0) return fallback;

  try {
    return await uploadFiles(endpoint, files);
  } catch (err) {
    console.warn('[uploadFilesWithFallback] 上传失败，降级为', fallback, err);
    return fallback;
  }
}
