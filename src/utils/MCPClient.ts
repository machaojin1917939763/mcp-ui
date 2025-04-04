import axios from 'axios';
import { LLMService } from '../services/OpenAIService';
import { getDefaultModelId, getProviderById } from '../services/ModelProviders';
import type { MCPServerConfig } from '../composables/useMCPSettings';

// 定义STDIO服务器管理器类型
interface StdioManager {
  process: any; // 子进程
  connected: boolean;
  toolsPromise: Promise<any> | null;
}

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
  private mcpServers: MCPServerConfig[] = [];
  private mcpTools: Record<string, Tool[]> = {}; // 每个MCP服务器的工具列表
  private stdioManagers: Record<string, StdioManager> = {}; // STDIO服务器管理器
  
  constructor() {
    // 从环境变量、localStorage和默认值获取配置
    const savedApiKey = localStorage.getItem('apiKey');
    this.apiKey = savedApiKey || import.meta.env.VITE_API_KEY || '';
    this.serverUrl = import.meta.env.VITE_MCP_SERVER_URL || 'http://localhost:3000';
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
      
      // 初始化MCP工具
      await this.initializeMcpTools();
      
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
      console.error('连接MCP服务端失败，将使用本地可用的工具:', error);
    }
  }
  
  /**
   * 初始化所有启用的MCP服务器的工具
   */
  private async initializeMcpTools(): Promise<void> {
    // 清空工具列表
    this.mcpTools = {};
    
    // 获取所有启用的MCP服务器
    const enabledServers = this.mcpServers.filter(server => server.enabled);
    
    for (const server of enabledServers) {
      try {
        console.log(`正在从服务器 ${server.name} 获取工具...`);
        
        if (server.transport === 'sse') {
          // 从HTTP服务器获取工具
          const response = await axios.get(`${server.url}/tools`, {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`
            }
          });
          
          const tools = response.data?.tools || [];
          this.mcpTools[server.id] = tools;
          
          // 更新可用工具列表，先移除旧的同服务器工具
          this.availableTools = this.availableTools.filter(tool => !tool.name.startsWith(`${server.id}.`) && !tool.name.startsWith(`${server.id}_`));
          
          // 添加新工具
          tools.forEach((tool: Tool) => {
            this.availableTools.push({
              ...tool,
              name: `${server.id}_${tool.name}`,
              description: `[${server.name}] ${tool.description}`
            });
          });
          
          console.log(`从服务器 ${server.name} 获取了 ${tools.length} 个工具`);
        } else if (server.transport === 'stdio') {
          // STDIO类型服务器的工具获取
          console.log(`STDIO类型服务器 ${server.name} 的工具将在首次调用时加载`);
          
          // 初始化为空工具列表
          this.mcpTools[server.id] = [];
          
          // 对于STDIO服务器，我们无法在初始化时获取工具列表
          // 这里不再使用模拟工具，而是将实际工具保持为空数组
          // 工具将在用户首次调用时由服务器提供
          
          // 仍然将空的工具列表添加到记录中以表明服务器已配置
          console.log(`STDIO服务器 ${server.name} 的工具将在首次调用时可用`);
        }
      } catch (error) {
        console.error(`从服务器 ${server.name} 获取工具失败:`, error);
        // 错误情况下，设置为空工具列表而不是模拟工具
        this.mcpTools[server.id] = [];
      }
    }
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
        
        const tools = response.data?.tools || [];
        
        // 更新工具缓存
        this.mcpTools[server.id] = tools;
        
        // 更新可用工具列表，先移除旧的同服务器工具
        this.availableTools = this.availableTools.filter(tool => !tool.name.startsWith(`${server.id}.`) && !tool.name.startsWith(`${server.id}_`));
        
        // 添加新工具
        tools.forEach((tool: Tool) => {
          this.availableTools.push({
            ...tool,
            name: `${server.id}_${tool.name}`,
            description: `[${server.name}] ${tool.description}`
          });
        });
        
        console.log(`从服务器 ${server.name} 获取了 ${tools.length} 个工具`);
        return tools;
      } else if (server.transport === 'stdio') {
        // 尝试连接并获取STDIO服务器的工具
        return await this.initializeStdioServer(server);
      }
      
      return [];
    } catch (error) {
      console.error(`从服务器 ${server.id} 获取工具失败:`, error);
      throw new Error(`无法获取服务器 ${server.id} 的工具: ${(error as Error).message}`);
    }
  }

  /**
   * 初始化STDIO服务器并获取工具列表
   * @param server STDIO服务器配置
   * @returns 工具列表
   */
  private async initializeStdioServer(server: MCPServerConfig): Promise<Tool[]> {
    if (!server.command) {
      throw new Error(`服务器 ${server.id} 缺少命令配置`);
    }

    // 检查是否已经有正在处理的工具获取请求
    if (this.stdioManagers[server.id]?.toolsPromise) {
      try {
        // 等待并返回已有的工具获取结果
        const result = await this.stdioManagers[server.id].toolsPromise;
        return result;
      } catch (error) {
        // 如果之前的请求失败，继续尝试新的请求
        console.error(`之前的工具获取请求失败，重试:`, error);
      }
    }

    // 创建新的工具获取Promise
    const toolsPromise = new Promise<Tool[]>(async (resolve, reject) => {
      try {
        // 这里需要引入子进程模块来执行命令
        // 在浏览器环境中无法直接使用子进程，需要通过后端API
        // 下面代码是模拟实现，实际需要通过后端实现
        
        console.log(`正在尝试启动STDIO服务器 ${server.id}`);
        console.log(`命令: ${server.command} ${server.args?.join(' ') || ''}`);
        
        // 模拟延迟，实际应该发送请求给后端启动进程
        await new Promise(r => setTimeout(r, 1000));
        
        // 假设我们从命令行参数或服务器ID判断工具类型
        const serverIdLower = server.id.toLowerCase();
        const argsStr = (server.args || []).join(' ').toLowerCase();
        
        let tools: Tool[] = [];
        
        if (serverIdLower.includes('weather') || argsStr.includes('weather')) {
          // 天气工具
          tools = [{
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
          }];
        } else if (serverIdLower.includes('file') || argsStr.includes('filesystem')) {
          // 文件系统工具
          tools = [
            {
              name: 'list_directory',
              description: '列出指定目录的内容',
              inputSchema: {
                type: 'object',
                properties: {
                  path: {
                    type: 'string',
                    description: '目录路径'
                  }
                },
                required: ['path']
              }
            },
            {
              name: 'read_file',
              description: '读取指定文件的内容',
              inputSchema: {
                type: 'object',
                properties: {
                  path: {
                    type: 'string',
                    description: '文件路径'
                  }
                },
                required: ['path']
              }
            }
          ];
        } else {
          // 默认假设是简单工具
          tools = [{
            name: 'echo',
            description: '回显输入的内容',
            inputSchema: {
              type: 'object',
              properties: {
                text: {
                  type: 'string',
                  description: '要回显的文本'
                }
              },
              required: ['text']
            }
          }];
        }
        
        // 更新工具缓存
        this.mcpTools[server.id] = tools;
        
        // 更新可用工具列表，先移除旧的同服务器工具
        this.availableTools = this.availableTools.filter(tool => !tool.name.startsWith(`${server.id}.`) && !tool.name.startsWith(`${server.id}_`));
        
        // 添加新工具
        tools.forEach((tool: Tool) => {
          this.availableTools.push({
            ...tool,
            name: `${server.id}_${tool.name}`,
            description: `[${server.name}] ${tool.description}`
          });
        });
        
        console.log(`从STDIO服务器 ${server.name} 获取了 ${tools.length} 个工具`);
        resolve(tools);
      } catch (error) {
        console.error(`初始化STDIO服务器 ${server.id} 失败:`, error);
        reject(error);
      }
    });

    // 保存Promise以便重用
    this.stdioManagers[server.id] = {
      process: null,
      connected: false,
      toolsPromise
    };

    try {
      return await toolsPromise;
    } catch (error) {
      // 清除失败的Promise
      if (this.stdioManagers[server.id]?.toolsPromise === toolsPromise) {
        this.stdioManagers[server.id].toolsPromise = null;
      }
      throw error;
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
   * 调用工具并获取结果
   * @param toolName 工具名称，格式为 "serverId_toolName"
   * @param args 参数对象
   */
  async callTool(toolName: string, args: any): Promise<{result: any}> {
    try {
      // 解析工具名称，支持两种格式：serverId.toolName 和 serverId_toolName
      let serverId: string;
      let actualToolName: string;
      
      if (toolName.includes('_')) {
        // 新格式：serverId_toolName
        [serverId, actualToolName] = toolName.split('_', 2);
      } else if (toolName.includes('.')) {
        // 旧格式：serverId.toolName
        [serverId, actualToolName] = toolName.split('.', 2);
      } else {
        throw new Error(`无效的工具名称格式: ${toolName}`);
      }
      
      // 找到对应的服务器
      const server = this.mcpServers.find(s => s.id === serverId && s.enabled);
      if (!server) {
        throw new Error(`找不到服务器 ${serverId} 或服务器未启用`);
      }
      
      // 根据服务器类型调用工具
      if (server.transport === 'sse') {
        // 发送HTTP请求
        const response = await axios.post(
          `${server.url}/tools/${actualToolName}`,
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
        // 调用STDIO服务器
        return await this.callStdioTool(server, actualToolName, args);
      }
      
      throw new Error(`不支持的服务器类型: ${server.transport}`);
    } catch (error) {
      console.error('调用工具失败:', error);
      throw new Error(`调用工具 ${toolName} 失败: ${(error as Error).message}`);
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
   * 更新MCP服务器配置
   * @param servers MCP服务器配置列表
   */
  updateMcpServers(servers: MCPServerConfig[]): void {
    this.mcpServers = servers;
    this.initializeMcpTools();
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
        // 使用流式API
        const response = await this.llmService.sendStreamMessage(
          this.messageHistory,
          safeOnChunk,
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
   * 调用STDIO服务器的工具
   * @param server STDIO服务器配置
   * @param toolName 工具名称
   * @param args 参数对象
   */
  private async callStdioTool(server: MCPServerConfig, toolName: string, args: any): Promise<{result: any}> {
    console.log(`调用STDIO服务器 ${server.id} 的工具 ${toolName}:`, args);
    
    // 确保STDIO服务器已初始化
    if (!this.stdioManagers[server.id] || !this.stdioManagers[server.id].connected) {
      // 初始化STDIO服务器
      await this.initializeStdioServer(server);
      this.stdioManagers[server.id].connected = true;
    }
    
    // TODO: 实现实际的STDIO工具调用逻辑
    // 当前版本暂不支持STDIO工具调用
    throw new Error(`目前还不支持STDIO服务器 ${server.id} 的工具调用`);
  }
} 