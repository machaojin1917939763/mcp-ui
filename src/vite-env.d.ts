/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// Electron API类型
interface Window {
  electronAPI?: {
    sendMessage: (message: string) => void;
    onReply: (callback: (reply: string) => void) => void;
    platform: string;
  };
}
