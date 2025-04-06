<template>
  <div class="chat-input-container">
    <!-- 集成的聊天输入区域 -->
    <div class="chat-input-wrapper" :class="{ 'controls-active': showBottomControls }">
      <!-- 左侧按钮区 -->
      <div class="input-actions-left">
        <button 
          class="history-toggle-btn" 
          @click="toggleHistoryPanel" 
          :class="{ 'active': showHistoryPanel }" 
          title="历史记录"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 8v4l3 3"></path>
            <circle cx="12" cy="12" r="10"></circle>
          </svg>
        </button>
        
        <!-- 添加"+"按钮控制BottomControls显示 -->
        <button 
          class="tools-toggle-btn" 
          @click="toggleBottomControls" 
          :class="{ 'active': showBottomControls }" 
          title="工具栏"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>
    
      <!-- 中间的输入框 -->
      <input 
        v-model="message" 
        @keyup.enter="sendMessage" 
        placeholder="输入您的消息..." 
        :disabled="isLoading || !hasApiKey"
        class="chat-input-field"
      />
    
      <!-- 右侧按钮区 -->
      <div class="input-actions-right">
        <button 
          @click="newChatAction" 
          class="new-chat-btn" 
          title="新对话"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14M5 12h14"></path>
          </svg>
        </button>
        <button 
          @click="sendMessage" 
          class="send-btn" 
          :disabled="isLoading || !message.trim() || !hasApiKey"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
    
    <!-- 历史对话面板 (在输入框下方) -->
    <div v-if="showHistoryPanel" class="history-panel-bottom">
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
        <div v-if="!chatHistoryList || chatHistoryList.length === 0" class="no-history">
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
          @click="$emit('load-chat', chat.id)"
        >
          <div class="history-item-title">{{ chat.title || '新对话' }}</div>
          <div class="history-item-date">{{ new Date(chat.date).toLocaleDateString() }}</div>
          <button class="delete-history" @click.stop="$emit('delete-chat', chat.id)" title="删除此对话">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, defineProps, defineEmits } from 'vue';

interface ChatHistory {
  id: string;
  title: string;
  date: string;
  messages: any[];
}

const props = defineProps({
  isLoading: {
    type: Boolean,
    default: false
  },
  hasApiKey: {
    type: Boolean,
    default: false
  },
  showHistoryPanel: {
    type: Boolean,
    default: false
  },
  chatHistoryList: {
    type: Array as () => ChatHistory[],
    default: () => []
  },
  currentChatId: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['send', 'toggle-history', 'load-chat', 'delete-chat', 'create-new-chat', 'toggle-bottom-controls']);
const message = ref('');
const showBottomControls = ref(false);

const sendMessage = () => {
  if (!message.value.trim() || props.isLoading || !props.hasApiKey) return;
  
  emit('send', message.value);
  message.value = '';
};

const toggleHistoryPanel = () => {
  emit('toggle-history');
  
  // 如果底部控制栏打开，则关闭它
  if (showBottomControls.value) {
    toggleBottomControls();
  }
};

const toggleBottomControls = () => {
  showBottomControls.value = !showBottomControls.value;
  emit('toggle-bottom-controls', showBottomControls.value);
  
  // 如果历史面板打开，则关闭它
  if (props.showHistoryPanel && showBottomControls.value) {
    emit('toggle-history');
  }
};

const newChatAction = () => {
  emit('create-new-chat');
  // 如果历史面板打开，则关闭它
  if (props.showHistoryPanel) {
    emit('toggle-history');
  }
};
</script>

<style scoped>
.chat-input-container {
  position: relative;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px 20px 20px;
  z-index: 100;
}

/* 当底部控制栏激活时调整输入框样式 */
.chat-input-wrapper {
  display: flex;
  align-items: center;
  background-color: white;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 5px;
  position: relative;
  z-index: 100;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.input-actions-left,
.input-actions-right {
  display: flex;
  align-items: center;
}

.input-actions-left {
  gap: 6px;
}

.history-toggle-btn,
.tools-toggle-btn,
.new-chat-btn,
.send-btn {
  background: none;
  border: none;
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s ease;
  color: #555;
}

.history-toggle-btn:hover,
.tools-toggle-btn:hover,
.new-chat-btn:hover {
  background-color: #f0f0f0;
  color: #333;
  transform: scale(1.05);
}

.history-toggle-btn.active,
.tools-toggle-btn.active {
  background-color: #1064a3;
  color: white;
}

.tools-toggle-btn svg {
  transition: transform 0.3s ease, color 0.3s ease;
}

.tools-toggle-btn.active svg {
  transform: rotate(45deg);
}

.send-btn {
  background-color: #1064a3;
  color: white;
  margin-left: 5px;
}

.send-btn:hover:not(:disabled) {
  background-color: #0d5182;
}

.send-btn:disabled {
  background-color: #a0a0a0;
  cursor: not-allowed;
}

.chat-input-field {
  flex: 1;
  border: none;
  outline: none;
  padding: 10px 15px;
  font-size: 16px;
  background: transparent;
}

.chat-input-field::placeholder {
  color: #aaa;
}

/* 历史面板样式 */
.history-panel-bottom {
  position: absolute;
  top: -320px;
  left: 20px;
  right: 20px;
  height: 300px;
  background-color: white;
  border-radius: 10px 10px 0 0;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  z-index: 99;
  animation: slide-up 0.3s ease;
  border: 1px solid #eaeaea;
  border-bottom: none;
}

@keyframes slide-up {
  from { 
    opacity: 0; 
    transform: translateY(20px);
  }
  to { 
    opacity: 1; 
    transform: translateY(0);
  }
}

.history-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #f0f0f0;
  background-color: #f9f9f9;
  border-radius: 10px 10px 0 0;
}

.history-panel-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
}

.icon-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.icon-button:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.no-history {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #888;
  text-align: center;
}

.no-history svg {
  margin-bottom: 10px;
  color: #aaa;
}

.history-item {
  padding: 12px 15px;
  background-color: #f9f9f9;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  border: 1px solid transparent;
}

.history-item:hover {
  background-color: #f0f0f0;
}

.history-item.active {
  background-color: #e6f7ff;
  border-color: #91d5ff;
}

.history-item-title {
  font-weight: 500;
  color: #333;
  margin-bottom: 5px;
  padding-right: 20px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-item-date {
  font-size: 0.8rem;
  color: #888;
}

.delete-history {
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.2s;
  border-radius: 50%;
}

.delete-history:hover {
  opacity: 1;
  background-color: rgba(0, 0, 0, 0.05);
}

.delete-history svg {
  color: #666;
}

/* 当底部控制栏激活时的输入框样式 */
.chat-input-wrapper.controls-active {
  box-shadow: 0 3px 15px rgba(0, 0, 0, 0.15);
  transform: translateY(-5px);
}
</style> 