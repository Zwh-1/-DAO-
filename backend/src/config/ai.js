/**
 * AI 服务配置模块
 * 
 * 职责：
 * - 管理 AI 服务 API 密钥
 * - 配置 AI 模型参数
 * - 支持多 AI 服务提供器（DeepSeek、OpenAI）
 * 
 * 安全规范：
 * - API 密钥必须通过环境变量配置
 * - 禁止硬编码 API 密钥
 * - 支持降级为静态规则（当 API 密钥缺失时）
 * 
 * 使用场景：
 * - AI 智能客服
 * - AI 安全审计
 * - AI 参数推荐
 */

/**
 * AI 服务配置
 */
export const aiConfig = {
  // DeepSeek 配置
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    maxTokens: parseInt(process.env.DEEPSEEK_MAX_TOKENS, 10) || 2048,
    temperature: parseFloat(process.env.DEEPSEEK_TEMPERATURE) || 0.7,
  },
  
  // OpenAI 配置
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS, 10) || 2048,
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
  },
  
  // 默认服务提供器（优先级：DeepSeek > OpenAI）
  defaultProvider: process.env.AI_DEFAULT_PROVIDER || 'deepseek',
  
  // 超时配置（毫秒）
  timeout: parseInt(process.env.AI_TIMEOUT, 10) || 30000,
  
  // 重试配置
  maxRetries: parseInt(process.env.AI_MAX_RETRIES, 10) || 3,
};

/**
 * 检查 AI 服务是否可用
 * 
 * @returns {Object} 可用性检查结果
 */
export function checkAIAvailability() {
  const hasDeepSeek = !!aiConfig.deepseek.apiKey;
  const hasOpenAI = !!aiConfig.openai.apiKey;
  
  return {
    available: hasDeepSeek || hasOpenAI,
    providers: {
      deepseek: hasDeepSeek,
      openai: hasOpenAI,
    },
    defaultProvider: hasDeepSeek ? 'deepseek' : (hasOpenAI ? 'openai' : null),
    fallbackMode: !(hasDeepSeek || hasOpenAI), // 降级为静态规则
  };
}

/**
 * 获取 AI 服务配置
 * 
 * @param {'deepseek'|'openai'} provider - 服务提供器
 * @returns {Object} 配置对象
 */
export function getAIConfig(provider = aiConfig.defaultProvider) {
  if (provider === 'deepseek') {
    return aiConfig.deepseek;
  } else if (provider === 'openai') {
    return aiConfig.openai;
  } else {
    throw new Error(`[AI 配置] 未知的服务提供器：${provider}`);
  }
}

/**
 * AI 服务健康检查
 * 
 * @returns {Object} 健康检查结果
 */
export function healthCheck() {
  const availability = checkAIAvailability();
  const issues = [];
  
  if (!availability.available) {
    issues.push('未配置任何 AI 服务 API 密钥，将降级为静态规则');
  }
  
  if (aiConfig.timeout > 60000) {
    issues.push('AI 超时时间过长（> 60 秒）');
  }
  
  return {
    healthy: issues.length === 0,
    availability,
    issues,
    config: {
      defaultProvider: aiConfig.defaultProvider,
      timeout: aiConfig.timeout,
      maxRetries: aiConfig.maxRetries,
    },
  };
}

/**
 * 导出配置对象
 */
export const aiConfigExport = {
  aiConfig,
  checkAIAvailability,
  getAIConfig,
  healthCheck,
};
