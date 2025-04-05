import { ref } from 'vue';

// 定义Electron API类型
declare global {
  interface Window {
    electronAPI?: {
      sendMessage: (message: string) => void;
      onReply: (callback: (reply: string) => void) => void;
      platform: string;
    };
  }
}

// 检查是否在Electron环境中运行
const isElectron = (): boolean => {
  return window.electronAPI !== undefined;
};

export function useElectron() {
  const reply = ref<string>('');
  const platform = ref<string>('');
  
  // 初始化
  if (isElectron()) {
    platform.value = window.electronAPI?.platform || '';
    
    // 设置接收主进程回复的监听器
    window.electronAPI?.onReply((message: string) => {
      reply.value = message;
    });
  }
  
  // 发送消息到主进程
  const sendMessage = (message: string): void => {
    if (isElectron() && window.electronAPI) {
      window.electronAPI.sendMessage(message);
    } else {
      console.warn('Not running in Electron environment');
    }
  };
  
  return {
    isElectron: isElectron(),
    platform,
    reply,
    sendMessage
  };
} 