<script setup lang="ts">
import NewChatComponent from './components/NewChatComponent.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import { MCPClient } from './utils/MCPClient';
import { useMCPSettings } from './composables/useMCPSettings';

// 处理MCP服务器状态切换
async function handleMcpServerStatusToggle(id: string) {
  // 切换服务器状态
  toggleMcpServerStatus(id);
  
  // 更新MCP客户端配置
  mcpClient.updateMcpServers(mcpServers.value);
}

// 请求获取MCP服务器工具信息
async function requestToolsInfo(serverId: string) {
  console.log(`请求获取服务器 ${serverId} 的工具信息`);
  
  // 查找服务器配置
  const server = mcpServers.value.find(s => s.id === serverId);
  if (!server || !server.enabled) return;
  
  try {
    // 通过MCP客户端更新服务器配置
    mcpClient.updateMcpServers(mcpServers.value);
    
    // 尝试从MCP客户端获取此服务器的工具列表
    const toolsList = await mcpClient.getMcpServerTools(serverId);
    
    // 更新显示
    showNotification(`成功获取到服务器 ${serverId} 的工具列表`);
  } catch (error) {
    console.error(`获取服务器 ${serverId} 工具列表失败:`, error);
    showNotification(`无法获取服务器 ${serverId} 的工具列表: ${(error as Error).message}`, 'error');
  }
}
</script>

<template>
  <div>
    <NewChatComponent />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}

html, body {
  height: 100%;
  overflow: hidden;
}
</style>
