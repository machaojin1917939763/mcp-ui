import { ref, computed, watch } from 'vue';
import { MCPClient } from '../utils/MCPClient';
import type { ChatHistoryItem } from './useChatHistory';
import { marked } from 'marked';
import hljs from 'highlight.js';

// 配置marked的渲染器
const renderer = new marked.Renderer();
// 配置marked 
marked.setOptions({
  renderer: renderer,
  breaks: true,  // 将换行符转换为<br>
  gfm: true,     // 启用GitHub风格的Markdown
});

// 添加代码高亮
const markedHighlight = {
  highlight: function(code: string, lang: string) {
    try {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      } else {
        return hljs.highlightAuto(code).value;
      }
    } catch (e) {
      console.error('代码高亮失败:', e);
      return code;
    }
  }
};

// 应用marked配置
marked.use(markedHighlight as any);

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  // 新增字段，用于标记消息是否完成
  isComplete?: boolean;
}

export function useChat() {
  // 界面相关状态
  const messages = ref<ChatMessage[]>([]);
  const newMessage = ref('');
  const isLoading = ref(false);
  const showSettings = ref(false); // 是否显示设置面板
  
  // 通知状态
  const notification = ref('');
  const showNotificationFlag = ref(false);

  // MCP客户端实例
  const mcpClient = new MCPClient();
  
  // 发送消息
  async function sendMessage(
    createNewChat: () => string,
    currentChatId: string, 
    chatHistoryList: ChatHistoryItem[],
    saveCurrentChat: (messages: ChatMessage[]) => void
  ) {
    if (!newMessage.value.trim()) return;
    
    // 如果没有当前对话，创建一个新对话
    if (!currentChatId) {
      createNewChat();
    }
    
    // 添加用户消息
    messages.value.push({
      role: 'user',
      content: newMessage.value,
      isComplete: true
    });
    
    // 清空输入框并设置加载状态
    const userMessage = newMessage.value;
    newMessage.value = '';
    isLoading.value = true;
    
    // 更新对话标题（如果是第一条消息）
    const currentChat = chatHistoryList.find(chat => chat.id === currentChatId);
    if (currentChat && currentChat.messages.length === 0) {
      // 如果是对话的第一条消息，将其设为标题（最多20个字符）
      currentChat.title = userMessage.length > 20 ? userMessage.substring(0, 20) + '...' : userMessage;
    }
    
    try {
      // 添加一个初始的助手消息占位符，用于流式更新
      const assistantMessageIndex = messages.value.length;
      messages.value.push({
        role: 'assistant',
        content: '',
        isComplete: false
      });
      
      // 滚动到底部（确保新消息可见）
      setTimeout(() => {
        const chatMessages = document.querySelector('.chat-messages');
        if (chatMessages) {
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
      }, 10);
      
      // 定义处理流式响应的回调函数
      const handleStreamChunk = (chunk: string) => {
        // 更新消息内容
        if (messages.value[assistantMessageIndex]) {
          messages.value[assistantMessageIndex].content += chunk;
        }
      };
      
      // 处理消息并获取流式响应
      const finalResponse = await mcpClient.processStreamQuery(userMessage, handleStreamChunk);
      
      // 标记消息已完成
      if (messages.value[assistantMessageIndex]) {
        messages.value[assistantMessageIndex].isComplete = true;
      }
      
      // 保存当前对话到历史记录
      saveCurrentChat(messages.value);
    } catch (error) {
      console.error('处理消息时出错:', error);
      
      // 如果还没有添加助手消息，添加一个错误消息
      const errorMessage = '抱歉，处理您的请求时发生错误。';
      if (messages.value.length > 0 && messages.value[messages.value.length - 1].role === 'assistant') {
        // 更新已存在的消息
        messages.value[messages.value.length - 1].content += '\n\n' + errorMessage;
        messages.value[messages.value.length - 1].isComplete = true;
      } else {
        // 添加新的错误消息
        messages.value.push({
          role: 'assistant',
          content: errorMessage,
          isComplete: true
        });
      }
      
      // 即使出错也保存对话
      saveCurrentChat(messages.value);
    } finally {
      isLoading.value = false;
    }
  }
  
  // 清除聊天记录函数
  function clearChat(currentChatId: string, chatHistoryList: ChatHistoryItem[]) {
    if (isLoading.value) return;
    
    // 清空当前消息
    messages.value = [];
    mcpClient.clearHistory();
    
    // 如果有当前对话，则更新它
    if (currentChatId) {
      const chatIndex = chatHistoryList.findIndex(chat => chat.id === currentChatId);
      if (chatIndex !== -1) {
        chatHistoryList[chatIndex].messages = [];
        chatHistoryList[chatIndex].title = '空对话';
        localStorage.setItem('chatHistoryList', JSON.stringify(chatHistoryList));
      }
    }
  }
  
  // 显示通知的函数
  function showNotification(message: string) {
    notification.value = message;
    showNotificationFlag.value = true;
    
    // 3秒后自动关闭通知
    setTimeout(() => {
      showNotificationFlag.value = false;
    }, 3000);
  }
  
  // 格式化消息
  function formatMessage(content: string): string {
    try {
      // 使用marked解析Markdown
      return marked.parse(content) as string;
    } catch (error) {
      console.error('Markdown解析失败:', error);
      // 如果解析失败，退回到简单的文本格式化
      return content.replace(/\n/g, '<br>');
    }
  }
  
  // 初始化MCP客户端
  function initializeMCPClient() {
    return mcpClient.initialize();
  }
  
  // 添加消息到历史记录
  function addMessageToHistory(message: ChatMessage) {
    mcpClient.addMessageToHistory(message);
  }
  
  return {
    messages,
    newMessage,
    isLoading,
    showSettings,
    notification,
    showNotificationFlag,
    mcpClient,
    sendMessage,
    clearChat,
    showNotification,
    formatMessage,
    initializeMCPClient,
    addMessageToHistory
  };
} 