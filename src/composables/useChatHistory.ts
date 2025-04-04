import { ref, watch } from 'vue';

export interface ChatHistoryItem {
  id: string;
  title: string;
  date: string;
  messages: Array<{role: 'user' | 'assistant' | 'system', content: string}>;
}

export function useChatHistory() {
  // 对话历史列表
  const chatHistoryList = ref<ChatHistoryItem[]>(
    JSON.parse(localStorage.getItem('chatHistoryList') || '[]')
  );
  const showHistoryPanel = ref(false);
  const currentChatId = ref(localStorage.getItem('currentChatId') || '');

  // 如果当前没有选中的对话，但有历史对话，则选择最新的一个
  if (!currentChatId.value && chatHistoryList.value.length > 0) {
    currentChatId.value = chatHistoryList.value[0].id;
  }

  // 创建新对话
  function createNewChat(messages?: any[], mcpClient?: any) {
    const id = Date.now().toString();
    const newChat = {
      id,
      title: '新对话',
      date: new Date().toLocaleString(),
      messages: []
    };
    
    // 将新对话添加到历史列表最前面
    chatHistoryList.value.unshift(newChat);
    currentChatId.value = id;
    
    // 如果提供了消息数组，清空它
    if (messages) {
      messages.splice(0, messages.length);
    }
    
    // 如果提供了mcpClient，清空历史
    if (mcpClient) {
      mcpClient.clearHistory();
    }
    
    // 保存到本地存储
    localStorage.setItem('chatHistoryList', JSON.stringify(chatHistoryList.value));
    localStorage.setItem('currentChatId', currentChatId.value);
    
    return id;
  }

  // 加载对话
  function loadChat(chatId: string, messages: any[], mcpClient: any) {
    if (!chatId) return;
    
    const chat = chatHistoryList.value.find(c => c.id === chatId);
    if (!chat) return;
    
    // 更新当前对话ID
    currentChatId.value = chatId;
    localStorage.setItem('currentChatId', chatId);
    
    // 加载对话消息
    messages.splice(0, messages.length, ...chat.messages);
    
    // 同步消息到MCPClient
    mcpClient.clearHistory();
    // 这里只同步用户和助手的消息，不同步系统消息
    chat.messages.forEach(msg => {
      if (msg.role === 'user' || msg.role === 'assistant') {
        mcpClient.addMessageToHistory(msg);
      }
    });
    
    // 关闭历史面板
    showHistoryPanel.value = false;
  }

  // 删除对话
  function deleteChat(chatId: string, messages: any[], mcpClient: any, event?: Event) {
    if (event) {
      event.stopPropagation(); // 阻止事件冒泡
    }
    
    // 从列表中移除
    chatHistoryList.value = chatHistoryList.value.filter(chat => chat.id !== chatId);
    
    // 如果删除的是当前对话，切换到最新的对话或创建新对话
    if (chatId === currentChatId.value) {
      if (chatHistoryList.value.length > 0) {
        loadChat(chatHistoryList.value[0].id, messages, mcpClient);
      } else {
        currentChatId.value = '';
        messages.splice(0, messages.length);
        mcpClient.clearHistory();
      }
    }
    
    // 更新本地存储
    localStorage.setItem('chatHistoryList', JSON.stringify(chatHistoryList.value));
  }

  // 保存当前对话
  function saveCurrentChat(messages: any[]) {
    // 查找当前对话
    const chatIndex = chatHistoryList.value.findIndex(chat => chat.id === currentChatId.value);
    if (chatIndex === -1) return;
    
    // 更新对话内容
    chatHistoryList.value[chatIndex].messages = [...messages];
    chatHistoryList.value[chatIndex].date = new Date().toLocaleString();
    
    // 保存到本地存储
    localStorage.setItem('chatHistoryList', JSON.stringify(chatHistoryList.value));
  }

  return {
    chatHistoryList,
    showHistoryPanel,
    currentChatId,
    createNewChat,
    loadChat,
    deleteChat,
    saveCurrentChat
  };
} 