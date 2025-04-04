/**
 * 模型提供商和模型配置信息
 */

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  contextLength: number;
  supportsTools: boolean;
}

export interface ProviderInfo {
  id: string;
  name: string;
  baseUrl: string;
  models: ModelInfo[];
}

/**
 * 支持的模型提供商列表
 */
export const MODEL_PROVIDERS: ProviderInfo[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        description: '能力强、速度快、成本低的智能模型',
        contextLength: 16000,
        supportsTools: true
      },
      {
        id: 'gpt-3.5-turbo-0125',
        name: 'GPT-3.5 Turbo (0125 版本)',
        description: 'GPT-3.5的最新版本，优化了工具使用能力',
        contextLength: 16000,
        supportsTools: true
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        description: '强大的大语言模型，理解和生成能力更强',
        contextLength: 128000,
        supportsTools: true
      },
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'OpenAI最新的多模态模型',
        contextLength: 128000,
        supportsTools: true
      }
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: [
      {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        description: '深度求索对话模型',
        contextLength: 8192,
        supportsTools: true
      },
      {
        id: 'deepseek-coder',
        name: 'DeepSeek Coder',
        description: '针对代码优化的大型语言模型',
        contextLength: 16000,
        supportsTools: true
      }
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    models: [
      {
        id: 'claude-3-opus',
        name: 'Claude 3 Opus',
        description: 'Anthropic最强大的模型，适合高复杂度任务',
        contextLength: 200000,
        supportsTools: true
      },
      {
        id: 'claude-3-sonnet',
        name: 'Claude 3 Sonnet',
        description: '平衡性能和速度的中档模型',
        contextLength: 180000,
        supportsTools: true
      },
      {
        id: 'claude-3-haiku',
        name: 'Claude 3 Haiku',
        description: '快速响应的轻量级模型',
        contextLength: 150000,
        supportsTools: true
      }
    ]
  },
  {
    id: 'custom',
    name: '自定义',
    baseUrl: '',
    models: [
      {
        id: 'custom',
        name: '自定义模型',
        description: '手动指定模型ID和基础URL',
        contextLength: 0,
        supportsTools: true
      }
    ]
  }
];

/**
 * 根据提供商ID获取提供商信息
 */
export function getProviderById(providerId: string): ProviderInfo | undefined {
  return MODEL_PROVIDERS.find(provider => provider.id === providerId);
}

/**
 * 根据提供商ID和模型ID获取模型信息
 */
export function getModelInfo(providerId: string, modelId: string): ModelInfo | undefined {
  const provider = getProviderById(providerId);
  if (!provider) return undefined;
  return provider.models.find(model => model.id === modelId);
}

/**
 * 获取默认提供商ID
 */
export function getDefaultProviderId(): string {
  return 'openai';
}

/**
 * 获取默认模型ID
 */
export function getDefaultModelId(providerId: string): string {
  const provider = getProviderById(providerId);
  if (!provider || provider.models.length === 0) return '';
  // 为不同提供商选择推荐的默认模型
  switch (providerId) {
    case 'openai':
      return 'gpt-3.5-turbo';
    case 'anthropic':
      return 'claude-3-sonnet';
    case 'deepseek':
      return 'deepseek-chat';
    default:
      return provider.models[0].id;
  }
} 