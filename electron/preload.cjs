const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 发送消息示例
  sendMessage: (message) => ipcRenderer.send('example-message', message),
  
  // 接收消息示例
  onReply: (callback) => ipcRenderer.on('example-reply', (event, ...args) => callback(...args)),
  
  // MCP服务器API
  mcpServer: {
    // 获取服务器状态
    getStatus: () => ipcRenderer.invoke('mcp-server-status'),
    
    // 获取服务器健康状态
    getHealth: () => ipcRenderer.invoke('mcp-server-health')
  },
  
  // 获取MCP服务器状态
  getMCPServerStatus: () => ipcRenderer.invoke('mcp-server-status'),
  
  // 获取MCP服务器健康状态
  getMCPServerHealth: () => ipcRenderer.invoke('mcp-server-health'),
  
  // 监听MCP服务器状态变化
  onMCPServerStatusChange: (callback) => {
    ipcRenderer.on('mcp-server-status-change', (event, ...args) => callback(...args));
  },
  
  // 重启MCP服务器
  restartMCPServer: () => ipcRenderer.invoke('mcp-server-restart'),
  
  // 获取应用版本
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // 获取应用路径
  getAppPath: (name) => ipcRenderer.invoke('get-app-path', name),
  
  // 打开外部链接
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // 退出应用
  quitApp: () => ipcRenderer.invoke('quit-app'),
  
  // 获取MCP服务器日志
  getMCPServerLogs: () => ipcRenderer.invoke('get-mcp-server-logs'),
  
  // 检查MCP服务器连接
  checkMCPServerConnection: () => ipcRenderer.invoke('check-mcp-server-connection'),
  
  // 强制修复MCP服务器连接
  fixMCPServerConnection: () => ipcRenderer.invoke('fix-mcp-server-connection'),
  
  // 获取当前服务器端口
  getMCPServerPort: () => ipcRenderer.invoke('get-mcp-server-port'),
  
  // 新增API: 代理HTTP请求
  proxyRequest: (options) => ipcRenderer.invoke('proxy-request', options),
  
  // 新增API: 诊断MCP服务器
  diagnoseMCPServer: () => ipcRenderer.invoke('diagnose-mcp-server'),
  
  // 新增API: 注入调试帮助脚本
  injectDebugHelper: () => {
    // 在全局对象上添加debug helper
    window.mcpDebugHelper = {
      // 发送代理请求
      async sendRequest(method, url, data = null, headers = null) {
        return await window.electronAPI.proxyRequest({
          method,
          url,
          data,
          headers
        });
      },
      
      // 添加客户端的代理方法
      async addClient(clientName, clientConfig) {
        console.log('使用代理发送添加客户端请求:', clientName, clientConfig);
        return await window.electronAPI.proxyRequest({
          method: 'POST',
          url: '/mcp/clients',
          data: {
            name: clientName,
            ...clientConfig
          }
        });
      },
      
      // 运行诊断
      async runDiagnostics() {
        return await window.electronAPI.diagnoseMCPServer();
      },
      
      // 获取服务器信息
      async getServerInfo() {
        return {
          port: await window.electronAPI.getMCPServerPort(),
          status: await window.electronAPI.getMCPServerStatus(),
          health: await window.electronAPI.getMCPServerHealth(),
          connection: await window.electronAPI.checkMCPServerConnection()
        };
      },
      
      // 修复服务器
      async fixServer() {
        return await window.electronAPI.fixMCPServerConnection();
      }
    };
    
    console.log('已注入MCP调试助手，可通过window.mcpDebugHelper访问');
    return { success: true, message: '调试助手已注入' };
  }
});

console.log('预加载脚本已执行');

// 你也可以在这里进行其他的初始化工作
window.addEventListener('DOMContentLoaded', () => {
  console.log('Electron预加载完成');
}); 