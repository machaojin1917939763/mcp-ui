const { contextBridge, ipcRenderer } = require('electron');

// 通过contextBridge暴露API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 发送消息到主进程
  sendMessage: (message) => ipcRenderer.send('example-message', message),
  
  // 接收主进程的回复
  onReply: (callback) => {
    ipcRenderer.on('example-reply', (event, args) => callback(args));
  },
  
  // 平台信息
  platform: process.platform
});

// 你也可以在这里进行其他的初始化工作
window.addEventListener('DOMContentLoaded', () => {
  console.log('Electron预加载完成');
}); 