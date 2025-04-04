<template>
  <div class="chat-messages">
    <div v-if="messages.length === 0" class="empty-chat">
      <div class="empty-chat-content">
        <div class="welcome-header">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="welcome-icon">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <h3>欢迎使用 MCP 智能对话</h3>
        </div>
        
        <div v-if="!hasApiKey" class="api-key-warning">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="warning-icon">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p>需要配置API密钥才能开始对话</p>
          
          <button @click="openSettings" class="hint-button">
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
            <li @click="useExample('查询北京的天气')">查询北京的天气</li>
            <li @click="useExample('获取最新的科技新闻')">获取最新的科技新闻</li>
            <li @click="useExample('请详细介绍Markdown语法，包括标题、列表、代码块、表格等，并用实际例子展示。')">Markdown语法演示</li>
          </ul>
        </div>
      </div>
    </div>
    
    <div v-else>
      <div v-for="(group, groupIndex) in messageGroups" :key="`group-${groupIndex}`" class="message-group">
        <!-- 用户消息始终在上面 -->
        <div v-if="group.user" :class="['message', 'user']">
          <div class="message-avatar">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <div class="message-content">
            <div v-html="formatMessage(group.user.content)"></div>
            <div class="message-time">{{ new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }}</div>
          </div>
        </div>
        
        <!-- AI消息始终在下面，且有足够的间距 -->
        <div v-if="group.assistant" :class="['message', 'assistant']">
          <div class="message-avatar">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 16v-4"></path>
              <path d="M12 8h.01"></path>
            </svg>
          </div>
          <div class="message-content">
            <div v-html="formatMessage(group.assistant.content)"></div>
            <!-- 未完成消息的生成中指示器 -->
            <div v-if="group.assistant.isComplete === false" class="generating-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div class="message-time">{{ new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineProps, defineEmits } from 'vue';
import type { ChatMessage } from '../composables';

interface MessageGroup {
  user?: ChatMessage;
  assistant?: ChatMessage;
}

const props = defineProps({
  messages: {
    type: Array as () => ChatMessage[],
    required: true
  },
  hasApiKey: {
    type: Boolean,
    default: false
  },
  formatMessage: {
    type: Function,
    required: true
  }
});

const emit = defineEmits(['open-settings', 'use-example']);

const openSettings = () => {
  emit('open-settings');
};

const useExample = (example: string) => {
  emit('use-example', example);
};

// 计算属性：处理消息分组，确保用户消息在上，AI回复在下
const messageGroups = computed<MessageGroup[]>(() => {
  const groups: MessageGroup[] = [];
  
  // 首先将消息按对话对分组
  for (let i = 0; i < props.messages.length; i += 2) {
    const group: MessageGroup = {};
    
    // 用户消息
    const userMsg = props.messages[i];
    if (userMsg && userMsg.role === 'user') {
      group.user = userMsg;
    }
    
    // AI消息（如果存在）
    const aiMsg = i + 1 < props.messages.length ? props.messages[i + 1] : null;
    if (aiMsg && aiMsg.role === 'assistant') {
      group.assistant = aiMsg;
    }
    
    // 添加到分组列表
    if (Object.keys(group).length > 0) {
      groups.push(group);
    }
  }
  
  // 不再反转分组数组，保持时间正序
  return groups;
});
</script> 