import { ref, computed, watch } from 'vue';
import { MCPClient } from '../utils/MCPClient';
import type { ChatHistoryItem } from './useChatHistory';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
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
      content: newMessage.value
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
      // 处理消息并获取响应
      const response = await mcpClient.processQuery(userMessage);
      
      // 添加助手响应
      messages.value.push({
        role: 'assistant',
        content: response
      });
      
      // 保存当前对话到历史记录
      saveCurrentChat(messages.value);
    } catch (error) {
      console.error('处理消息时出错:', error);
      messages.value.push({
        role: 'assistant',
        content: '抱歉，处理您的请求时发生错误。'
      });
      
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
    // 简单的文本格式化处理，将换行转换为<br>
    return content.replace(/\n/g, '<br>');
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