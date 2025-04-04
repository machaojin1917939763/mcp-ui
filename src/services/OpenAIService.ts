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
  
  /**
   * 发送消息到LLM服务并获取流式回复
   * @param messages 消息历史
   * @param tools 可用工具列表
   * @param onChunk 接收数据块的回调函数
   */
  async sendStreamMessage(
    messages: Array<{role: 'user' | 'assistant' | 'system', content: string}>,
    onChunk: (chunk: string) => void,
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
      
      // 调用Chat Completions API，启用流式响应
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages,
        tools: formattedTools,
        temperature: 0.7,
        max_tokens: 1000,
        stream: true,
      });
      
      let fullResponse = '';
      let toolCallsData: any[] = [];
      let isToolCall = false;
      
      // 处理流式响应
      for await (const chunk of stream) {
        // 获取当前块的内容
        const content = chunk.choices[0]?.delta?.content || '';
        const toolCalls = chunk.choices[0]?.delta?.tool_calls || [];
        
        // 如果有工具调用
        if (toolCalls.length > 0) {
          isToolCall = true;
          
          // 将工具调用数据添加到集合中
          toolCalls.forEach(toolCall => {
            if (!toolCallsData.some(t => t.index === toolCall.index)) {
              toolCallsData.push({
                index: toolCall.index,
                id: toolCall.id,
                type: toolCall.type,
                function: {
                  name: toolCall.function?.name || '',
                  arguments: toolCall.function?.arguments || ''
                }
              });
            } else {
              // 更新现有工具调用的参数
              const existingTool = toolCallsData.find(t => t.index === toolCall.index);
              if (existingTool && toolCall.function?.arguments) {
                existingTool.function.arguments += toolCall.function.arguments;
              }
            }
          });
        }
        
        // 如果有文本内容，添加到完整响应
        if (content) {
          fullResponse += content;
          onChunk(content);
        }
      }
      
      // 如果是工具调用，返回工具调用数据的JSON
      if (isToolCall) {
        // 格式化工具调用数据
        const formattedToolCalls = toolCallsData.map(call => {
          try {
            // 尝试解析JSON参数
            return {
              name: call.function.name,
              arguments: JSON.parse(call.function.arguments)
            };
          } catch (e) {
            // 如果解析失败，返回原始字符串
            return {
              name: call.function.name,
              arguments: call.function.arguments
            };
          }
        });
        
        const toolCallResponse = JSON.stringify({
          type: 'tool_calls',
          tool_calls: formattedToolCalls
        });
        
        // 将工具调用响应传递给回调
        onChunk(toolCallResponse);
        return toolCallResponse;
      }
      
      return fullResponse;
    } catch (error) {
      console.error('调用流式API出错:', error);
      const errorMessage = '调用API出错: ' + (error as Error).message;
      onChunk(errorMessage);
      throw new Error(errorMessage);
    }
  }
} 