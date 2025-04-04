<script setup lang="ts">
// Window接口扩展，用于添加全局函数
declare global {
  interface Window {
    copyCode: (button: HTMLElement) => void;
  }
}

import { onMounted, watch, onUnmounted, nextTick } from 'vue';
import { 
  useChat, 
  useChatHistory, 
  useModelSettings, 
  useUIState,
  type ModelInfo,
  type ChatMessage
} from '../composables';

// 导入拆分后的组件
import ChatHeader from './ChatHeader.vue';
import ChatMessages from './ChatMessages.vue';
import ChatInput from './ChatInput.vue';
import SettingsPanel from './SettingsPanel.vue';
import ChatHistory from './ChatHistory.vue';
import BottomControls from './BottomControls.vue';
import NotificationBar from './NotificationBar.vue';
import ChatStyles from './ChatStyles.vue';

// 使用组合式API
const {
  messages,
  newMessage,
  isLoading,
  notification,
  showNotificationFlag,
  mcpClient,
  sendMessage: chatSendMessage,
  clearChat: chatClearChat,
  showNotification,
  formatMessage,
  initializeMCPClient,
  addMessageToHistory
} = useChat();

const {
  chatHistoryList,
  showHistoryPanel: chatShowHistoryPanel,
  currentChatId,
  createNewChat,
  loadChat: chatLoadChat,
  deleteChat: chatDeleteChat,
  saveCurrentChat
} = useChatHistory();

const {
  MODEL_PROVIDERS,
  apiKey,
  providerId,
  modelId,
  customBaseUrl,
  customModelId,
  customModels,
  newCustomModelId,
  newCustomModelName,
  newCustomModelDesc,
  showModelDropdown,
  currentProvider,
  availableModels,
  apiBaseUrl,
  effectiveModelId,
  maskedApiKey,
  currentModelDescription,
  saveSettings: modelSaveSettings,
  selectModel: modelSelectModel,
  selectCustomModel: modelSelectCustomModel,
  addCustomModel: modelAddCustomModel,
  removeCustomModel
} = useModelSettings();

const {
  showSettings,
  showHistoryPanel,
  toggleSettings,
  toggleHistoryPanel,
  closeAllPanels,
  setupClickOutsideListener
} = useUIState();

// 状态同步
watch(chatShowHistoryPanel, (value) => {
  showHistoryPanel.value = value;
});

watch(showHistoryPanel, (value) => {
  chatShowHistoryPanel.value = value;
});

// 手动实现面板切换函数，确保面板正确显示
const toggleSettingsPanel = () => {
  if (showHistoryPanel.value) showHistoryPanel.value = false;
  showSettings.value = !showSettings.value;
  
  // 确保DOM更新后设置面板已经显示
  if (showSettings.value) {
    nextTick(() => {
      const panel = document.querySelector('.settings-panel');
      if (panel) {
        panel.setAttribute('style', 'display: flex');
      }
    });
  }
};

const toggleHistoryPanelManual = () => {
  if (showSettings.value) showSettings.value = false;
  showHistoryPanel.value = !showHistoryPanel.value;
  
  // 直接操作DOM更新历史面板样式
  const historyPanel = document.querySelector('.history-panel-left');
  if (historyPanel) {
    if (showHistoryPanel.value) {
      historyPanel.classList.add('show');
    } else {
      historyPanel.classList.remove('show');
    }
  }
};

// 定义代理发送消息函数，添加滚动到底部的功能
const sendMessage = () => {
  chatSendMessage(createNewChat, currentChatId.value, chatHistoryList.value, saveCurrentChat);
  // 添加一个短暂延迟后滚动到底部，确保DOM更新完成
  setTimeout(() => {
    const chatMessagesElement = document.querySelector('.chat-messages');
    if (chatMessagesElement) {
      chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;
    }
  }, 50);
};

const clearChat = () => chatClearChat(currentChatId.value, chatHistoryList.value);
const loadChat = (chatId: string) => chatLoadChat(chatId, messages.value, mcpClient);
const deleteChat = (chatId: string, event?: Event) => chatDeleteChat(chatId, messages.value, mcpClient, event);
const saveSettings = () => modelSaveSettings(mcpClient, showNotification);
const selectModel = (newModelId: string) => modelSelectModel(newModelId, mcpClient, showNotification);
const selectCustomModel = (id: string) => modelSelectCustomModel(id, mcpClient, showNotification);
const addCustomModel = () => modelAddCustomModel(showNotification);

// 创建新对话的函数
const handleCreateNewChat = () => {
  createNewChat(messages.value, mcpClient);
};

// 定义代码复制函数
function addCopyCodeFunction() {
  window.copyCode = function(button: HTMLElement) {
    const codeBlock = button.closest('.code-block-wrapper')?.querySelector('code');
    if (!codeBlock) return;
    
    const textToCopy = codeBlock.textContent || '';
    
    navigator.clipboard.writeText(textToCopy).then(() => {
      // 更新按钮文本
      const originalHTML = button.innerHTML;
      button.innerHTML = '<span>已复制!</span>';
      
      // 2秒后恢复原始按钮文本
      setTimeout(() => {
        button.innerHTML = originalHTML;
      }, 2000);
    }).catch(err => {
      console.error('复制失败:', err);
      alert('复制失败，请手动复制');
    });
  };
}

// 处理来自ChatInput的消息发送
const handleSendMessage = (msg: string) => {
  newMessage.value = msg;
  sendMessage();
};

// 处理来自ChatMessages的模版消息使用
const useExampleMessage = (example: string) => {
  newMessage.value = example;
  sendMessage();
};

// 在模型选择器上切换下拉框
const toggleModelDropdown = () => {
  showModelDropdown.value = !showModelDropdown.value;
};

// 保存点击外部关闭事件的清理函数
let cleanupClickOutside: (() => void) | null = null;

// 组件挂载时初始化MCP客户端
onMounted(async () => {
  // 添加复制代码的功能
  addCopyCodeFunction();
  
  // 设置点击外部关闭下拉框，并保存清理函数
  cleanupClickOutside = setupClickOutsideListener(showModelDropdown);
  
  // 检查是否设置了API Key
  if (!apiKey.value) {
    // 如果没有API Key，不进行初始化
    return;
  }
  
  try {
    // 初始化MCP客户端
    await initializeMCPClient();
    
    // 加载当前对话（如果有）
    if (currentChatId.value) {
      const currentChat = chatHistoryList.value.find(chat => chat.id === currentChatId.value);
      if (currentChat) {
        // 加载对话消息
        messages.value = [...currentChat.messages];
        
        // 同步消息到MCPClient
        currentChat.messages.forEach(msg => {
          if (msg.role === 'user' || msg.role === 'assistant') {
            addMessageToHistory(msg);
          }
        });
      } else {
        // 如果找不到当前对话，创建一个新的
        createNewChat();
      }
    } else if (chatHistoryList.value.length > 0) {
      // 如果有历史对话但没有当前对话ID，加载最新的对话
      loadChat(chatHistoryList.value[0].id);
    }
  } catch (error) {
    console.error('初始化MCP客户端时出错:', error);
    messages.value.push({
      role: 'assistant',
      content: '初始化聊天服务失败，请检查配置或稍后重试。'
    });
  }
  
  // 确保历史面板有show类
  const historyPanel = document.querySelector('.history-panel-left');
  if (historyPanel && showHistoryPanel.value) {
    historyPanel.classList.add('show');
  }
});

// 组件卸载时清理资源
onUnmounted(() => {
  // 清理点击外部关闭事件监听器
  if (cleanupClickOutside) {
    cleanupClickOutside();
  }
});
</script>

<template>
  <div class="chat-container">
    <!-- 通知栏 -->
    <NotificationBar 
      :show="showNotificationFlag" 
      :message="notification" 
    />
    
    <!-- 头部组件 -->
    <ChatHeader 
      :providerId="providerId"
      :modelId="modelId"
      :customModelId="customModelId"
      :currentProvider="currentProvider"
      @clear-chat="clearChat"
      @toggle-settings="toggleSettingsPanel"
    />
    
    <!-- 设置面板 -->
    <SettingsPanel 
      :showSettings="showSettings"
      :apiKey="apiKey"
      :providerId="providerId"
      :modelId="modelId"
      :customBaseUrl="customBaseUrl"
      :customModelId="customModelId"
      :customModels="customModels"
      :newCustomModelId="newCustomModelId"
      :newCustomModelName="newCustomModelName"
      :newCustomModelDesc="newCustomModelDesc"
      :MODEL_PROVIDERS="MODEL_PROVIDERS"
      :availableModels="availableModels"
      :currentModelDescription="currentModelDescription"
      :maskedApiKey="maskedApiKey"
      @update:showSettings="showSettings = $event"
      @update:apiKey="apiKey = $event"
      @update:providerId="providerId = $event"
      @update:modelId="modelId = $event"
      @update:customBaseUrl="customBaseUrl = $event"
      @update:customModelId="customModelId = $event"
      @update:newCustomModelId="newCustomModelId = $event"
      @update:newCustomModelName="newCustomModelName = $event"
      @update:newCustomModelDesc="newCustomModelDesc = $event"
      @save-settings="saveSettings"
      @add-custom-model="addCustomModel"
      @remove-custom-model="removeCustomModel"
    />
    
    <!-- 历史对话面板 -->
    <ChatHistory
      :showHistoryPanel="showHistoryPanel"
      :chatHistoryList="chatHistoryList"
      :currentChatId="currentChatId"
      @toggle-history="toggleHistoryPanelManual"
      @load-chat="loadChat"
      @delete-chat="deleteChat"
    />
    
    <!-- 聊天消息区域 -->
    <ChatMessages
      :messages="messages"
      :hasApiKey="!!apiKey"
      :formatMessage="formatMessage"
      @open-settings="toggleSettingsPanel"
      @use-example="useExampleMessage"
    />
    
    <!-- 底部控制栏 -->
    <BottomControls
      :showSettings="showSettings"
      :providerId="providerId"
      :modelId="modelId"
      :customModelId="customModelId"
      :customModels="customModels"
      :availableModels="availableModels"
      :showModelDropdown="showModelDropdown"
      @toggle-model-dropdown="toggleModelDropdown"
      @select-model="selectModel"
      @select-custom-model="selectCustomModel"
      @toggle-history="toggleHistoryPanelManual"
      @create-new-chat="handleCreateNewChat"
      @open-settings="toggleSettingsPanel"
    />
    
    <!-- 消息输入区域 -->
    <ChatInput
      :isLoading="isLoading"
      :hasApiKey="!!apiKey"
      @send="handleSendMessage"
    />
    
    <!-- 全局样式 -->
    <ChatStyles />
  </div>
</template>

<style>
@import '../styles/chat.css';
</style> 