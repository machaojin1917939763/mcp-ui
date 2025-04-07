import axios from 'axios';
import { LLMService } from '../services/OpenAIService';
import { getDefaultModelId, getProviderById, getDefaultProviderId } from '../services/ModelProviders';
import type { MCPServerConfig } from '../composables/useMCPSettings';
import MCPService from '../services/MCPService';

// 定义STDIO服务器管理器类型
interface StdioManager {
  process: any; // 子进程
  connected: boolean;
  toolsPromise: Promise<any> | null;
}

interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
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
  private mcpServers: MCPServerConfig[] = [];
  private mcpTools: Record<string, Tool[]> = {}; // 每个MCP服务器的工具列表
  
  constructor() {
    // 从环境变量、localStorage和默认值获取配置
    const savedApiKey = localStorage.getItem('apiKey');
    this.apiKey = savedApiKey || import.meta.env.VITE_API_KEY || '';
    this.serverUrl = import.meta.env.VITE_MCP_SERVER_URL || 'http://localhost:3001'; // 更新默认端口为3001
    this.providerId = localStorage.getItem('providerId') || import.meta.env.VITE_MODEL_PROVIDER || 'openai';
    
    // 获取MCP服务器配置
    try {
      const savedMcpServers = localStorage.getItem('mcpServers');
      if (savedMcpServers) {
        this.mcpServers = JSON.parse(savedMcpServers);
      }
    } catch (error) {
      console.error('加载MCP服务器配置失败:', error);
    }
    
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
    console.log('初始化MCP客户端...');
    try {
      // 重新初始化LLM服务
      try {
        // 获取提供商ID
        this.providerId = localStorage.getItem('providerId') || getDefaultProviderId();
        
        // 尝试从提供商特定API密钥中获取API密钥
        const savedApiKeys = localStorage.getItem('providerApiKeys');
        let newApiKey = '';
        
        if (savedApiKeys) {
          const apiKeys = JSON.parse(savedApiKeys);
          if (apiKeys[this.providerId]) {
            newApiKey = apiKeys[this.providerId];
          }
        } else {
          // 回退到全局API密钥
          newApiKey = localStorage.getItem('apiKey') || this.apiKey;
        }
        
        // 如果API密钥有变化，更新它
        if (newApiKey && newApiKey !== this.apiKey) {
          console.log(`在initialize中发现新的API密钥，正在更新...`);
          // 立即使用setApiKey方法更新，确保LLMService也会更新
          this.setApiKey(newApiKey);
        }
        
        // 获取模型ID
        let modelId = '';
        const provider = getProviderById(this.providerId);
        
        // 处理自定义服务提供商
        let baseUrl = provider?.baseUrl || '';
        
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
        } else {
          // 使用标准模型ID
          modelId = localStorage.getItem('modelId') || getDefaultModelId(this.providerId);
        }
        
        // 创建LLM服务实例
        this.llmService = new LLMService({
          apiKey: this.apiKey, // 使用更新后的API密钥
          baseUrl: baseUrl,
          model: modelId,
          providerId: this.providerId
        });
        
        console.log(`初始化LLM服务成功 - 提供商: ${this.providerId}, 模型: ${modelId}, API密钥已设置`);
      } catch (error) {
        console.error('初始化LLM服务失败:', error);
      }
      
      // 更新MCP服务器配置
      try {
        const savedMcpServers = localStorage.getItem('mcpServers');
        if (savedMcpServers) {
          this.mcpServers = JSON.parse(savedMcpServers);
          console.log(`已从本地存储加载 ${this.mcpServers.length} 个MCP服务器配置`);
        }
      } catch (error) {
        console.error('加载MCP服务器配置失败:', error);
      }
      
      // 初始化工具数据结构，但不加载具体工具（只清空和准备）
      this.mcpTools = {};
      this.availableTools = [];
      
      // 连接所有启用的服务器并加载工具
      await this.connectEnabledServers();
      
      // 去重工具列表，确保没有重复工具
      this.deduplicateTools();
      
      // 更新LLM服务中的工具列表，确保所有工具都可用
      if (this.llmService && this.availableTools.length > 0) {
        console.log(`最终更新LLM服务工具列表，工具数量: ${this.availableTools.length}`);
        this.llmService.updateTools(this.availableTools);
      }
      
      console.log('使用的模型提供商:', this.providerId);
    } catch (error) {
      console.error('连接MCP服务端失败，将使用本地可用的工具:', error);
    }
  }
  
  /**
   * 连接所有启用的服务器并加载工具
   */
  private async connectEnabledServers(): Promise<void> {
    // 获取所有启用的服务器
    const enabledServers = this.mcpServers.filter(server => server.enabled);
    console.log(`尝试连接 ${enabledServers.length} 个启用的服务器...`);
    
    // 并行连接所有服务器
    const connectionPromises = enabledServers.map(async (server) => {
      try {
        console.log(`尝试连接服务器: ${server.id}`);
        await this.connectToServer(server);
        
        // 获取工具列表
        const tools = await this.getMcpServerTools(server.id);
        
        // 触发工具更新事件
        this.dispatchToolsUpdate(server.id, tools);
        
        return { 
          serverId: server.id, 
          success: true,
          toolCount: tools.length 
        };
      } catch (error) {
        console.error(`连接服务器 ${server.id} 失败:`, error);
        return { 
          serverId: server.id, 
          success: false, 
          error 
        };
      }
    });
    
    // 等待所有连接完成
    const results = await Promise.all(connectionPromises);
    
    // 汇总结果
    const succeeded = results.filter(r => r.success).map(r => r.serverId);
    const failed = results.filter(r => !r.success).map(r => r.serverId);
    
    // 计算总工具数
    const totalTools = results.reduce((sum, result) => {
      return sum + (result.success ? (result as any).toolCount : 0);
    }, 0);
    // 触发全局工具更新事件
    this.dispatchTotalToolsUpdate(totalTools);
    
    // 确保LLMService使用最新的工具列表
    if (this.llmService && this.availableTools.length > 0) {
      console.log(`更新LLM服务工具列表，工具数量: ${this.availableTools.length}`);
      // 这里不需要再次调用连接，只需要确保工具列表在LLM服务中更新
      this.llmService.updateTools(this.availableTools);
    } else {
      console.log(`无法更新LLM服务工具列表: ${this.llmService ? '无可用工具' : 'LLM服务未初始化'}`);
    }
  }
  
  /**
   * 派发工具更新事件
   * @param serverId 服务器ID
   * @param tools 工具列表
   */
  private dispatchToolsUpdate(serverId: string, tools: Tool[]): void {
    // 创建一个自定义事件
    const event = new CustomEvent('mcp-tools-update', {
      detail: {
        serverId,
        tools
      }
    });
    
    // 派发事件
    window.dispatchEvent(event);
    console.log(`已派发 ${serverId} 服务器工具更新事件，工具数量: ${tools.length}`);
  }
  
  /**
   * 派发工具总数更新事件
   * @param totalCount 工具总数
   */
  private dispatchTotalToolsUpdate(totalCount: number): void {
    // 创建一个自定义事件
    const event = new CustomEvent('mcp-total-tools-update', {
      detail: {
        totalCount
      }
    });
    
    // 派发事件
    window.dispatchEvent(event);
    console.log(`已派发工具总数更新事件，总工具数: ${totalCount}`);
  }
  
  /**
   * 获取特定MCP服务器的工具列表
   * @param serverId 服务器ID
   */
  async getMcpServerTools(serverId: string): Promise<Tool[]> {
    // 找到对应的服务器
    const server = this.mcpServers.find(s => s.id === serverId && s.enabled);
    if (!server) {
      throw new Error(`服务器 ${serverId} 不存在或未启用`);
    }

    try {
      // 根据服务器类型获取工具
      if (server.transport === 'sse') {
        // 从HTTP服务器获取工具
        const response = await axios.get(`${server.url}/tools`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        });
        
        let tools = response.data?.tools || [];
        
        // 转换工具格式
        tools = tools.map((tool:any) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: {
            type: 'object',
            properties: tool.inputSchema?.properties || {},
            required: tool.inputSchema?.required || []
          }
        }));
        
        // 更新工具缓存
        this.mcpTools[server.id] = tools;
        
        // 更新可用工具列表，保留原始工具名称
        this.availableTools = [...this.availableTools, ...tools];

        console.log(`可用工具列表更新，当前工具总数: ${this.availableTools.length}`);
        
        console.log(`从服务器 ${server.name} 获取了 ${tools.length} 个工具`);
        return tools;
      } else if (server.transport === 'stdio') {
        // 使用MCPService获取工具
        const tools = await MCPService.getTools(server.id);
        // 更新工具缓存
        this.mcpTools[server.id] = tools || [];
      

        // 更新可用工具列表，保留原始工具名称
        if (tools && tools.tools.length > 0) {
          this.availableTools = [...this.availableTools, ...tools.tools];
          console.log(`更新后可用工具总数: ${this.availableTools.length}`);
        } else {
          console.log(`服务器 ${server.name} 没有返回任何工具`);
        }
        
        return tools.tools;
      } else {
        throw new Error(`不支持的服务器传输类型: ${server.transport}`);
      }
    } catch (error) {
      console.error(`获取服务器 ${server.name} 的工具失败:`, error);
      throw error;
    }
  }

  
  /**
   * 获取当前使用的提供商ID
   */
  getProviderId(): string {
    return this.providerId;
  }

  /**
   * 获取当前使用的模型ID
   */
  getModel(): string {
    if (this.llmService) {
      return this.llmService.getModel();
    }
    
    // 根据提供商类型返回默认值
    if (this.providerId === 'custom') {
      return localStorage.getItem('customModelId') || '';
    } else {
      return localStorage.getItem('modelId') || getDefaultModelId(this.providerId);
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
        // 确保工具列表是最新的
        const tools = this.availableTools && this.availableTools.length > 0 ? this.availableTools : undefined;
        console.log(`处理用户查询，使用 ${tools?.length || 0} 个工具`);
        
        // 直接使用LLM服务
        const response = await this.llmService.sendMessage(
          this.messageHistory,
          tools
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
   * 调用工具并获取结果
   * @param toolName 工具名称
   * @param args 参数对象
   */
  async callTool(toolName: string, args: any): Promise<{result: any}> {
    try {
      try {
        const result = await MCPService.callTool({
          name: toolName,
          arguments: args
        });
        return { result };
      } catch (error) {
        console.error(`使用全局MCPService调用工具 ${toolName} 失败:`, error);
        
        // 尝试在各个服务器中查找此工具并调用
        for (const server of this.mcpServers.filter(s => s.enabled)) {
          const serverTools = this.mcpTools[server.id] || [];
          
          // 检查工具是否存在于此服务器
          if (Array.isArray(serverTools) && serverTools.some(tool => tool.name === toolName)) {
            console.log(`在服务器 ${server.id} 中找到工具 ${toolName}，尝试调用`);
            
            if (server.transport === 'sse') {
              // 发送HTTP请求
              const response = await axios.post(
                `${server.url}/tools/${toolName}`,
                args,
                {
                  headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                  }
                }
              );
              
              return { result: response.data };
            } else if (server.transport === 'stdio') {
              // 使用MCPService调用工具
              const result = await MCPService.callTool({
                name: toolName,
                arguments: args,
                clientName: server.id
              });
              return { result };
            }
          }
        }
        throw error;
      }
    } catch (error) {
      console.error('调用工具失败:', error);
      throw error;
    }
  }
  
  /**
   * 设置模型
   * @param modelId 模型ID
   */
  setModel(modelId: string): void {
    try {
      // 获取当前提供商 - 使用最新的providerId
      this.providerId = localStorage.getItem('providerId') || 'openai';
      
      // 获取当前提供商信息
      const provider = getProviderById(this.providerId);
      
      // 处理自定义服务提供商
      let baseUrl = provider?.baseUrl || '';
      
      if (this.providerId === 'custom') {
        baseUrl = localStorage.getItem('customBaseUrl') || '';
        
        // 保存自定义模型ID
        localStorage.setItem('customModelId', modelId);
      } else {
        // 保存标准模型ID
        localStorage.setItem('modelId', modelId);
      }

      // 更新API密钥（尝试从提供商特定API密钥中获取）
      const savedApiKeys = localStorage.getItem('providerApiKeys');
      if (savedApiKeys) {
        const apiKeys = JSON.parse(savedApiKeys);
        if (apiKeys[this.providerId]) {
          this.apiKey = apiKeys[this.providerId];
        }
      }
      
      // 更新LLM服务
      this.llmService = new LLMService({
        apiKey: this.apiKey,
        baseUrl: baseUrl,
        model: modelId,
        providerId: this.providerId
      });
      
      console.log(`已切换到模型: ${modelId}, 提供商: ${this.providerId}`);
    } catch (error) {
      console.error('切换模型失败:', error);
      throw new Error('切换模型失败');
    }
  }
  
  /**
   * 更新MCP服务器配置
   * @param servers MCP服务器配置列表
   */
  updateMcpServers(servers: MCPServerConfig[]): void {
    this.mcpServers = servers;
    this.refreshAvailableTools();
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

  /**
   * 获取可用工具列表
   */
  getAvailableTools(): Tool[] {
    return this.availableTools;
  }

  /**
   * 处理用户查询，使用LLM和可用工具，支持流式响应
   * @param query 用户查询
   * @param onChunk 处理响应块的回调函数
   * @param onToolCall 处理工具调用的回调函数
   */
  async processStreamQuery(
    query: string, 
    onChunk: (chunk: string) => void,
    onToolCall?: (toolCall: { name: string, params: any, result?: any, error?: string, success: boolean }) => void
  ): Promise<string> {
    // 添加用户消息到历史
    this.messageHistory.push({
      role: 'user',
      content: query
    });
    
    // 解码HTML实体函数
    const decodeHTMLEntities = (text: string): string => {
      const textArea = document.createElement('textarea');
      textArea.innerHTML = text;
      return textArea.value;
    };
    
    // 封装onChunk回调，确保解码HTML实体
    const safeOnChunk = (chunk: string) => {
      const decodedChunk = decodeHTMLEntities(chunk);
      onChunk(decodedChunk);
    };
    
    try {
      // 如果LLM服务已初始化，直接使用
      if (this.llmService) {
        // 确保工具列表是最新的
        const tools = this.availableTools && this.availableTools.length > 0 ? this.availableTools : undefined;
        console.log(`处理用户流式查询，使用 ${tools?.length || 0} 个工具`);
        
        // 使用流式API
        const response = await this.llmService.sendStreamMessage(
          this.messageHistory,
          safeOnChunk,
          tools
        );
        
        let isToolCall = false;
        
        try {
          // 检查是否为工具调用的JSON响应
          const responseData = JSON.parse(response);
          
          if (responseData.type === 'tool_calls' && responseData.tool_calls?.length > 0) {
            isToolCall = true;
            // 处理工具调用
            let finalResponse = '';
            
            for (const call of responseData.tool_calls) {
              try {
                // 通知准备调用工具
                const toolCallStart = `<tool-call name="${call.name}" status="pending"/>`;
                safeOnChunk(toolCallStart);
                
                // 执行工具调用
                let toolResult: any = null;
                let success = true;
                let errorMessage = '';
                
                try {
                  toolResult = await this.callTool(call.name, call.arguments);
                } catch (error) {
                  success = false;
                  errorMessage = (error as Error).message;
                  console.error(`调用工具 ${call.name} 失败:`, error);
                }
                
                // 生成工具调用结果标记
                const toolCallResult = success && toolResult
                  ? `<tool-call name="${call.name}" status="success" result="${encodeURIComponent(JSON.stringify(toolResult))}"/>`
                  : `<tool-call name="${call.name}" status="error" error="${encodeURIComponent(errorMessage || '未知错误')}"/>`;
                
                // 发送工具调用结果标记
                safeOnChunk(toolCallResult);
                
                // 如果提供了回调，通知工具调用结果
                if (onToolCall) {
                  onToolCall({
                    name: call.name,
                    params: call.arguments,
                    result: success ? toolResult.result : undefined,
                    error: success ? undefined : errorMessage,
                    success
                  });
                }
                
                // 添加到最终响应
                if (success && toolResult) {
                  finalResponse += `使用工具 ${call.name} 的结果：\n${JSON.stringify(toolResult.result, null, 2)}\n\n`;
                } else {
                  finalResponse += `调用工具 ${call.name} 失败：${errorMessage || '未知错误'}\n\n`;
                }
              } catch (error) {
                const errorMsg = `调用工具 ${call.name} 失败：${(error as Error).message}\n\n`;
                finalResponse += errorMsg;
                safeOnChunk(errorMsg);
              }
            }
            
            // 将工具调用结果添加到消息历史
            this.messageHistory.push({
              role: 'assistant',
              content: finalResponse
            });
            
            // 将工具调用结果发送回AI，并询问问题是否已解决
            this.messageHistory.push({
              role: 'user',
              content: `以上是工具调用的结果。请根据这些结果，回答我的问题：${query}。如果问题已解决，请说明；如果没有解决，请进一步解释或尝试其他方法。`
            });
            
            // 重新获取AI回复
            const followUpResponse = await this.llmService.sendStreamMessage(
              this.messageHistory,
              safeOnChunk,
              tools
            );
            
            // 将AI的后续回复添加到历史
            this.messageHistory.push({
              role: 'assistant',
              content: followUpResponse
            });
            
            return followUpResponse;
          }
        } catch (e) {
          // 不是JSON，说明是普通文本回复
          console.log('不是工具调用的JSON响应，是普通文本回复');
        }
        
        // 将助手回复添加到消息历史
        this.messageHistory.push({
          role: 'assistant',
          content: response
        });
        
        // 如果有工具调用但解析失败，或者没有工具调用，需要询问是否解决
        if (isToolCall) {
          // 这种情况在上面已处理
          return response;
        } else {
          // 无工具调用情况，直接返回原始响应
          return response;
        }
      } else {
        // 暂不支持服务端的流式响应，使用普通响应代替
        const responseText = await this.processQuery(query);
        safeOnChunk(responseText);
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
      
      safeOnChunk(errorMessage);
      return errorMessage;
    }
  }

  /**
   * 设置API密钥
   * @param apiKey 新的API密钥
   */
  setApiKey(apiKey: string): void {
    if (this.apiKey !== apiKey) {
      console.log('更新API密钥');
      this.apiKey = apiKey;
      
      // 如果LLM服务存在，更新其API密钥
      if (this.llmService) {
        this.llmService.setApiKey(apiKey);
      }
    }
  }
  
  /**
   * 连接到MCP服务器
   * @param serverConfig 服务器配置
   */
  async connectToServer(serverConfig: MCPServerConfig): Promise<void> {
    if (serverConfig.transport === 'stdio') {
      try {
        // 使用MCPService连接到服务器
        await MCPService.connectClient(serverConfig.id);
        console.log(`已连接到服务器 ${serverConfig.id}`);
        
        // 更新工具列表
        await this.getMcpServerTools(serverConfig.id);
      } catch (error) {
        console.error(`连接到服务器 ${serverConfig.id} 失败:`, error);
        throw error;
      }
    } else if (serverConfig.transport === 'sse') {
      // SSE类型服务器的连接逻辑保持不变
      try {
        // 获取工具列表
        await this.getMcpServerTools(serverConfig.id);
        console.log(`已连接到SSE服务器 ${serverConfig.id}`);
      } catch (error) {
        console.error(`连接到SSE服务器 ${serverConfig.id} 失败:`, error);
        throw error;
      }
    }
  }
  
  /**
   * 断开与MCP服务器的连接
   * @param serverId 服务器ID
   */
  async disconnectFromServer(serverId: string): Promise<void> {
    const server = this.mcpServers.find(s => s.id === serverId);
    if (!server) {
      throw new Error(`服务器 ${serverId} 不存在`);
    }
    
    // 创建匹配该服务器前缀的正则表达式
    const prefixRegex = new RegExp(`^${serverId}_`);
    
    if (server.transport === 'stdio') {
      try {
        // 使用MCPService断开服务器连接
        await MCPService.disconnectClient(serverId);
        console.log(`已断开与服务器 ${serverId} 的连接`);
        
        // 从可用工具列表中移除此服务器的工具 - 使用正则匹配前缀
        this.availableTools = this.availableTools.filter(tool => !prefixRegex.test(tool.name));
        
        // 清空缓存的工具列表
        this.mcpTools[serverId] = [];
      } catch (error) {
        console.error(`断开与服务器 ${serverId} 的连接失败:`, error);
        throw error;
      }
    } else if (server.transport === 'sse') {
      // SSE类型服务器无需特殊断开逻辑，只需清理工具
      this.availableTools = this.availableTools.filter(tool => !prefixRegex.test(tool.name));
      this.mcpTools[serverId] = [];
      console.log(`已断开与SSE服务器 ${serverId} 的连接`);
    }
  }
  
  /**
   * 刷新可用工具列表
   */
  async refreshAvailableTools(): Promise<void> {
    // 清空工具列表
    this.availableTools = [];
    this.mcpTools = {};
    
    // 重新连接服务器并加载工具
    await this.connectEnabledServers();
    
    // 尝试加载全局工具
    try {
      const globalTools = await MCPService.getTools();
      if (globalTools && globalTools.length > 0) {
        // 添加全局工具
        this.availableTools = [...this.availableTools, ...globalTools];
      }
    } catch (error) {
      console.error('刷新全局工具失败:', error);
    }
    
    // 执行最终去重
    this.deduplicateTools();
    
    console.log('已刷新所有可用工具');
  }

  /**
   * 去重并规范化工具列表
   * 这个方法可以在有需要时主动调用，清理掉重复的工具
   */
  public deduplicateTools(): void {
    if (!this.availableTools.length) return;
    
    console.log(`开始去重工具，当前工具数量: ${this.availableTools.length}`);
    
    // 使用Map进行去重，以工具名称为键
    const toolsMap = new Map<string, Tool>();
    
    for (const tool of this.availableTools) {
      // 以工具原始名称为键进行去重
      if (!toolsMap.has(tool.name)) {
        toolsMap.set(tool.name, tool);
      }
    }
    
    // 重建工具列表
    this.availableTools = Array.from(toolsMap.values());
    
    console.log(`工具去重完成，当前工具数量: ${this.availableTools.length}`);
  }

  /**
   * 刷新所有可用工具
   */
  async refreshTools(): Promise<void> {
    // 清空工具列表
    this.availableTools = [];
    this.mcpTools = {};
    
    // 重新连接服务器并加载工具
    await this.connectEnabledServers();
    
    // 尝试加载全局工具
    try {
      const globalTools = await MCPService.getTools();
      if (globalTools && globalTools.length > 0) {
        // 添加全局工具
        this.availableTools = [...this.availableTools, ...globalTools];
      }
    } catch (error) {
      console.error('刷新全局工具失败:', error);
    }
    
    // 执行最终去重
    this.deduplicateTools();
    
    console.log('已刷新所有可用工具');
  }
}