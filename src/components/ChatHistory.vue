<template>
  <!-- 历史对话面板 - 从左侧弹出 -->
  <div class="history-panel-left" :class="{ 'show': showHistoryPanel }">
    <div class="history-panel-header">
      <h3>对话历史</h3>
      <button class="icon-button" @click="toggleHistory">
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
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';

// 定义聊天历史项类型
interface ChatHistory {
  id: string;
  title: string;
  date: number;
  messages: any[];
}

const props = defineProps({
  showHistoryPanel: {
    type: Boolean,
    required: true
  },
  chatHistoryList: {
    type: Array as () => ChatHistory[],
    required: true
  },
  currentChatId: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['toggle-history', 'load-chat', 'delete-chat']);

const toggleHistory = () => {
  emit('toggle-history');
};

const loadChat = (chatId: string) => {
  emit('load-chat', chatId);
};

const deleteChat = (chatId: string, event?: Event) => {
  if (event) event.stopPropagation();
  emit('delete-chat', chatId);
};
</script> 