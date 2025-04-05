<script setup lang="ts">
// Window接口扩展，用于添加全局函数
declare global {
  interface Window {
    copyCode: (button: HTMLElement) => void;
  }
}

import { onMounted, watch, onUnmounted, nextTick, ref } from 'vue';
import { 
  useChat, 
  useChatHistory, 
  useModelSettings, 
  useUIState,
  useMCPSettings,
  type ModelInfo,
  type ChatMessage
} from '../composables';

// 导入拆分后的组件
import ChatHeader from './ChatHeader.vue';
import ChatMessages from './ChatMessages.vue';
import ChatInput from './ChatInput.vue';
import SettingsPanel from './SettingsPanel.vue';
import BottomControls from './BottomControls.vue';
import NotificationBar from './NotificationBar.vue';
import ChatStyles from './ChatStyles.vue';
import ToolsPanel from './ToolsPanel.vue';

// 使用组合式API
const {
  messages,
  newMessage,
  isLoading,
  notification,
  showNotificationFlag,
  notificationType,
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
  providerApiKeys,
  getCurrentModelState,
  saveSettings: modelSaveSettings,
  selectModel: modelSelectModel,
  selectCustomModel: modelSelectCustomModel,
  addCustomModel: modelAddCustomModel,
  removeCustomModel,
  providerModels
} = useModelSettings();

// MCP设置
const {
  mcpServers,
  enabledMcpServers,
  newMcpServerId,
  newMcpServerName,
  newMcpServerUrl,
  newMcpServerDesc,
  newMcpServerTransport,
  newMcpServerCommand,
  newMcpServerArgs,
  addMcpServer: mcpAddServer,
  toggleMcpServerStatus: mcpToggleServerStatus,
  removeMcpServer: mcpRemoveServer,
  saveMcpServers,
  updateMcpServerArg: mcpUpdateArg,
  addMcpServerArg: mcpAddArg,
  removeMcpServerArg: mcpRemoveArg
} = useMCPSettings();

const {
  showSettings,
  showHistoryPanel,
  toggleSettings,
  toggleHistoryPanel,
  closeAllPanels,
  setupClickOutsideListener
} = useUIState();

// 添加服务器状态、工具和展开状态引用
const serverConnectionStatus = ref<Record<string, { connected?: boolean; checking?: boolean; error?: string; lastChecked?: number; message?: string }>>({});
const serverTools = ref<Record<string, Array<{name: string, description?: string, enabled?: boolean}>>>({});
const expandedToolServers = ref<string[]>([]);

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
    const chatMessagesElement = document.querySelector('.messages-container');
    if (chatMessagesElement) {
      chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight;
    }
  }, 50);
};

const clearChat = () => chatClearChat(currentChatId.value, chatHistoryList.value);
const loadChat = (chatId: string) => chatLoadChat(chatId, messages.value, mcpClient);
const deleteChat = (chatId: string, event?: Event) => chatDeleteChat(chatId, messages.value, mcpClient, event);
const saveSettings = () => {
  // 保存模型设置
  modelSaveSettings(mcpClient, showNotification);
  // 保存MCP服务器设置
  saveMcpServers(mcpClient);
};
const selectModel = (newModelId: string) => {
  console.log('选择模型前的状态:', getCurrentModelState());
  modelSelectModel(newModelId, mcpClient, showNotification);
  
  // 检查模型选择后的状态
  setTimeout(() => {
    console.log('选择模型后的状态:', getCurrentModelState());
    console.log('MCPClient状态:', {
      providerId: mcpClient.getProviderId(),
      model: mcpClient.getModel()
    });
  }, 500);
};
const selectCustomModel = (id: string) => {
  console.log('选择自定义模型前的状态:', getCurrentModelState());
  modelSelectCustomModel(id, mcpClient, showNotification);
  
  // 检查模型选择后的状态
  setTimeout(() => {
    console.log('选择自定义模型后的状态:', getCurrentModelState());
    console.log('MCPClient状态:', {
      providerId: mcpClient.getProviderId(),
      model: mcpClient.getModel()
    });
  }, 500);
};
const addCustomModel = (providerId?: string) => modelAddCustomModel(showNotification, providerId);
const addMcpServer = () => mcpAddServer(showNotification);
const updateProviderApiKey = (apiKeyUpdate: Record<string, string>) => {
  // 将新的API密钥合并到现有的providerApiKeys中
  const provider = Object.keys(apiKeyUpdate)[0];
  const value = apiKeyUpdate[provider];
  
  // 更新API密钥
  providerApiKeys.value = { ...providerApiKeys.value, [provider]: value };
  
  // 如果是当前选中的提供商，同时更新apiKey（向后兼容）
  if (provider === providerId.value) {
    apiKey.value = value;
  }
  
  // 自动保存到localStorage
  localStorage.setItem('providerApiKeys', JSON.stringify(providerApiKeys.value));
};
const toggleMcpServerStatus = (id: string) => {
  mcpToggleServerStatus(id);
  // 更新MCP服务器配置到MCPClient
  saveMcpServers(mcpClient);
};
const removeMcpServer = (id: string) => {
  mcpRemoveServer(id);
  // 更新MCP服务器配置到MCPClient
  saveMcpServers(mcpClient);
};

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
      const originalText = button.querySelector('span')?.textContent || '复制';
      const span = button.querySelector('span');
      if (span) span.textContent = '已复制!';
      
      // 添加复制成功样式
      button.classList.add('copied');
      
      // 2秒后恢复原始按钮文本
      setTimeout(() => {
        if (span) span.textContent = originalText;
        button.classList.remove('copied');
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

// 用于存储事件处理函数引用的变量
let toolsUpdateHandler: EventListener;

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
  
  // 创建事件处理函数
  toolsUpdateHandler = ((event: CustomEvent) => {
    const { serverId, tools } = event.detail;
    console.log(`收到服务器 ${serverId} 工具更新事件，工具数量: ${tools.length}`);
    serverTools.value[serverId] = tools;
    
    // 更新服务器状态
    serverConnectionStatus.value[serverId] = {
      connected: true,
      checking: false,
      lastChecked: Date.now(),
      message: `成功加载了 ${tools.length} 个工具`
    };
  }) as EventListener;
  
  // 添加事件监听器
  window.addEventListener('mcp-tools-update', toolsUpdateHandler);
  
  try {
    // 初始化MCP客户端
    await initializeMCPClient();
    
    // 提前检查是否有保存的聊天历史
    handleAppLoad();
  } catch (error) {
    console.error('初始化客户端失败:', error);
  }
  
  // 确保历史面板有show类
  const historyPanel = document.querySelector('.history-panel-left');
  if (historyPanel && showHistoryPanel.value) {
    historyPanel.classList.add('show');
  }
});

// 组件卸载时清理资源
onUnmounted(() => {
  // 移除事件监听器
  if (toolsUpdateHandler) {
    window.removeEventListener('mcp-tools-update', toolsUpdateHandler);
  }
  
  // 清除外部点击监听
  if (typeof cleanupClickOutside === 'function') {
    cleanupClickOutside();
  }
});

// 添加MCP服务器参数更新函数
const updateMcpServerArg = (data: { index: number, value: string }) => {
  mcpUpdateArg(data);
};

const addMcpServerArg = () => {
  mcpAddArg();
};

const removeMcpServerArg = (index: number) => {
  mcpRemoveArg(index);
};

// 处理MCP服务器状态切换
function handleMcpServerStatusToggle(id: string) {
  // 切换服务器状态
  toggleMcpServerStatus(id);
  
  // 更新MCP客户端配置
  mcpClient.updateMcpServers(mcpServers.value);
}

// 处理请求获取服务器工具列表
async function requestToolsInfo(serverId: string) {
  console.log(`请求获取服务器 ${serverId} 的工具信息`);
  
  // 查找服务器配置
  const server = mcpServers.value.find((s: { id: string }) => s.id === serverId);
  if (!server || !server.enabled) return;
  
  try {
    // 更新服务器状态为正在加载工具
    serverConnectionStatus.value[serverId] = {
      checking: true,
      connected: false,
      lastChecked: Date.now(),
      message: '正在加载工具列表...'
    };
    
    // 通过MCP客户端更新服务器配置
    mcpClient.updateMcpServers(mcpServers.value);
    
    // 尝试从MCP客户端获取此服务器的工具列表
    const toolsList = await mcpClient.getMcpServerTools(serverId);
    
    // 更新服务器工具列表数据
    serverTools.value[serverId] = toolsList;
    
    // 更新服务器状态为已连接
    serverConnectionStatus.value[serverId] = {
      connected: true,
      checking: false,
      lastChecked: Date.now(),
      message: `成功加载了 ${toolsList.length} 个工具`
    };
    
    // 自动展开工具列表
    if (!expandedToolServers.value.includes(serverId)) {
      expandedToolServers.value.push(serverId);
    }
    
    // 更新显示
    showNotification(`成功获取到服务器 ${serverId} 的工具列表，共 ${toolsList.length} 个工具`);
  } catch (error) {
    console.error(`获取服务器 ${serverId} 工具列表失败:`, error);
    
    // 更新服务器状态为加载失败
    serverConnectionStatus.value[serverId] = {
      connected: false,
      checking: false,
      lastChecked: Date.now(),
      message: `加载工具失败: ${(error as Error).message}`
    };
    
    showNotification(`无法获取服务器 ${serverId} 的工具列表: ${(error as Error).message}`);
  }
}

// 处理工具启用/禁用状态变更
const handleToggleTool = (event: { serverId: string, toolName: string, enabled: boolean }) => {
  console.log(`工具状态变更: ${event.serverId}.${event.toolName} => ${event.enabled ? '启用' : '禁用'}`);
  // 在这里可以根据需要添加更多逻辑，例如更新配置或通知服务器
};

// 处理重新回答请求
const handleRegenerateAnswer = async (groupIndex: number) => {
  if (isLoading.value) return;
  
  // 每两条消息为一组（用户+AI），找到对应组的用户消息
  const userMessageIndex = groupIndex * 2;
  if (userMessageIndex >= messages.value.length) {
    showNotification('无法找到要重新回答的消息', 'warning');
    return;
  }
  
  // 获取用户问题
  const userMessage = messages.value[userMessageIndex];
  if (!userMessage || userMessage.role !== 'user') {
    showNotification('找不到对应的用户消息', 'warning');
    return;
  }
  
  const userQuestion = userMessage.content;
  
  // 设置加载状态
  isLoading.value = true;
  
  try {
    // 在用户消息之后查找AI回答的消息
    const assistantMessageIndex = userMessageIndex + 1;
    
    // 检查AI回答消息是否存在
    if (assistantMessageIndex >= messages.value.length ||
        messages.value[assistantMessageIndex].role !== 'assistant') {
      showNotification('找不到对应的AI回答消息', 'warning');
      isLoading.value = false;
      return;
    }
    
    // 重置现有的AI回答内容，而不是添加新消息
    messages.value[assistantMessageIndex].content = '';
    messages.value[assistantMessageIndex].isComplete = false;
    messages.value[assistantMessageIndex].toolCalls = [];
    
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
    let currentToolCalls: Array<{name: string, params: Record<string, unknown>, timestamp: number}> = [];

    // 定义工具调用处理器
    const handleToolCall = (toolCall: any) => {
      // 创建工具调用对象
      const newToolCall = {
        ...toolCall,
        timestamp: Date.now()
      };
      
      // 添加到当前工具调用列表
      currentToolCalls.push(newToolCall);
      
      // 更新消息的工具调用列表
      if (messages.value[assistantMessageIndex]) {
        messages.value[assistantMessageIndex].toolCalls = [...currentToolCalls];
      }
    };
    
    // 清除之前的聊天历史以确保回答不受之前对话的影响
    mcpClient.clearHistory();
    
    // 将当前用户消息添加到历史
    mcpClient.addMessageToHistory({
      role: 'user',
      content: userQuestion
    });
    
    // 重新处理用户消息，获取新的回答
    const finalResponse = await mcpClient.processStreamQuery(
      userQuestion, 
      handleStreamChunk,
      handleToolCall
    );
    
    // 标记消息已完成
    if (messages.value[assistantMessageIndex]) {
      messages.value[assistantMessageIndex].isComplete = true;
      // 添加时间戳
      messages.value[assistantMessageIndex].timestamp = Date.now();
    }
    
    // 保存当前对话到历史记录
    saveCurrentChat(messages.value);
    
    // 显示成功通知
    showNotification('已重新生成回答', 'success');
  } catch (error) {
    console.error('重新回答时出错:', error);
    showNotification('重新生成回答失败', 'error');
  } finally {
    isLoading.value = false;
  }
};

// 状态变量
const showBottomControlsPanel = ref(false);

// 处理底部控制栏显示/隐藏
const toggleBottomControlsPanel = (show: boolean) => {
  showBottomControlsPanel.value = show;
};

// 处理应用加载时的初始化
const handleAppLoad = () => {
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
  
  // 更新MCP服务器配置到MCPClient
  if (mcpClient) {
    saveMcpServers(mcpClient);
  }
};
</script>

<template>
  <div class="chat-container">
    <!-- 通知栏 -->
    <NotificationBar 
      :show="showNotificationFlag" 
      :message="notification" 
      :type="notificationType"
      @close="showNotificationFlag = false"
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
      :providerModels="providerModels"
      :newCustomModelId="newCustomModelId"
      :newCustomModelName="newCustomModelName"
      :newCustomModelDesc="newCustomModelDesc"
      :MODEL_PROVIDERS="MODEL_PROVIDERS"
      :availableModels="availableModels"
      :currentModelDescription="currentModelDescription"
      :maskedApiKey="maskedApiKey"
      :mcpServers="mcpServers"
      :newMcpServerId="newMcpServerId"
      :newMcpServerName="newMcpServerName"
      :newMcpServerUrl="newMcpServerUrl"
      :newMcpServerDesc="newMcpServerDesc"
      :newMcpServerTransport="newMcpServerTransport"
      :newMcpServerCommand="newMcpServerCommand"
      :newMcpServerArgs="newMcpServerArgs"
      :serverConnectionStatus="serverConnectionStatus"
      :serverTools="serverTools"
      :expandedToolServers="expandedToolServers"
      :providerApiKeys="providerApiKeys"
      @update:showSettings="showSettings = $event"
      @update:apiKey="apiKey = $event"
      @update:providerId="providerId = $event"
      @update:modelId="modelId = $event"
      @update:customBaseUrl="customBaseUrl = $event"
      @update:customModelId="customModelId = $event"
      @update:newCustomModelId="newCustomModelId = $event"
      @update:newCustomModelName="newCustomModelName = $event"
      @update:newCustomModelDesc="newCustomModelDesc = $event"
      @update:newMcpServerId="newMcpServerId = $event"
      @update:newMcpServerName="newMcpServerName = $event"
      @update:newMcpServerUrl="newMcpServerUrl = $event"
      @update:newMcpServerDesc="newMcpServerDesc = $event"
      @update:newMcpServerTransport="newMcpServerTransport = $event"
      @update:newMcpServerCommand="newMcpServerCommand = $event"
      @update:expandedToolServers="expandedToolServers = $event"
      @update:providerApiKey="updateProviderApiKey($event)"
      @update-mcp-server-args="mcpUpdateArg($event)"
      @add-mcp-server-arg="mcpAddArg"
      @remove-mcp-server-arg="mcpRemoveArg($event)"
      @save-settings="saveSettings"
      @add-custom-model="addCustomModel"
      @remove-custom-model="removeCustomModel"
      @add-mcp-server="addMcpServer"
      @toggle-mcp-server-status="handleMcpServerStatusToggle"
      @remove-mcp-server="removeMcpServer"
      @request-tools-info="requestToolsInfo"
    />
    
    <!-- 聊天消息区域 -->
    <ChatMessages
      :messages="messages"
      :hasApiKey="!!apiKey"
      :formatMessage="formatMessage"
      @open-settings="toggleSettingsPanel"
      @use-example="useExampleMessage"
      @regenerate="handleRegenerateAnswer"
    />
    
    <!-- 底部控制栏 -->
    <div class="bottom-controls-container">
      <transition name="slide-up">
        <BottomControls
          v-if="showBottomControlsPanel"
          :providerId="providerId"
          :modelId="modelId"
          :customModelId="customModelId"
          :customModels="customModels"
          :availableModels="availableModels"
          :showSettings="showSettings"
          :showModelDropdown="showModelDropdown"
          :providerModels="providerModels"
          :MODEL_PROVIDERS="MODEL_PROVIDERS"
          @toggle-model-dropdown="toggleModelDropdown"
          @select-model="selectModel"
          @select-custom-model="selectCustomModel"
          @create-new-chat="handleCreateNewChat"
          @open-settings="toggleSettingsPanel"
        >
          <ToolsPanel 
            :server-tools="serverTools"
            :mcp-servers="mcpServers"
            @toggle-tool="handleToggleTool"
          />
        </BottomControls>
      </transition>
    </div>
    
    <!-- 集成的消息输入和历史面板区域 -->
    <ChatInput
      :isLoading="isLoading"
      :hasApiKey="!!apiKey"
      :showHistoryPanel="showHistoryPanel"
      :chatHistoryList="chatHistoryList"
      :currentChatId="currentChatId"
      @send="handleSendMessage"
      @toggle-history="toggleHistoryPanelManual"
      @load-chat="loadChat"
      @delete-chat="deleteChat"
      @create-new-chat="handleCreateNewChat"
      @toggle-bottom-controls="toggleBottomControlsPanel"
    />
    
    <!-- 全局样式 -->
    <ChatStyles />
  </div>
</template>

<style>
@import '../styles/chat.css';

/* 底部控制栏动画 */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(20px);
  opacity: 0;
}
</style>