import axios from 'axios';
import { LLMService } from '../services/OpenAIService';
import { getDefaultModelId, getProviderById } from '../services/ModelProviders';

interface Tool {
  name: string;
  description: string;
  inputSchema: any;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class MCPClient {
  private apiKey: string = '';
  private serverUrl: string = '';
  private availableTools: Tool[] = [];
  private providerId: string = 'openai'; // 默认使用OpenAI
  private llmService: LLMService | null = null;
  private messageHistory: Message[] = [];
  
  constructor() {
    // 从环境变量、localStorage和默认值获取配置
    const savedApiKey = localStorage.getItem('apiKey');
    this.apiKey = savedApiKey || import.meta.env.VITE_API_KEY || '';
    this.serverUrl = import.meta.env.VITE_MCP_SERVER_URL || 'http://localhost:3000';
    this.providerId = localStorage.getItem('providerId') || import.meta.env.VITE_MODEL_PROVIDER || 'openai';
    
    // 检查API Key是否存在
    if (!this.apiKey) {
      console.warn('API密钥未设置，请在设置中配置API密钥');
    }
    
    // 初始化LLM服务
    try {
      // 获取保存的配置
      const savedModelId = localStorage.getItem('modelId') || getDefaultModelId(this.providerId);
      const provider = getProviderById(this.providerId);
      
      // 处理自定义服务提供商
      let baseUrl = provider?.baseUrl || '';
      let modelId = savedModelId || '';
      
      if (this.providerId === 'custom') {
        baseUrl = localStorage.getItem('customBaseUrl') || '';
        modelId = localStorage.getItem('customModelId') || '';
      }
      
      // 创建LLM服务实例
      this.llmService = new LLMService({
        apiKey: this.apiKey,
        baseUrl: baseUrl,
        model: modelId,
        providerId: this.providerId
      });
      
      console.log(`初始化LLM服务成功 - 提供商: ${this.providerId}, 模型: ${modelId}`);
    } catch (error) {
      console.error('初始化LLM服务失败:', error);
    }
    
    // 添加系统消息
    this.messageHistory.push({
      role: 'system',
      content: '你是一个基于MCP协议的智能助手，可以调用各种工具帮助用户完成任务。请提供简洁、有用的回复。'
    });
  }
  
  /**
   * 初始化MCP客户端，连接到服务端并获取可用工具
   */
  async initialize(): Promise<void> {
    try {
      // 重新初始化LLM服务
      try {
        // 获取保存的配置
        const savedModelId = localStorage.getItem('modelId') || getDefaultModelId(this.providerId);
        const provider = getProviderById(this.providerId);
        
        // 处理自定义服务提供商
        let baseUrl = provider?.baseUrl || '';
        let modelId = savedModelId || '';
        
        if (this.providerId === 'custom') {
          baseUrl = localStorage.getItem('customBaseUrl') || '';
          modelId = localStorage.getItem('customModelId') || '';
          
          // 如果没有找到自定义模型ID，尝试从自定义模型列表中获取第一个
          if (!modelId) {
            try {
              const customModels = JSON.parse(localStorage.getItem('customModels') || '[]');
              if (customModels.length > 0) {
                modelId = customModels[0].id;
              }
            } catch (e) {
              console.error('解析自定义模型列表失败', e);
            }
          }
        }
        
        // 创建LLM服务实例
        this.llmService = new LLMService({
          apiKey: this.apiKey,
          baseUrl: baseUrl,
          model: modelId,
          providerId: this.providerId
        });
        
        console.log(`初始化LLM服务成功 - 提供商: ${this.providerId}, 模型: ${modelId}`);
      } catch (error) {
        console.error('初始化LLM服务失败:', error);
      }
      
      // 连接到MCP服务端获取工具
      const response = await axios.get(`${this.serverUrl}/tools`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      
      // 保存可用工具列表
      this.availableTools = response.data?.tools || [];
      console.log('已连接到MCP服务端，可用工具:', this.availableTools.map(tool => tool.name));
      console.log('使用的模型提供商:', this.providerId);
    } catch (error) {
      console.error('连接MCP服务端失败，将使用本地模拟工具:', error);
      // 使用模拟工具列表
      this.availableTools = [
        {
          name: 'get_weather',
          description: '获取指定城市的天气信息',
          inputSchema: {
            type: 'object',
            properties: {
              city: {
                type: 'string',
                description: '城市名称'
              }
            },
            required: ['city']
          }
        },
        {
          name: 'get_news',
          description: '获取最新新闻',
          inputSchema: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                description: '新闻类别，如：科技、体育、财经等'
              }
            }
          }
        }
      ];
    }
  }
  
  /**
   * 处理用户查询，使用LLM和可用工具
   */
  async processQuery(query: string): Promise<string> {
    // 添加用户消息到历史
    this.messageHistory.push({
      role: 'user',
      content: query
    });
    
    try {
      // 如果LLM服务已初始化，直接使用
      if (this.llmService) {
        // 直接使用LLM服务
        const response = await this.llmService.sendMessage(
          this.messageHistory,
          this.availableTools
        );
        
        try {
          // 检查是否为工具调用的JSON响应
          const responseData = JSON.parse(response);
          
          if (responseData.type === 'tool_calls' && responseData.tool_calls?.length > 0) {
            // 处理工具调用
            let finalResponse = '';
            
            for (const call of responseData.tool_calls) {
              try {
                const toolResult = await this.callTool(call.name, call.arguments);
                finalResponse += `使用工具 ${call.name} 的结果：\n${JSON.stringify(toolResult.result, null, 2)}\n\n`;
              } catch (error) {
                finalResponse += `调用工具 ${call.name} 失败：${(error as Error).message}\n\n`;
              }
            }
            
            // 将工具调用结果添加到消息历史
            this.messageHistory.push({
              role: 'assistant',
              content: finalResponse
            });
            
            return finalResponse;
          }
        } catch (e) {
          // 不是JSON，说明是普通文本回复
        }
        
        // 将助手回复添加到消息历史
        this.messageHistory.push({
          role: 'assistant',
          content: response
        });
        
        return response;
      } else {
        // 使用服务端
        const response = await axios.post(
          `${this.serverUrl}/chat`,
          {
            query,
            tools: this.availableTools.map(tool => tool.name),
            provider: this.providerId
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        const responseText = response.data?.response || '无响应';
        
        // 将助手回复添加到消息历史
        this.messageHistory.push({
          role: 'assistant',
          content: responseText
        });
        
        return responseText;
      }
    } catch (error) {
      console.error('处理查询失败:', error);
      const errorMessage = '处理查询时出错: ' + (error as Error).message;
      
      // 将错误消息添加到历史
      this.messageHistory.push({
        role: 'assistant',
        content: errorMessage
      });
      
      throw new Error(errorMessage);
    }
  }
  
  /**
   * 调用MCP工具
   */
  async callTool(name: string, args: Record<string, any>): Promise<any> {
    try {
      // 尝试通过服务端调用工具
      const response = await axios.post(
        `${this.serverUrl}/tools/${name}`,
        args,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error(`通过服务端调用工具 ${name} 失败:`, error);
      console.log('使用模拟工具响应');
      
      // 使用模拟响应
      if (name === 'get_weather') {
        const city = args.city || '未知城市';
        return {
          result: {
            city,
            temperature: Math.floor(Math.random() * 30) + 5,
            condition: ['晴朗', '多云', '小雨', '阴天'][Math.floor(Math.random() * 4)],
            humidity: Math.floor(Math.random() * 60) + 30,
            wind: Math.floor(Math.random() * 30) + 5
          }
        };
      } else if (name === 'get_news') {
        const category = args.category || '综合';
        return {
          result: [
            `${category}新闻1: 这是一条模拟的${category}新闻`,
            `${category}新闻2: 这是另一条模拟的${category}新闻`,
            `${category}新闻3: 这是第三条模拟的${category}新闻`
          ]
        };
      }
      
      throw new Error(`不支持的工具: ${name}`);
    }
  }
  
  /**
   * 设置模型
   * @param modelId 模型ID
   */
  setModel(modelId: string): void {
    try {
      // 获取当前提供商信息
      const provider = getProviderById(this.providerId);
      
      // 处理自定义服务提供商
      let baseUrl = provider?.baseUrl || '';
      
      if (this.providerId === 'custom') {
        baseUrl = localStorage.getItem('customBaseUrl') || '';
      }
      
      // 更新LLM服务
      this.llmService = new LLMService({
        apiKey: this.apiKey,
        baseUrl: baseUrl,
        model: modelId,
        providerId: this.providerId
      });
      
      console.log(`已切换到模型: ${modelId}`);
    } catch (error) {
      console.error('切换模型失败:', error);
      throw new Error('切换模型失败');
    }
  }
  
  /**
   * 清除消息历史
   */
  clearHistory(): void {
    this.messageHistory = [this.messageHistory[0]]; // 保留系统消息
  }

  /**
   * 添加消息到历史记录
   */
  addMessageToHistory(message: Message): void {
    this.messageHistory.push(message);
  }
} 