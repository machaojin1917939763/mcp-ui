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
    
    <div v-else class="messages-container">
      <div v-for="(group, groupIndex) in messageGroups" :key="`group-${groupIndex}`" class="message-group">
        <!-- 用户消息 -->
        <div v-if="group.user" :class="['message', 'user']">
          <div class="message-avatar">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <div class="message-content">
            <div v-html="formatMessage(group.user.content)" class="message-text"></div>
            <div class="message-time">{{ formatTime(group.user.timestamp) }}</div>
          </div>
        </div>
        
        <!-- AI消息 -->
        <div v-if="group.assistant" :class="['message', 'assistant']">
          <div class="message-avatar">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 16v-4"></path>
              <path d="M12 8h.01"></path>
            </svg>
          </div>
          <div class="message-content">
            <div v-html="processMessageContent(group.assistant.content)" class="message-text"></div>
            
            <!-- 工具调用组件 -->
            <div v-if="group.assistant.toolCalls && group.assistant.toolCalls.length > 0" class="tool-calls-container">
              <ToolCallView
                v-for="(toolCall, index) in group.assistant.toolCalls"
                :key="index"
                :toolName="toolCall.name"
                :params="toolCall.params"
                :result="toolCall.result"
                :error="toolCall.error"
                :success="toolCall.success"
              />
            </div>
            
            <!-- 未完成消息的生成中指示器 -->
            <div v-if="group.assistant.isComplete === false" class="generating-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div class="message-time">{{ formatTime(group.assistant.timestamp) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineProps, defineEmits } from 'vue';
import type { ChatMessage, ToolCall } from '../composables';
import ToolCallView from './ToolCallView.vue';

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

// 处理消息内容，识别工具调用标记
const processMessageContent = (content: string) => {
  // 替换工具调用标记
  const processedContent = content.replace(/<tool-call.*?\/>/g, '');
  // 格式化剩余文本
  return props.formatMessage(processedContent);
};

// 格式化时间显示
const formatTime = (timestamp?: number) => {
  if (!timestamp) {
    return new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  }
  return new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
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
  
  // 保持时间正序
  return groups;
});
</script>

<style scoped>
.messages-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding-bottom: 10px;
}

/* 平滑滚动效果 */
.chat-messages {
  scroll-behavior: smooth;
}

/* 工具调用容器样式 */
.tool-calls-container {
  margin-top: 12px;
  margin-bottom: 8px;
  border-top: 1px dashed #e0e0e0;
  padding-top: 8px;
}

/* 消息文本样式增强 */
.message-text {
  line-height: 1.5;
  word-break: break-word;
}

/* 用户消息特定样式 */
.user .message-content {
  background: linear-gradient(135deg, #10a37f, #0d8c6f);
  color: white;
  border-top-right-radius: 2px;
}

/* 修改AI消息样式 */
.assistant .message-content {
  background-color: white;
  border-top-left-radius: 2px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* 改进代码块样式 */
.assistant .message-content :deep(pre) {
  background-color: #f8f9fa;
  border-radius: 6px;
  padding: 12px;
  overflow-x: auto;
  margin: 12px 0;
  position: relative;
  border: 1px solid #eaeaea;
}

/* 代码块语言标识 */
.assistant .message-content :deep(pre):before {
  content: attr(data-language);
  position: absolute;
  top: 0;
  right: 10px;
  font-size: 0.75rem;
  color: #888;
  background: #f8f9fa;
  padding: 0 8px;
  border-radius: 0 0 4px 4px;
  border: 1px solid #eaeaea;
  border-top: none;
}

/* 代码块复制按钮 */
.assistant .message-content :deep(.code-block-wrapper) {
  position: relative;
}

.assistant .message-content :deep(.code-copy-button) {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid #eaeaea;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 0.75rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.assistant .message-content :deep(.code-block-wrapper:hover .code-copy-button) {
  opacity: 1;
}

/* 时间戳样式优化 */
.message-time {
  font-size: 0.75rem;
  color: rgba(0, 0, 0, 0.4);
  margin-top: 6px;
  text-align: right;
}

.user .message-time {
  color: rgba(255, 255, 255, 0.7);
}

/* 改进的加载指示器 */
.generating-indicator {
  display: flex;
  gap: 4px;
  margin-top: 10px;
  margin-bottom: 5px;
  align-items: center;
  justify-content: flex-start;
}

.generating-indicator span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #3498db;
  opacity: 0.7;
  animation: bounce 1.4s infinite ease-in-out both;
}

.generating-indicator span:nth-child(1) {
  animation-delay: -0.32s;
}

.generating-indicator span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%, 80%, 100% { 
    transform: scale(0.6);
  }
  40% { 
    transform: scale(1.0);
  }
}

/* 消息进入动画 */
.message {
  animation: message-appear 0.3s ease-out;
  transform-origin: bottom;
}

@keyframes message-appear {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style> 