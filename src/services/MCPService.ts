import axios from 'axios';

/**
 * MCP客户端配置接口
 */
export interface MCPClientConfig {
  name: string;
  command: string;
  args: string[];
  description?: string;
  isConnected?: boolean;
  lastUpdated?: string;
}

/**
 * MCP工具接口
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * MCP资源接口
 */
export interface MCPResource {
  uri: string;
  description: string;
}

/**
 * MCP提示接口
 */
export interface MCPPrompt {
  name: string;
  description: string;
}

/**
 * MCP调用工具参数接口
 */
export interface MCPToolCallParams {
  name: string;
  arguments: Record<string, any>;
  clientName?: string;
}

/**
 * MCP服务类
 */
export class MCPService {
  private baseUrl: string;
  private defaultClientName: string;

  /**
   * 构造函数
   * @param baseUrl MCP后端服务的基础URL
   * @param defaultClientName 默认客户端名称
   */
  constructor(baseUrl: string = 'http://localhost:3001', defaultClientName: string = 'playwright') {
    this.baseUrl = baseUrl;
    this.defaultClientName = defaultClientName;
  }

  // ===== 客户端管理 =====

  /**
   * 获取所有已配置的客户端列表
   * @returns 客户端列表
   */
  async getClients(): Promise<MCPClientConfig[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/mcp/clients`);
      return response.data.clients;
    } catch (error) {
      console.error('获取MCP客户端列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取特定客户端的详细信息
   * @param clientName 客户端名称
   * @returns 客户端详细信息
   */
  async getClient(clientName: string): Promise<MCPClientConfig> {
    try {
      const response = await axios.get(`${this.baseUrl}/mcp/clients/${clientName}`);
      return response.data;
    } catch (error) {
      console.error(`获取MCP客户端 ${clientName} 详情失败:`, error);
      throw error;
    }
  }

  /**
   * 添加或更新客户端配置
   * @param config 客户端配置
   * @param autoConnect 是否自动连接
   * @returns 操作结果
   */
  async addOrUpdateClient(config: MCPClientConfig, autoConnect: boolean = false): Promise<any> {
    try {
      console.log(`添加/更新客户端 ${config.name}，autoConnect=${autoConnect}`);
      const response = await axios.post(`${this.baseUrl}/mcp/clients`, {
        ...config,
        autoConnect
      });
      return response.data;
    } catch (error) {
      console.error('添加/更新MCP客户端失败:', error);
      // 检查是否有更详细的错误信息
      if (axios.isAxiosError(error) && error.response) {
        const errorMsg = error.response.data?.error || error.response.data?.message || error.message;
        throw new Error(`添加/更新客户端失败: ${errorMsg}`);
      }
      throw error;
    }
  }

  /**
   * 删除客户端配置
   * @param clientName 客户端名称
   * @returns 操作结果
   */
  async deleteClient(clientName: string): Promise<any> {
    try {
      const response = await axios.delete(`${this.baseUrl}/mcp/clients/${clientName}`);
      return response.data;
    } catch (error) {
      console.error(`删除MCP客户端 ${clientName} 失败:`, error);
      throw error;
    }
  }

  /**
   * 连接特定客户端
   * @param clientName 客户端名称
   * @returns 操作结果
   */
  async connectClient(clientName: string): Promise<any> {
    try {
      console.log(`尝试连接客户端: ${clientName}`);
      const response = await axios.post(`${this.baseUrl}/mcp/clients/${clientName}/connect`);
      console.log(`客户端 ${clientName} 连接成功:`, response.data);
      return response.data;
    } catch (error) {
      console.error(`连接MCP客户端 ${clientName} 失败:`, error);
      // 检查是否有更详细的错误信息
      if (axios.isAxiosError(error) && error.response) {
        const errorMsg = error.response.data?.error || error.response.data?.message || error.message;
        throw new Error(`连接客户端失败: ${errorMsg}`);
      }
      throw error;
    }
  }

  /**
   * 断开特定客户端
   * @param clientName 客户端名称
   * @returns 操作结果
   */
  async disconnectClient(clientName: string): Promise<any> {
    try {
      console.log(`尝试断开客户端: ${clientName}`);
      const response = await axios.post(`${this.baseUrl}/mcp/clients/${clientName}/disconnect`);
      console.log(`客户端 ${clientName} 断开连接成功:`, response.data);
      return response.data;
    } catch (error) {
      console.error(`断开MCP客户端 ${clientName} 连接失败:`, error);
      // 检查是否有更详细的错误信息
      if (axios.isAxiosError(error) && error.response) {
        const errorMsg = error.response.data?.error || error.response.data?.message || error.message;
        throw new Error(`断开客户端连接失败: ${errorMsg}`);
      }
      throw error;
    }
  }

  /**
   * 导出所有客户端配置
   * @returns 配置导出URL
   */
  getExportConfigUrl(): string {
    return `${this.baseUrl}/mcp/clients/export`;
  }

  /**
   * 导入客户端配置
   * @param configs 配置对象
   * @param overwrite 是否覆盖现有配置
   * @returns 操作结果
   */
  async importConfigs(configs: Record<string, any>, overwrite: boolean = false): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/mcp/clients/import`, {
        configs,
        overwrite
      });
      return response.data;
    } catch (error) {
      console.error('导入MCP客户端配置失败:', error);
      throw error;
    }
  }

  // ===== 工具操作 =====

  /**
   * 获取指定客户端的可用工具
   * @param clientName 客户端名称（可选，默认使用默认客户端）
   * @returns 工具列表
   */
  async getTools(clientName?: string): Promise<MCPTool[]> {
    try {
      // 使用RESTful风格的客户端特定API
      if (clientName) {
        const response = await axios.get(`${this.baseUrl}/mcp/clients/${clientName}/tools`);
        // 检查嵌套结构，有些后端可能会返回 { tools: [...] } 格式
        const toolsData = response.data.tools;
        if (toolsData && typeof toolsData === 'object' && Array.isArray(toolsData.tools)) {
          // 处理嵌套的工具数组
          return toolsData.tools;
        }
        return toolsData || [];
      } else {
        // 使用向后兼容的API
        const response = await axios.get(`${this.baseUrl}/mcp/tools`, {
          params: { client: this.defaultClientName }
        });
        // 检查嵌套结构
        const toolsData = response.data.tools;
        if (toolsData && typeof toolsData === 'object' && Array.isArray(toolsData.tools)) {
          // 处理嵌套的工具数组
          return toolsData.tools;
        }
        return toolsData || [];
      }
    } catch (error) {
      console.error(`获取${clientName ? `客户端 ${clientName} 的` : ''}MCP工具列表失败:`, error);
      throw error;
    }
  }

  /**
   * 调用MCP工具
   * @param params 工具调用参数
   * @returns 工具调用结果
   */
  async callTool(params: MCPToolCallParams): Promise<any> {
    try {
      if (params.clientName) {
        // 使用RESTful风格的客户端特定API
        const { name, arguments: args } = params;
        const response = await axios.post(`${this.baseUrl}/mcp/clients/${params.clientName}/tools/call`, {
          name,
          arguments: args
        });
        return response.data.result;
      } else {
        // 使用向后兼容的API
        const response = await axios.post(`${this.baseUrl}/mcp/tools/call`, {
          name: params.name,
          arguments: params.arguments,
          clientName: this.defaultClientName
        });
        return response.data.result;
      }
    } catch (error) {
      console.error(`调用${params.clientName ? `客户端 ${params.clientName} 的` : ''}MCP工具 ${params.name} 失败:`, error);
      throw error;
    }
  }

  // ===== 资源操作 =====

  /**
   * 获取指定客户端的可用资源
   * @param clientName 客户端名称（可选，默认使用默认客户端）
   * @returns 资源列表
   */
  async getResources(clientName?: string): Promise<MCPResource[]> {
    try {
      if (clientName) {
        // 使用RESTful风格的客户端特定API
        const response = await axios.get(`${this.baseUrl}/mcp/clients/${clientName}/resources`);
        // 检查嵌套结构
        const resourcesData = response.data.resources;
        if (resourcesData && typeof resourcesData === 'object' && Array.isArray(resourcesData.resources)) {
          return resourcesData.resources;
        }
        return resourcesData || [];
      } else {
        // 使用向后兼容的API
        const response = await axios.get(`${this.baseUrl}/mcp/resources`, {
          params: { client: this.defaultClientName }
        });
        // 检查嵌套结构
        const resourcesData = response.data.resources;
        if (resourcesData && typeof resourcesData === 'object' && Array.isArray(resourcesData.resources)) {
          return resourcesData.resources;
        }
        return resourcesData || [];
      }
    } catch (error) {
      console.error(`获取${clientName ? `客户端 ${clientName} 的` : ''}MCP资源列表失败:`, error);
      throw error;
    }
  }

  // ===== 提示操作 =====

  /**
   * 获取指定客户端的可用提示
   * @param clientName 客户端名称（可选，默认使用默认客户端）
   * @returns 提示列表
   */
  async getPrompts(clientName?: string): Promise<MCPPrompt[]> {
    try {
      if (clientName) {
        // 使用RESTful风格的客户端特定API
        const response = await axios.get(`${this.baseUrl}/mcp/clients/${clientName}/prompts`);
        // 检查嵌套结构
        const promptsData = response.data.prompts;
        if (promptsData && typeof promptsData === 'object' && Array.isArray(promptsData.prompts)) {
          return promptsData.prompts;
        }
        return promptsData || [];
      } else {
        // 使用向后兼容的API
        const response = await axios.get(`${this.baseUrl}/mcp/prompts`, {
          params: { client: this.defaultClientName }
        });
        // 检查嵌套结构
        const promptsData = response.data.prompts;
        if (promptsData && typeof promptsData === 'object' && Array.isArray(promptsData.prompts)) {
          return promptsData.prompts;
        }
        return promptsData || [];
      }
    } catch (error) {
      console.error(`获取${clientName ? `客户端 ${clientName} 的` : ''}MCP提示列表失败:`, error);
      throw error;
    }
  }

  /**
   * 浏览器导航到指定URL
   * @param url 要导航到的URL
   * @param clientName 客户端名称（可选，默认使用playwright客户端）
   * @returns 导航结果
   */
  async browserNavigate(url: string, clientName?: string): Promise<any> {
    try {
      return await this.callTool({
        name: 'browser_navigate',
        arguments: { url },
        clientName: clientName || 'playwright'
      });
    } catch (error) {
      console.error(`浏览器导航到 ${url} 失败:`, error);
      throw error;
    }
  }
}

// 导出默认实例
export default new MCPService(); 