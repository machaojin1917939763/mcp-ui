import { ref, computed, onMounted } from 'vue';
import MCPService from '../services/MCPService';
import type { MCPClientConfig } from '../services/MCPService';

// MCP服务器配置接口
export interface MCPServerConfig {
  id: string;
  name: string;
  url: string;
  description?: string;
  enabled: boolean;
  transport: 'sse' | 'stdio';
  // stdio类型服务器配置
  command?: string; // 命令
  args?: string[]; // 参数列表
}

// MCP客户端接口，用于类型声明
interface MCPClient {
  updateMcpServers: (servers: MCPServerConfig[]) => void;
  connectToServer: (serverConfig: MCPServerConfig) => Promise<void>;
  disconnectFromServer: (serverId: string) => Promise<void>;
}

// 将MCP服务器配置转换为MCP客户端配置
function convertToClientConfig(server: MCPServerConfig): MCPClientConfig {
  return {
    name: server.id,
    command: server.command || 'npx',
    args: server.args || [],
    description: server.description || server.name
  };
}

// 将MCP客户端配置转换为MCP服务器配置
function convertToServerConfig(client: MCPClientConfig, enabled: boolean = true): MCPServerConfig {
  return {
    id: client.name,
    name: client.description || client.name,
    url: '',
    description: client.description,
    enabled,
    transport: 'stdio',
    command: client.command,
    args: client.args
  };
}

export function useMCPSettings() {
  // MCP服务器配置
  const mcpServers = ref<MCPServerConfig[]>([]);
  const newMcpServerId = ref('');
  const newMcpServerName = ref('');
  const newMcpServerUrl = ref('');
  const newMcpServerDesc = ref('');
  const newMcpServerTransport = ref<'sse' | 'stdio'>('sse');
  const newMcpServerCommand = ref('');
  const newMcpServerArgs = ref<string[]>([]);
  
  // 当前连接的服务器ID列表
  const connectedServers = ref<string[]>([]);
  // 加载状态
  const isLoading = ref(false);
  
  // 从本地存储加载MCP服务器配置
  const loadFromLocalStorage = () => {
    const storedServers = localStorage.getItem('mcpServers');
    if (storedServers) {
      try {
        mcpServers.value = JSON.parse(storedServers);
        upgradeAndSyncMcpServers();
      } catch (error) {
        console.error('解析MCP服务器配置失败:', error);
        initDefaultServers();
      }
    } else {
      initDefaultServers();
    }
  };
  
  // 从MCP服务加载客户端配置并同步
  const loadFromMCPService = async () => {
    try {
      isLoading.value = true;
      const clients = await MCPService.getClients();
      
      // 保存现有启用状态的映射
      const enabledMap = Object.fromEntries(
        mcpServers.value.map(server => [server.id, server.enabled])
      );
      
      // 转换为服务器配置
      const serverConfigs: MCPServerConfig[] = clients.map(client => {
        // 保持原有启用状态，如果不存在则默认启用
        const enabled = enabledMap[client.name] !== undefined ? enabledMap[client.name] : true;
        return convertToServerConfig(client, enabled);
      });
      
      // 合并现有非stdio类型服务器
      const nonStdioServers = mcpServers.value.filter(
        server => server.transport !== 'stdio'
      );
      
      // 合并结果
      mcpServers.value = [
        ...serverConfigs,
        ...nonStdioServers
      ];
      
      // 保存到本地
      localStorage.setItem('mcpServers', JSON.stringify(mcpServers.value));
    } catch (error) {
      console.error('从MCP服务加载客户端配置失败:', error);
    } finally {
      isLoading.value = false;
    }
  };
  
  // 初始化默认服务器
  const initDefaultServers = () => {
    mcpServers.value = [];
    
    // 保存到本地存储
    localStorage.setItem('mcpServers', JSON.stringify(mcpServers.value));
    
    // 同步到MCP服务
    syncToMCPService();
  };
  
  // 检查现有服务器是否需要更新并同步到MCP服务
  const upgradeAndSyncMcpServers = () => {
    let needsUpdate = false;
    
    // 添加缺失的transport属性
    mcpServers.value.forEach(server => {
      if (!server.transport) {
        server.transport = 'sse';
        needsUpdate = true;
      }
    });
    
    if (needsUpdate) {
      localStorage.setItem('mcpServers', JSON.stringify(mcpServers.value));
    }
    
    // 同步到MCP服务
    syncToMCPService();
  };
  
  // 将stdio服务器同步到MCP服务
  const syncToMCPService = async () => {
    // 收集所有stdio类型的服务器
    const stdioServers = mcpServers.value.filter(
      server => server.transport === 'stdio'
    );
    
    // 转换为客户端配置并保存到MCP服务
    for (const server of stdioServers) {
      try {
        const clientConfig = convertToClientConfig(server);
        await MCPService.addOrUpdateClient(clientConfig, server.enabled);
      } catch (error) {
        console.error(`同步服务器 ${server.id} 到MCP服务失败:`, error);
      }
    }
  };
  
  // 加载所有配置
  onMounted(() => {
    loadFromLocalStorage();
    loadFromMCPService();
  });

  // 计算生效的MCP服务器列表
  const enabledMcpServers = computed(() => {
    return mcpServers.value.filter(server => server.enabled);
  });

  // 添加MCP服务器
  async function addMcpServer(showNotification: (message: string) => void) {
    if (!newMcpServerId.value.trim()) {
      showNotification('服务器ID不能为空');
      return;
    }
    
    // 对于STDIO类型，必须有命令
    if (newMcpServerTransport.value === 'stdio' && !newMcpServerCommand.value.trim()) {
      showNotification('STDIO服务器必须指定命令');
      return;
    }
    
    // 对于SSE类型，必须有URL
    if (newMcpServerTransport.value === 'sse' && !newMcpServerUrl.value.trim()) {
      showNotification('SSE服务器必须指定URL');
      return;
    }
    
    // 检查服务器ID是否已存在
    if (mcpServers.value.some(s => s.id === newMcpServerId.value)) {
      showNotification('服务器ID已存在');
      return;
    }
    
    // 添加新服务器
    const newServer: MCPServerConfig = {
      id: newMcpServerId.value,
      name: newMcpServerName.value || newMcpServerId.value,
      url: newMcpServerUrl.value,
      description: newMcpServerDesc.value || '',
      enabled: true,
      transport: newMcpServerTransport.value
    };
    
    // 对于stdio类型，添加命令和参数
    if (newMcpServerTransport.value === 'stdio') {
      newServer.command = newMcpServerCommand.value;
      newServer.args = [...newMcpServerArgs.value];
      
      // 同步到MCP服务
      try {
        await MCPService.addOrUpdateClient(convertToClientConfig(newServer), true);
      } catch (error: any) {
        console.error(`添加客户端 ${newServer.id} 到MCP服务失败:`, error);
        showNotification(`添加服务器到MCP服务失败: ${error.message || '未知错误'}`);
        return;
      }
    }
    
    mcpServers.value.push(newServer);
    
    // 清空输入
    newMcpServerId.value = '';
    newMcpServerName.value = '';
    newMcpServerUrl.value = '';
    newMcpServerDesc.value = '';
    newMcpServerTransport.value = 'sse';
    newMcpServerCommand.value = '';
    newMcpServerArgs.value = [];
    
    // 保存到本地存储
    localStorage.setItem('mcpServers', JSON.stringify(mcpServers.value));
    showNotification('MCP服务器已添加');
  }
  
  // 更新参数列表中的一项
  function updateMcpServerArg(data: { index: number, value: string }) {
    const { index, value } = data;
    if (index >= 0 && index < newMcpServerArgs.value.length) {
      newMcpServerArgs.value[index] = value;
    }
  }
  
  // 添加新参数
  function addMcpServerArg() {
    newMcpServerArgs.value.push('');
  }
  
  // 移除参数
  function removeMcpServerArg(index: number) {
    if (index >= 0 && index < newMcpServerArgs.value.length) {
      newMcpServerArgs.value.splice(index, 1);
    }
  }

  // 切换MCP服务器状态
  async function toggleMcpServerStatus(id: string, mcpClient?: MCPClient) {
    const server = mcpServers.value.find(s => s.id === id);
    if (!server) return;
    
    const newStatus = !server.enabled;
    console.log(`尝试${newStatus ? '启用' : '禁用'}服务器 ${id}`);
    
    try {
      // 如果是stdio类型服务器，同步状态到MCP服务
      if (server.transport === 'stdio') {
        if (newStatus) {
          // 连接服务器
          await MCPService.connectClient(id);
          // 连接成功后再修改状态
          server.enabled = newStatus;
          // 更新连接状态
          if (!connectedServers.value.includes(id)) {
            connectedServers.value.push(id);
          }
        } else {
          // 断开服务器
          await MCPService.disconnectClient(id);
          // 断开成功后再修改状态
          server.enabled = newStatus;
          // 更新连接状态
          connectedServers.value = connectedServers.value.filter(sid => sid !== id);
        }
      } else {
        // 先更新状态
        server.enabled = newStatus;
        
        // 如果禁用服务器，且已连接，则断开连接
        if (!server.enabled && connectedServers.value.includes(id) && mcpClient) {
          mcpClient.disconnectFromServer(id)
            .then(() => {
              connectedServers.value = connectedServers.value.filter(sid => sid !== id);
            })
            .catch(error => {
              console.error(`断开服务器 ${id} 连接失败:`, error);
              // 即使失败也更新UI状态
              connectedServers.value = connectedServers.value.filter(sid => sid !== id);
            });
        } else if (!server.enabled && connectedServers.value.includes(id)) {
          // 没有mcpClient但需要更新连接状态
          connectedServers.value = connectedServers.value.filter(sid => sid !== id);
        }
        
        // 如果启用服务器，且未连接，则尝试连接
        if (server.enabled && !connectedServers.value.includes(id) && mcpClient) {
          mcpClient.connectToServer(server)
            .then(() => {
              connectedServers.value.push(id);
            })
            .catch(error => {
              console.error(`连接到服务器 ${id} 失败:`, error);
              // 连接失败时恢复状态
              server.enabled = false;
            });
        } else if (server.enabled && !connectedServers.value.includes(id)) {
          // 没有mcpClient但需要更新连接状态
          connectedServers.value.push(id);
        }
      }
      
      // 保存到本地存储
      localStorage.setItem('mcpServers', JSON.stringify(mcpServers.value));
      console.log(`服务器 ${id} 状态已更新为: ${server.enabled ? '启用' : '禁用'}`);
    } catch (error) {
      console.error(`切换服务器 ${id} 状态失败:`, error);
      // 恢复状态
      server.enabled = !newStatus;
      // 通知用户错误
      alert(`切换服务器 ${id} 状态失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  // 删除MCP服务器
  async function removeMcpServer(id: string, mcpClient?: MCPClient) {
    const server = mcpServers.value.find(s => s.id === id);
    if (!server) return;
    
    // 如果是stdio类型服务器，从MCP服务中删除
    if (server.transport === 'stdio') {
      try {
        // 获取与此服务器关联的所有客户端
        const relatedClients = await MCPService.getClientsByServer(id);
        
        // 删除所有相关的客户端
        for (const client of relatedClients) {
          if (client.name !== id) { // 避免重复删除服务器本身
            try {
              await MCPService.deleteClient(client.name);
              console.log(`已删除服务器 ${id} 的客户端: ${client.name}`);
            } catch (clientError) {
              console.error(`删除服务器 ${id} 的客户端 ${client.name} 失败:`, clientError);
            }
          }
        }
        
        // 最后删除服务器本身
        await MCPService.deleteClient(id);
      } catch (error) {
        console.error(`从MCP服务删除客户端 ${id} 失败:`, error);
        // 继续删除本地配置
      }
    } else {
      // 如果已连接，先断开连接
      if (connectedServers.value.includes(id) && mcpClient) {
        mcpClient.disconnectFromServer(id)
          .then(() => {
            connectedServers.value = connectedServers.value.filter(sid => sid !== id);
          })
          .catch(console.error);
      }
    }
    
    mcpServers.value = mcpServers.value.filter(s => s.id !== id);
    connectedServers.value = connectedServers.value.filter(sid => sid !== id);
    localStorage.setItem('mcpServers', JSON.stringify(mcpServers.value));
  }

  // 保存MCP服务器配置
  async function saveMcpServers(mcpClient?: MCPClient) {
    localStorage.setItem('mcpServers', JSON.stringify(mcpServers.value));
    
    // 同步到MCP服务
    await syncToMCPService();
    
    // 更新MCP客户端配置
    if (mcpClient) {
      mcpClient.updateMcpServers(mcpServers.value);
    }
  }

  // 连接到MCP服务器
  async function connectToMcpServer(id: string, mcpClient?: MCPClient) {
    const server = mcpServers.value.find(s => s.id === id);
    if (!server || !server.enabled) return;
    
    if (connectedServers.value.includes(id)) {
      console.log(`已经连接到服务器 ${id}`);
      return;
    }
    
    // 对于stdio类型服务器，使用MCPService
    if (server.transport === 'stdio') {
      try {
        await MCPService.connectClient(id);
        connectedServers.value.push(id);
      } catch (error) {
        console.error(`连接到服务器 ${id} 失败:`, error);
        throw error;
      }
    } 
    // 使用mcpClient接口
    else if (mcpClient) {
      try {
        await mcpClient.connectToServer(server);
        connectedServers.value.push(id);
      } catch (error) {
        console.error(`连接到服务器 ${id} 失败:`, error);
        throw error;
      }
    }
  }
  
  // 断开与MCP服务器的连接
  async function disconnectFromMcpServer(id: string, mcpClient?: MCPClient) {
    if (!connectedServers.value.includes(id)) return;
    
    const server = mcpServers.value.find(s => s.id === id);
    
    // 对于stdio类型服务器，使用MCPService
    if (server && server.transport === 'stdio') {
      try {
        await MCPService.disconnectClient(id);
        connectedServers.value = connectedServers.value.filter(sid => sid !== id);
      } catch (error) {
        console.error(`断开与服务器 ${id} 的连接失败:`, error);
        throw error;
      }
    } 
    // 使用mcpClient接口
    else if (mcpClient) {
      try {
        await mcpClient.disconnectFromServer(id);
        connectedServers.value = connectedServers.value.filter(sid => sid !== id);
      } catch (error) {
        console.error(`断开与服务器 ${id} 的连接失败:`, error);
        throw error;
      }
    }
  }
  
  // 刷新客户端配置
  async function refreshClientConfigs() {
    await loadFromMCPService();
  }
  
  // 导出当前配置
  function exportConfigs() {
    return MCPService.getExportConfigUrl();
  }
  
  // 导入配置
  async function importConfigs(configs: Record<string, any>, overwrite: boolean = false) {
    try {
      const result = await MCPService.importConfigs(configs, overwrite);
      await loadFromMCPService(); // 重新加载配置
      return result;
    } catch (error: any) {
      console.error('导入配置失败:', error);
      throw error;
    }
  }

  return {
    // MCP服务器相关
    mcpServers,
    enabledMcpServers,
    connectedServers,
    newMcpServerId,
    newMcpServerName,
    newMcpServerUrl,
    newMcpServerDesc,
    newMcpServerTransport,
    newMcpServerCommand,
    newMcpServerArgs,
    isLoading,
    
    // MCP服务器方法
    addMcpServer,
    toggleMcpServerStatus,
    removeMcpServer,
    saveMcpServers,
    updateMcpServerArg,
    addMcpServerArg,
    removeMcpServerArg,
    connectToMcpServer,
    disconnectFromMcpServer,
    refreshClientConfigs,
    exportConfigs,
    importConfigs
  };
} 