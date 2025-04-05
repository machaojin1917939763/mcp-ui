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
      await this.initializeMcpTools();
      
      // 连接所有启用的服务器并加载工具
      // 这个过程中会为每个服务器获取工具并更新到availableTools
      await this.connectEnabledServers();
      
      // 用于跟踪全局工具的工具跟踪器
      const globalToolTracker = new Set<string>();
      
      // 跟踪已添加工具的基本名称
      this.availableTools.forEach(tool => {
        globalToolTracker.add(this.getToolBaseName(tool.name));
      });
      
      // 尝试加载全局MCP工具
      try {
        const tools = await MCPService.getTools();
        // 合并到可用工具列表，避免重复
        if (tools && tools.length > 0) {
          console.log(`从全局MCP服务获取了 ${tools.length} 个工具，开始去重...`);
          
          // 为全局工具创建一个假的服务器配置
          const globalServer: MCPServerConfig = {
            id: 'global',
            name: '全局工具',
            url: '',
            description: '全局可用工具',
            enabled: true,
            transport: 'stdio'
          };
          
          // 使用去重逻辑添加全局工具
          this.addToolsWithPrefixAndDeduplication(tools, globalServer, globalToolTracker);
          console.log(`添加了全局工具，当前工具总数: ${this.availableTools.length}`);
        }
      } catch (error) {
        console.error('获取全局MCP工具失败:', error);
      }
      
      // 最后执行一次全局工具去重，确保没有重复工具
      // 但不会去除不同服务器的同名工具
      this.deduplicateTools();
      
      // 再次更新LLM服务中的工具列表，确保所有工具都可用
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
    
    console.log(`服务器连接结果 - 成功: ${succeeded.join(', ') || '无'}, 失败: ${failed.join(', ') || '无'}`);
    console.log(`共加载了 ${totalTools} 个工具`);
    
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
   * 初始化所有启用的MCP服务器的工具
   */
  private async initializeMcpTools(): Promise<void> {
    // 清空工具列表
    this.mcpTools = {};
    this.availableTools = [];
    
    // 获取所有启用的MCP服务器
    const enabledServers = this.mcpServers.filter(server => server.enabled);
    
    // 用于跟踪已添加的工具，避免重复
    const toolTracker = new Set<string>();
    
    console.log(`初始化MCP工具：将从 ${enabledServers.length} 个启用的服务器加载工具`);
    
    // 注意：连接全部服务器会在connectEnabledServers中完成，这里只进行初始化
    console.log(`已完成MCP工具初始化`);
  }
  
  /**
   * 使用前缀添加工具并避免重复
   * @param tools 工具列表
   * @param server 服务器配置
   * @param toolTracker 已添加工具的跟踪器
   */
  private addToolsWithPrefixAndDeduplication(tools: Tool[], server: MCPServerConfig, toolTracker: Set<string>): void {
    if (!tools || !tools.length) return;
    
    // 1. 先生成一个基本名称到完整工具的映射
    const toolMap = new Map<string, Tool>();
    
    for (const tool of tools) {
      const baseName = this.getToolBaseName(tool.name);
      
      // 使用基本名称作为键，如果已存在则跳过（保留第一个工具）
      if (!toolMap.has(baseName)) {
        toolMap.set(baseName, tool);
      }
    }
    
    // 2. 为每个唯一的工具添加前缀
    toolMap.forEach((tool, baseName) => {
      // 创建带前缀的名称，使用单下划线作为分隔符
      // 因为服务器ID不允许包含下划线，所以这种方式是安全的
      const prefixedName = `${server.id}_${tool.name}`;
      
      // 检查此工具是否已经添加（检查基本名称和带前缀的名称）
      if (!toolTracker.has(prefixedName) && !toolTracker.has(baseName)) {
        // 对于全局工具，也要添加一个不带前缀的版本以保持向后兼容
        if (server.id === 'global') {
          // 添加不带前缀的全局工具
          this.availableTools.push({
            ...tool,
            name: tool.name,  // 保持原始名称
            description: tool.description // 保持原始描述
          });
          
          console.log(`添加全局工具（原名）: ${tool.name}`);
          toolTracker.add(tool.name);
        }
        
        // 添加带前缀的工具
        this.availableTools.push({
          ...tool,
          name: prefixedName,
          description: `[${server.name}] ${tool.description}`
        });
        
        // 记录已添加的工具
        toolTracker.add(prefixedName);
        toolTracker.add(baseName);
        
        console.log(`添加工具: ${prefixedName}`);
      } else {
        console.log(`跳过重复工具: ${prefixedName}`);
      }
    });
  }
  
  /**
   * 获取工具的基本名称（去掉前缀）
   * @param toolName 工具名称
   * @returns 基本名称
   */
  private getToolBaseName(toolName: string): string {
    // 首先检查是否是浏览器工具
    if (this.isBrowserTool(toolName)) {
      return this.normalizeBrowserToolName(toolName);
    }
    
    // 检查是否有serverId前缀（使用正则表达式匹配serverId_toolName格式）
    const prefixMatch = /^([a-zA-Z0-9-]+)_(.+)$/.exec(toolName);
    if (prefixMatch) {
      // 提取真正的工具名
      const actualName = prefixMatch[2];
      return actualName;
    }
    
    // 没有特殊前缀，返回原名称
    return toolName;
  }
  
  /**
   * 检查工具是否是浏览器相关工具
   * @param toolName 工具名称
   * @returns 是否是浏览器工具
   */
  private isBrowserTool(toolName: string): boolean {
    const browserPrefixes = [
      'browser_', 
      'playwright_browser_', 
      'chrome_browser_',
      'playwright_',
      'chrome_'
    ];
    
    for (const prefix of browserPrefixes) {
      if (toolName.startsWith(prefix)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * 规范化浏览器工具名称
   * @param toolName 工具名称
   * @returns 规范化后的工具名称
   */
  private normalizeBrowserToolName(toolName: string): string {
    // 常见的前缀模式，例如 'browser_', 'playwright_browser_', 'chrome_browser_' 等
    const prefixPatterns = [
      /^playwright_browser_/,   // 匹配 playwright_browser_
      /^chrome_browser_/,       // 匹配 chrome_browser_
      /^playwright_/,           // 匹配 playwright_
      /^chrome_/,               // 匹配 chrome_
      /^browser_/               // 匹配 browser_
    ];
    
    // 尝试匹配并去除前缀
    for (const pattern of prefixPatterns) {
      if (pattern.test(toolName)) {
        // 浏览器工具统一使用 browser_ 前缀
        const normalized = toolName.replace(pattern, '');
        return 'browser_' + normalized;
      }
    }
    
    // 无法识别的格式，返回原名称
    return toolName;
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
      // 用于去重
      const toolTracker = new Set<string>();
      
      // 创建匹配该服务器前缀的正则表达式
      const prefixRegex = new RegExp(`^${serverId}_`);
      
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
        this.availableTools = this.availableTools.filter(tool => !prefixRegex.test(tool.name));
        
        // 添加新工具，使用去重逻辑
        this.addToolsWithPrefixAndDeduplication(tools, server, toolTracker);
        
        // 执行最终去重
        this.deduplicateTools();
        
        console.log(`从服务器 ${server.name} 获取了 ${tools.length} 个工具`);
        return tools;
      } else if (server.transport === 'stdio') {
        // 使用MCPService获取工具
        const tools = await MCPService.getTools(server.id);
        
        // 更新工具缓存
        this.mcpTools[server.id] = tools || [];
        
        // 更新可用工具列表，先移除旧的同服务器工具
        this.availableTools = this.availableTools.filter(tool => !prefixRegex.test(tool.name));
        
        // 添加新工具，使用去重逻辑
        this.addToolsWithPrefixAndDeduplication(tools || [], server, toolTracker);
        
        // 执行最终去重
        this.deduplicateTools();
        
        console.log(`从服务器 ${server.name} 获取了 ${tools?.length || 0} 个工具`);
        return tools || [];
      } else {
        throw new Error(`不支持的服务器传输类型: ${server.transport}`);
      }
    } catch (error) {
      console.error(`获取服务器 ${server.name} 的工具失败:`, error);
      throw error;
    }
  }

  /**
   * 初始化STDIO服务器并获取工具列表
   * @param server STDIO服务器配置
   * @returns 工具列表
   */
  private async initializeStdioServer(server: MCPServerConfig): Promise<Tool[]> {
    // 使用MCPService连接到客户端并获取工具
    try {
      // 检查服务器是否已连接
      await MCPService.connectClient(server.id);
      const tools = await MCPService.getTools(server.id);
      return tools || [];
    } catch (error) {
      console.error(`初始化STDIO服务器 ${server.id} 失败:`, error);
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
      // 特殊处理浏览器工具（以browser_开头的工具）
      if (toolName.startsWith('browser_')) {
        try {
          console.log(`调用浏览器工具: ${toolName}`);
          const result = await MCPService.callTool({
            name: toolName,
            arguments: args,
            // 使用全局服务或playwright服务客户端
            clientName: 'playwright'
          });
          return { result };
        } catch (error) {
          console.error(`调用浏览器工具 ${toolName} 失败:`, error);
          throw new Error(`调用浏览器工具 ${toolName} 失败: ${(error as Error).message}`);
        }
      }
      
      // 判断工具名称是否有前缀（serverId_）
      // 使用更安全的方式，检查是否匹配"前缀_"的模式，而不是简单地分割
      const prefixMatch = /^([a-zA-Z0-9-]+)_(.+)$/.exec(toolName);
      
      if (prefixMatch) {
        // 获取serverId和实际工具名
        const [, serverId, actualToolName] = prefixMatch;
        
        // 检查是否为全局工具（带global前缀）
        if (serverId === 'global') {
          try {
            console.log(`调用带global前缀的全局工具: ${actualToolName}`);
            const result = await MCPService.callTool({
              name: actualToolName,
              arguments: args
            });
            return { result };
          } catch (error) {
            console.error(`调用全局工具 ${actualToolName} 失败:`, error);
            throw new Error(`调用全局工具 ${actualToolName} 失败: ${(error as Error).message}`);
          }
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
          // 使用MCPService调用工具
          try {
            const result = await MCPService.callTool({
              name: actualToolName,
              arguments: args,
              clientName: serverId
            });
            return { result };
          } catch (error) {
            console.error(`调用服务器 ${serverId} 工具 ${actualToolName} 失败:`, error);
            throw new Error(`调用服务器 ${serverId} 工具 ${actualToolName} 失败: ${(error as Error).message}`);
          }
        } else {
          throw new Error(`不支持的服务器传输类型: ${server.transport}`);
        }
      } else {
        // 不包含有效前缀，假设是全局工具
        try {
          console.log(`调用全局工具: ${toolName}`);
          const result = await MCPService.callTool({
            name: toolName,
            arguments: args
          });
          return { result };
        } catch (error) {
          console.error(`调用全局工具 ${toolName} 失败:`, error);
          throw new Error(`调用全局工具 ${toolName} 失败: ${(error as Error).message}`);
        }
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
    
    // 使用MCPService调用工具
    try {
      const result = await MCPService.callTool({
        name: toolName,
        arguments: args,
        clientName: server.id
      });
      return { result };
    } catch (error) {
      console.error(`调用STDIO服务器 ${server.id} 的工具 ${toolName} 失败:`, error);
      throw error;
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
    // 初始化工具列表
    await this.initializeMcpTools();
    
    // 用于去重的工具跟踪器
    const globalToolTracker = new Set<string>();
    
    // 跟踪已添加工具的基本名称
    this.availableTools.forEach(tool => {
      globalToolTracker.add(this.getToolBaseName(tool.name));
    });
    
    // 尝试确保playwright服务器已经连接（用于浏览器工具）
    try {
      // 查找playwright服务器配置
      const playwright = this.mcpServers.find(s => s.id === 'playwright');
      if (playwright && playwright.enabled) {
        // 确保连接以获取浏览器工具
        try {
          await this.connectToServer(playwright);
          console.log('已确保Playwright服务连接以获取浏览器工具');
        } catch (error) {
          console.warn('连接Playwright服务失败，但继续其他工具加载', error);
        }
      }
    } catch (error) {
      console.warn('检查Playwright服务状态失败', error);
    }
    
    // 重新加载全局工具
    try {
      const globalTools = await MCPService.getTools();
      if (globalTools && globalTools.length > 0) {
        // 为全局工具创建一个假的服务器配置
        const globalServer: MCPServerConfig = {
          id: 'global',
          name: '全局工具',
          url: '',
          description: '全局可用工具',
          enabled: true,
          transport: 'stdio'
        };
        
        // 使用去重逻辑添加全局工具
        this.addToolsWithPrefixAndDeduplication(globalTools, globalServer, globalToolTracker);
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
    
    // 使用更精细的去重逻辑，保留不同服务器的工具
    // 使用Map来跟踪每个服务器的工具，格式为 Map<服务器ID_基本名称, Tool>
    const toolsMap = new Map<string, Tool>();
    
    for (const tool of this.availableTools) {
      const baseName = this.getToolBaseName(tool.name);
      
      // 检查工具是否带有服务器前缀
      const prefixMatch = /^([a-zA-Z0-9-]+)_(.+)$/.exec(tool.name);
      if (prefixMatch) {
        // 获取服务器ID
        const serverId = prefixMatch[1];
        
        // 使用服务器ID和基本名称作为键，确保不同服务器的同名工具不被去重
        const mapKey = `${serverId}_${baseName}`;
        
        // 如果此键未添加过工具，添加它
        if (!toolsMap.has(mapKey)) {
          toolsMap.set(mapKey, tool);
        }
      } else {
        // 没有服务器前缀的工具（可能是全局工具或旧格式），使用基本名称作为键
        if (!toolsMap.has(baseName)) {
          toolsMap.set(baseName, tool);
        } else {
          // 如果已存在同名工具，保留没有前缀的版本（全局工具优先）
          // 这个条件主要用于确保全局工具有优先权
          toolsMap.set(baseName, tool);
        }
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
    // 直接使用新实现
    await this.refreshAvailableTools();
  }
}