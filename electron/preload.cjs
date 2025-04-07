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
  }
});

console.log('预加载脚本已执行');

// 你也可以在这里进行其他的初始化工作
window.addEventListener('DOMContentLoaded', () => {
  console.log('Electron预加载完成');
}); 