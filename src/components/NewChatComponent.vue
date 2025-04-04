<script setup lang="ts">
import { onMounted, watch, onUnmounted } from 'vue';
import { 
  useChat, 
  useChatHistory, 
  useModelSettings, 
  useUIState,
  type ModelInfo 
} from '../composables';

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

// 定义代理函数，传递所需参数
const sendMessage = () => chatSendMessage(createNewChat, currentChatId.value, chatHistoryList.value, saveCurrentChat);
const clearChat = () => chatClearChat(currentChatId.value, chatHistoryList.value);
const loadChat = (chatId: string) => chatLoadChat(chatId, messages.value, mcpClient);
const deleteChat = (chatId: string, event?: Event) => chatDeleteChat(chatId, messages.value, mcpClient, event);
const saveSettings = () => modelSaveSettings(mcpClient, showNotification);
const selectModel = (newModelId: string) => modelSelectModel(newModelId, mcpClient, showNotification);
const selectCustomModel = (id: string) => modelSelectCustomModel(id, mcpClient, showNotification);
const addCustomModel = () => modelAddCustomModel(showNotification);

// 监听历史面板状态变化
watch(showHistoryPanel, (newVal) => {
  // 当历史面板显示时，添加show类
  const historyPanel = document.querySelector('.history-panel-left');
  if (historyPanel) {
    if (newVal) {
      historyPanel.classList.add('show');
    } else {
      historyPanel.classList.remove('show');
    }
  }
});

// 保存点击外部关闭事件的清理函数
let cleanupClickOutside: (() => void) | null = null;

// 组件挂载时初始化MCP客户端
onMounted(async () => {
  // 设置点击外部关闭下拉框，并保存清理函数
  cleanupClickOutside = setupClickOutsideListener(showModelDropdown);
  
  // 打印当前状态以便调试
  console.log('组件挂载时的状态:', {
    providerId: providerId.value,
    modelId: modelId.value,
    customModelId: customModelId.value,
    customModels: customModels.value,
    availableModels: availableModels.value,
  });
  
  // 检查是否设置了API Key
  if (!apiKey.value) {
    // 在页面上显示欢迎消息，而不是添加到聊天中
    return; // 如果没有API Key，不进行初始化
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

// 点击模型选择器时记录状态
const toggleModelDropdown = () => {
  showModelDropdown.value = !showModelDropdown.value;
  console.log('模型选择器状态:', {
    showModelDropdown: showModelDropdown.value,
    providerId: providerId.value,
    modelId: modelId.value,
    customModelId: customModelId.value,
    customModels: customModels.value,
    availableModels: availableModels.value,
  });
};
</script>

<template>
  <div class="chat-container">
    <!-- 遮罩层 -->
    <div 
      class="overlay" 
      v-if="showHistoryPanel || showSettings" 
      @click="closeAllPanels"
    ></div>
    
    <!-- 顶部通知 -->
    <div class="notification" v-if="showNotificationFlag" :class="{ 'show': showNotificationFlag }">
      {{ notification }}
    </div>
    
    <div class="chat-header">
      <div class="header-title">
        <h2>MCP 聊天</h2>
      </div>
      <div class="header-controls">
        <button class="icon-button clear-button" @click="clearChat" title="清除聊天记录">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
        <button class="icon-button settings-button" @click="toggleSettings" title="设置">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>
      <div class="model-info">
        <span class="provider-badge" :class="providerId">{{ currentProvider?.name || '自定义' }}</span>
        <span class="model-badge">{{ providerId === 'custom' ? customModelId : modelId }}</span>
      </div>
    </div>
    
    <!-- 设置面板 -->
    <div class="settings-panel" v-if="showSettings">
      <h3>API设置</h3>
      
      <div class="settings-group">
        <label for="provider">模型提供商:</label>
        <select id="provider" v-model="providerId" class="styled-select">
          <option v-for="provider in MODEL_PROVIDERS" :key="provider.id" :value="provider.id">
            {{ provider.name }}
          </option>
        </select>
      </div>
      
      <!-- 当选择自定义提供商时显示自定义设置 -->
      <div v-if="providerId === 'custom'" class="settings-group">
        <label for="customBaseUrl">自定义API基础URL:</label>
        <input 
          type="text" 
          id="customBaseUrl" 
          v-model="customBaseUrl" 
          placeholder="例如: https://api.example.com/v1"
          class="styled-input"
        />
        
        <label class="mt-3">自定义模型列表:</label>
        <div class="custom-models-list">
          <div v-for="model in customModels" :key="model.id" class="custom-model-item">
            <div class="custom-model-details">
              <div class="custom-model-id">{{ model.id }}</div>
              <div class="custom-model-name">{{ model.name }}</div>
            </div>
            <div class="custom-model-actions">
              <button 
                class="model-select-btn" 
                :class="{ active: customModelId === model.id }"
                @click="customModelId = model.id"
              >
                {{ customModelId === model.id ? '已选择' : '选择' }}
              </button>
              <button class="model-delete-btn" @click="removeCustomModel(model.id)">
                删除
              </button>
            </div>
          </div>
          
          <div class="add-custom-model">
            <div class="add-custom-model-inputs">
              <input 
                type="text" 
                v-model="newCustomModelId" 
                placeholder="模型ID (必填)" 
                class="styled-input"
              />
              <input 
                type="text" 
                v-model="newCustomModelName" 
                placeholder="模型名称 (可选)" 
                class="styled-input mt-2"
              />
              <input 
                type="text" 
                v-model="newCustomModelDesc" 
                placeholder="模型描述 (可选)" 
                class="styled-input mt-2"
              />
            </div>
            <button 
              class="add-model-btn" 
              @click="addCustomModel" 
              :disabled="!newCustomModelId.trim()"
            >
              添加模型
            </button>
          </div>
        </div>
      </div>
      
      <!-- 当不是自定义提供商时显示模型下拉列表 -->
      <div v-else class="settings-group">
        <label for="model">模型:</label>
        <select id="model" v-model="modelId" class="styled-select">
          <option v-for="model in availableModels" :key="model.id" :value="model.id">
            {{ model.id }} - {{ model.name }}
          </option>
        </select>
        <div class="model-description" v-if="modelId && currentModelDescription">
          {{ currentModelDescription }}
        </div>
      </div>
      
      <div class="settings-group">
        <label for="apiKey">API密钥:</label>
        <input 
          type="password" 
          id="apiKey" 
          v-model="apiKey" 
          placeholder="sk-..." 
          class="styled-input"
        />
        <small>当前API密钥: {{ maskedApiKey || '未设置' }}</small>
      </div>
      
      <div class="settings-actions">
        <button @click="saveSettings" class="save-button">保存设置</button>
        <button @click="showSettings = false" class="cancel-button">取消</button>
      </div>
    </div>
    
    <!-- 历史对话面板 - 从左侧弹出 -->
    <div class="history-panel-left" :class="{ 'show': showHistoryPanel }">
      <div class="history-panel-header">
        <h3>对话历史</h3>
        <button class="icon-button" @click="toggleHistoryPanel">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div class="history-list">
        <div v-if="chatHistoryList.length === 0" class="no-history">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="9" x2="15" y2="9"></line>
            <line x1="9" y1="12" x2="15" y2="12"></line>
            <line x1="9" y1="15" x2="13" y2="15"></line>
          </svg>
          <p>暂无对话历史</p>
        </div>
        <div 
          v-for="chat in chatHistoryList" 
          :key="chat.id"
          class="history-item"
          :class="{ active: chat.id === currentChatId }"
          @click="loadChat(chat.id)"
        >
          <div class="history-item-title">{{ chat.title || '新对话' }}</div>
          <div class="history-item-date">{{ new Date(chat.date).toLocaleDateString() }}</div>
          <button class="delete-history" @click.stop="deleteChat(chat.id)" title="删除此对话">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    </div>
    
    <div class="chat-messages">
      <div v-if="messages.length === 0" class="empty-chat">
        <div class="empty-chat-content">
          <h3>欢迎使用MCP聊天</h3>
          <p v-if="!apiKey">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="warning-icon">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            需要配置API密钥才能开始对话
          </p>
          <p v-else>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="chat-icon">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            开始新的对话
          </p>
          <div class="hint" v-if="!apiKey">
            <button @click="toggleSettings" class="hint-button">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              打开设置配置API密钥
            </button>
          </div>
          <div class="hint" v-else>
            <p>你可以尝试这些问题：</p>
            <ul class="example-questions">
              <li @click="newMessage = '查询北京的天气'; sendMessage()">查询北京的天气</li>
              <li @click="newMessage = '获取最新的科技新闻'; sendMessage()">获取最新的科技新闻</li>
              <li @click="newMessage = '帮我解释什么是大模型'; sendMessage()">帮我解释什么是大模型</li>
            </ul>
          </div>
        </div>
      </div>
      
      <div v-else>
        <div v-for="(message, index) in messages" :key="index" :class="['message', message.role]">
          <div class="message-avatar">
            <svg v-if="message.role === 'user'" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 16v-4"></path>
              <path d="M12 8h.01"></path>
            </svg>
          </div>
          <div class="message-content">
            <div v-html="formatMessage(message.content)"></div>
            <div class="message-time">{{ new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }}</div>
          </div>
        </div>
        <div v-if="isLoading" class="message assistant typing">
          <div class="message-avatar">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 16v-4"></path>
              <path d="M12 8h.01"></path>
            </svg>
          </div>
          <div class="message-content">
            <div class="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 底部控制栏 -->
    <div class="bottom-controls">
      <div class="model-selector-simple model-selector-dropdown" @click.stop="toggleModelDropdown">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <path d="M8 21h8"></path>
          <path d="M12 17v4"></path>
        </svg>
        <span class="current-model">{{ 
          providerId === 'custom' 
            ? (customModelId || '未选择模型')
            : availableModels.find((model: ModelInfo) => model.id === modelId)?.name || modelId 
        }}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
        
        <!-- 模型下拉列表，确保点击事件不会冒泡 -->
        <div class="models-dropdown-bottom model-selector-dropdown" v-if="showModelDropdown" @click.stop>
          <div v-if="providerId !== 'custom'">
            <div 
              v-for="model in availableModels" 
              :key="model.id" 
              class="model-option"
              :class="{ active: model.id === modelId }"
              @click.stop="selectModel(model.id)"
            >
              <div class="model-id">{{ model.id }}</div>
              <div class="model-name">{{ model.name }}</div>
            </div>
          </div>
          <div v-else>
            <div 
              v-for="model in customModels" 
              :key="model.id" 
              class="model-option"
              :class="{ active: model.id === customModelId }"
              @click.stop="selectCustomModel(model.id)"
            >
              <div class="model-id">{{ model.id }}</div>
              <div class="model-name">{{ model.name }}</div>
            </div>
            <div v-if="customModels.length === 0" class="no-models-message">
              <span @click.stop="toggleSettings">请在设置中添加自定义模型</span>
            </div>
          </div>
        </div>
      </div>
      
      <button class="bottom-button history-button" @click="toggleHistoryPanel" title="对话历史">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 8v4l3 3"></path>
          <circle cx="12" cy="12" r="10"></circle>
        </svg>
        <span>历史</span>
      </button>
      
      <button class="bottom-button new-chat-button" @click="createNewChat" title="新建对话">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5v14"></path>
          <path d="M5 12h14"></path>
        </svg>
        <span>新对话</span>
      </button>
    </div>
    
    <div class="chat-input">
      <input 
        v-model="newMessage" 
        @keyup.enter="sendMessage" 
        placeholder="输入您的消息..." 
        :disabled="isLoading || !apiKey"
      />
      <button @click="sendMessage" :disabled="isLoading || !newMessage.trim() || !apiKey">
        发送
      </button>
    </div>
  </div>
</template>

<style>
@import '../styles/chat.css';
</style> 