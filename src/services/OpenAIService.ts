import OpenAI from 'openai';
import { getProviderById } from './ModelProviders';

interface LLMServiceOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  providerId?: string;
}

export class LLMService {
  private client: OpenAI;
  private model: string;
  private baseURL: string;
  private providerId: string;
  
  constructor(options?: LLMServiceOptions) {
    // 获取API密钥，优先使用传入的选项
    const apiKey = options?.apiKey || import.meta.env.VITE_API_KEY;
    
    if (!apiKey) {
      console.error('API密钥未设置');
      throw new Error('API密钥未设置，请在设置中配置API密钥');
    }
    
    // 确定提供商ID
    this.providerId = options?.providerId || localStorage.getItem('providerId') || import.meta.env.VITE_MODEL_PROVIDER || 'openai';
    
    // 获取提供商信息
    const provider = getProviderById(this.providerId);
    
    // 获取baseURL配置
    if (this.providerId === 'custom') {
      // 自定义提供商使用传入的baseUrl或localStorage中的customBaseUrl
      this.baseURL = options?.baseUrl || localStorage.getItem('customBaseUrl') || '';
    } else {
      // 其他提供商使用传入的baseUrl或提供商默认baseUrl
      this.baseURL = options?.baseUrl || (provider?.baseUrl || 'https://api.openai.com/v1');
    }
    
    console.log(`使用API基础URL: ${this.baseURL}`);
    
    // 初始化OpenAI实例
    this.client = new OpenAI({
      apiKey,
      baseURL: this.baseURL,
      dangerouslyAllowBrowser: true // 在浏览器环境中使用
    });
    
    // 使用指定的模型或默认值
    if (this.providerId === 'custom') {
      this.model = options?.model || localStorage.getItem('customModelId') || 'gpt-3.5-turbo';
    } else {
      this.model = options?.model || localStorage.getItem('modelId') || import.meta.env.VITE_OPENAI_MODEL || 'gpt-3.5-turbo';
    }
    
    console.log(`使用模型: ${this.model}`);
  }
  
  /**
   * 获取当前使用的基础URL
   */
  getBaseURL(): string {
    return this.baseURL;
  }
  
  /**
   * 获取当前使用的模型
   */
  getModel(): string {
    return this.model;
  }
  
  /**
   * 获取当前使用的提供商ID
   */
  getProviderId(): string {
    return this.providerId;
  }
  
  /**
   * 发送消息到LLM服务并获取回复
   * @param messages 消息历史
   * @param tools 可用工具列表
   */
  async sendMessage(
    messages: Array<{role: 'user' | 'assistant' | 'system', content: string}>,
    tools?: Array<{name: string, description: string, inputSchema: any}>
  ): Promise<string> {
    try {
      // 准备工具定义
      const formattedTools = tools?.map(tool => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema || {
            type: 'object',
            properties: {},
            required: []
          }
        }
      }));
      
      // 调用Chat Completions API
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        tools: formattedTools,
        temperature: 0.7,
        max_tokens: 1000
      });
      
      // 获取响应
      const responseMessage = response.choices[0].message;
      
      // 检查是否有工具调用
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        return JSON.stringify({
          type: 'tool_calls',
          tool_calls: responseMessage.tool_calls.map(call => ({
            name: call.function.name,
            arguments: JSON.parse(call.function.arguments)
          }))
        });
      }
      
      return responseMessage.content || '无响应';
    } catch (error) {
      console.error('调用API出错:', error);
      throw new Error('调用API出错: ' + (error as Error).message);
    }
  }
} 