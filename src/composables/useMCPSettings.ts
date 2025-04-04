import { ref, computed } from 'vue';

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

export function useMCPSettings() {
  // MCP服务器配置
  const mcpServers = ref<MCPServerConfig[]>(JSON.parse(localStorage.getItem('mcpServers') || '[]'));
  const newMcpServerId = ref('');
  const newMcpServerName = ref('');
  const newMcpServerUrl = ref('');
  const newMcpServerDesc = ref('');
  const newMcpServerTransport = ref<'sse' | 'stdio'>('sse');
  const newMcpServerCommand = ref('');
  const newMcpServerArgs = ref<string[]>([]);
  
  // 检查现有服务器是否需要更新
  const upgradeMcpServers = () => {
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
  };
  
  // 如果MCP服务器列表为空，添加一个默认天气服务器示例
  if (mcpServers.value.length === 0) {
    mcpServers.value.push({
      id: 'weather',
      name: '天气服务示例 (SSE)',
      url: 'http://localhost:8080',
      description: '示例天气服务，提供天气预报和气象警报功能',
      enabled: false,
      transport: 'sse'
    });
    
    // 添加stdio示例
    mcpServers.value.push({
      id: 'weather-stdio',
      name: '天气服务示例 (STDIO)',
      url: '',
      description: '示例STDIO天气服务',
      enabled: false,
      transport: 'stdio',
      command: 'uv',
      args: ['--directory', '/path/to/weather', 'run', 'weather.py']
    });
    
    localStorage.setItem('mcpServers', JSON.stringify(mcpServers.value));
  } else {
    // 检查并升级现有服务器配置
    upgradeMcpServers();
  }

  // 计算生效的MCP服务器列表
  const enabledMcpServers = computed(() => {
    return mcpServers.value.filter(server => server.enabled);
  });

  // 添加MCP服务器
  function addMcpServer(showNotification: (message: string) => void) {
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
  function toggleMcpServerStatus(id: string) {
    const server = mcpServers.value.find(s => s.id === id);
    if (server) {
      server.enabled = !server.enabled;
      localStorage.setItem('mcpServers', JSON.stringify(mcpServers.value));
    }
  }

  // 删除MCP服务器
  function removeMcpServer(id: string) {
    mcpServers.value = mcpServers.value.filter(s => s.id !== id);
    localStorage.setItem('mcpServers', JSON.stringify(mcpServers.value));
  }

  // 保存MCP服务器配置
  function saveMcpServers(mcpClient: any) {
    localStorage.setItem('mcpServers', JSON.stringify(mcpServers.value));
    
    // 更新MCP客户端配置
    if (mcpClient && typeof mcpClient.updateMcpServers === 'function') {
      mcpClient.updateMcpServers(mcpServers.value);
    }
  }

  return {
    // MCP服务器相关
    mcpServers,
    enabledMcpServers,
    newMcpServerId,
    newMcpServerName,
    newMcpServerUrl,
    newMcpServerDesc,
    newMcpServerTransport,
    newMcpServerCommand,
    newMcpServerArgs,
    
    // MCP服务器方法
    addMcpServer,
    toggleMcpServerStatus,
    removeMcpServer,
    saveMcpServers,
    updateMcpServerArg,
    addMcpServerArg,
    removeMcpServerArg
  };
} 