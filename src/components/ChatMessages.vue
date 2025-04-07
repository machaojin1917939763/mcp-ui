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
            <li @click="useExample('请用LaTeX格式展示一些经典数学公式，包括行内公式和块级公式，例如欧拉公式、牛顿二定律、复杂积分等')">数学公式展示</li>
          </ul>
        </div>
      </div>
    </div>
    
    <div v-else class="chat-content-wrapper">
      <div class="messages-container">
        <div v-for="(group, groupIndex) in messageGroups" :key="`group-${groupIndex}`" class="message-group">
          <!-- 用户消息 -->
          <div v-if="group.user" :class="['message', 'user']">
            <div class="message-content">
              <div v-html="formatMessage(group.user.content)" class="message-text"></div>
              <div class="message-actions">
                <div class="message-time">{{ formatTime(group.user.timestamp) }}</div>
                <button class="copy-message-button" @click="copyMessage(group.user.content)" :class="{ 'copied': copiedMessageIds[group.user.content] }">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          <!-- AI消息 -->
          <div v-if="group.assistant" :class="['message', 'assistant']">
            <div class="message-content">
              <!-- 工具调用组件 - 只在实际有工具调用时才显示 -->
              <div v-if="group.assistant.toolCalls && group.assistant.toolCalls.length > 0" class="tool-calls-inline">
                <ToolCallView
                  v-for="(toolCall, index) in group.assistant.toolCalls"
                  :key="index"
                  :toolName="toolCall.name"
                  :params="toolCall.params"
                  :result="toolCall.result"
                  :error="toolCall.error"
                  :success="toolCall.success"
                />
                
                <!-- 工具调用状态提示 -->
                <div class="tool-call-status-hint" v-if="allToolCallsCompleted(group.assistant.toolCalls)">
                  <span class="status-icon completed">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                  </span>
                  <span class="status-text">{{ group.assistant.toolCalls.length }} 个工具调用已完成</span>
                </div>
                <div class="tool-call-status-hint processing" v-else>
                  <span class="status-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rotating">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                    </svg>
                  </span>
                  <span class="status-text">已完成 {{ completedToolCallsCount(group.assistant.toolCalls) }}/{{ group.assistant.toolCalls.length }} 个工具调用</span>
                </div>
              </div>
              
              <div v-html="processMessageContent(group.assistant.content)" class="message-text"></div>
              
              <!-- 未完成消息的生成中指示器 -->
              <div v-if="group.assistant.isComplete === false" class="generating-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <div class="message-actions">
                <div class="message-time">{{ formatTime(group.assistant.timestamp) }}</div>
                <div class="message-buttons">
                  <button class="copy-message-button" @click="copyMessage(group.assistant.content)" :class="{ 'copied': copiedMessageIds[group.assistant.content] }">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                  <button v-if="group.assistant.isComplete !== false" class="regenerate-button" @click="regenerateAnswer(groupIndex)" title="重新回答">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M23 4v6h-6"></path>
                      <path d="M1 20v-6h6"></path>
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"></path>
                      <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 预览图面板 -->
      <div class="preview-panel" v-if="previewImages.length > 0">
        <div class="preview-panel-header">
          <h3>预览图</h3>
          <button class="close-preview-btn" @click="clearPreviewImages">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="preview-images">
          <div v-for="(image, index) in previewImages" :key="index" class="preview-image-wrapper">
            <img :src="image.url" :alt="image.alt || '预览图'" class="preview-image" />
            <div class="image-caption" v-if="image.alt">{{ image.alt }}</div>
            <div class="image-actions">
              <button class="open-image-btn" @click="openImageInNewTab(image.url)">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </button>
              <button class="download-image-btn" @click="downloadImage(image.url, image.alt || 'image')">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineProps, defineEmits, ref, watch } from 'vue';
import type { ChatMessage } from '../composables';
import type { ToolCall } from '../composables/useChat';
import ToolCallView from './ToolCallView.vue';

interface MessageGroup {
  user?: ChatMessage;
  assistant?: ChatMessage;
}

interface PreviewImage {
  url: string;
  alt?: string;
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

const emit = defineEmits(['open-settings', 'use-example', 'regenerate']);

// 跟踪已复制的消息ID
const copiedMessageIds = ref<Record<string, boolean>>({});

// 预览图数组
const previewImages = ref<PreviewImage[]>([]);

const openSettings = () => {
  emit('open-settings');
};

const useExample = (example: string) => {
  emit('use-example', example);
};

// 处理重新回答
const regenerateAnswer = (groupIndex: number) => {
  emit('regenerate', groupIndex);
};

// 处理消息内容，识别工具调用标记
const processMessageContent = (content: string) => {
  if (!content) return '';
  
  // 替换工具调用标记
  let processedContent = content.replace(/<tool-call.*?\/>/g, '');
  
  // 移除JSON格式的工具调用内容
  processedContent = processedContent.replace(/\{"type":"tool_calls","tool_calls":\[.*?\]\}/gs, '');
  
  // 移除工具调用结果文本
  processedContent = processedContent.replace(/工具 .+ 返回结果: .*$/gm, '');
  processedContent = processedContent.replace(/工具 .+ 调用失败: .*$/gm, '');
  
  // 移除"已完成调用，结果是"的提示文本
  processedContent = processedContent.replace(/工具 .+ 已完成调用，结果是：.*$/gm, '');
  
  // 删除可能存在的工具调用相关空行
  processedContent = processedContent.replace(/请基于工具 .+ 的调用结果继续处理。/g, '');
  processedContent = processedContent.replace(/请基于这个结果继续回答用户的问题.*$/gm, '');
  
  // 清理可能出现的连续多个换行
  processedContent = processedContent.replace(/\n{3,}/g, '\n\n');
  processedContent = processedContent.trim();
  
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

// 复制消息内容
const copyMessage = (content: string) => {
  // 创建一个临时元素来保存纯文本内容
  const tempElement = document.createElement('div');
  tempElement.innerHTML = content;
  const plainText = tempElement.textContent || tempElement.innerText || content;
  
  // 复制到剪贴板
  navigator.clipboard.writeText(plainText)
    .then(() => {
      // 标记消息为已复制
      copiedMessageIds.value[content] = true;
      
      // 显示复制成功通知
      showCopySuccess();
      
      // 2秒后重置复制状态
      setTimeout(() => {
        copiedMessageIds.value[content] = false;
      }, 2000);
    })
    .catch(err => {
      console.error('复制失败:', err);
      alert('复制失败，请手动复制');
    });
};

// 显示复制成功提示
const showCopySuccess = () => {
  const notification = document.createElement('div');
  notification.className = 'copy-success-notification';
  notification.textContent = '已复制到剪贴板';
  
  document.body.appendChild(notification);
  
  // 添加动画类
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  // 2秒后移除
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 2000);
};

// 清除预览图
const clearPreviewImages = () => {
  previewImages.value = [];
};

// 在新标签页中打开图片
const openImageInNewTab = (url: string) => {
  window.open(url, '_blank');
};

// 下载图片
const downloadImage = (url: string, filename: string) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// 从消息内容中提取图片
const extractImagesFromMessage = (content: string) => {
  // 创建临时元素解析HTML
  const tempElement = document.createElement('div');
  tempElement.innerHTML = content;
  
  // 查找所有图片元素
  const imgElements = tempElement.querySelectorAll('img');
  
  // 将图片信息添加到预览数组
  imgElements.forEach(img => {
    const url = img.src;
    const alt = img.alt;
    
    // 避免重复添加相同的图片
    if (url && !previewImages.value.some(image => image.url === url)) {
      previewImages.value.push({ url, alt });
    }
  });
};

// 监听消息变化，自动提取图片
watch(() => props.messages, (newMessages) => {
  // 清空预览图
  previewImages.value = [];
  
  // 遍历所有消息，提取图片
  newMessages.forEach(message => {
    if (message.content && typeof message.content === 'string') {
      // 对于AI消息，需要先处理格式化
      if (message.role === 'assistant') {
        const formattedContent = processMessageContent(message.content);
        extractImagesFromMessage(formattedContent);
      } else {
        extractImagesFromMessage(props.formatMessage(message.content));
      }
    }
  });
}, { deep: true });

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

// 辅助函数：检查所有工具调用是否完成
const allToolCallsCompleted = (toolCalls: ToolCall[]): boolean => {
  return toolCalls.every(call => call.result !== undefined || call.error !== undefined);
};

// 辅助函数：计算已完成工具调用的数量
const completedToolCallsCount = (toolCalls: ToolCall[]): number => {
  return toolCalls.filter(call => call.result !== undefined || call.error !== undefined).length;
};
</script>

<style scoped>
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  /* 添加足够的顶部内边距，为ChatHeader预留空间 */
  padding-top: 4rem;
}

.chat-content-wrapper {
  display: flex;
  width: 100%;
  height: 100%;
  position: relative;
}

.messages-container {
  display: flex;
  flex-direction: column;
  gap: 28px;
  padding-bottom: 15px;
  flex: 1;
  overflow-y: auto;
  /* 已经通过全局样式隐藏了滚动条 */
}

/* 预览图面板样式 */
.preview-panel {
  width: 280px;
  min-width: 280px;
  border-left: 1px solid #eaeaea;
  background-color: #fafafa;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  /* 已经通过全局样式隐藏了滚动条 */
}

.preview-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #eaeaea;
  background-color: #f5f5f5;
  position: sticky;
  top: 0;
  z-index: 1;
}

.preview-panel-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #333;
}

.close-preview-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
}

.close-preview-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: #333;
}

.preview-images {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-image-wrapper {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  background-color: white;
  position: relative;
}

.preview-image {
  width: 100%;
  height: auto;
  max-height: 250px;
  object-fit: contain;
  display: block;
}

.image-caption {
  padding: 8px 12px;
  font-size: 0.85rem;
  color: #666;
  text-align: center;
  border-top: 1px solid #f0f0f0;
  background-color: #fafafa;
}

.image-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.preview-image-wrapper:hover .image-actions {
  opacity: 1;
}

.open-image-btn,
.download-image-btn {
  background-color: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 4px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  color: #555;
  transition: all 0.2s ease;
}

.open-image-btn:hover,
.download-image-btn:hover {
  background-color: white;
  color: #1064a3;
  transform: translateY(-1px);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
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
  line-height: 1.6;
  word-break: break-word;
  font-size: 15px;
  margin-top: 8px;
  padding: 5px 0;
  min-height: 24px;
}

/* 消息组样式优化 */
.message-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

/* 消息内容容器改进 */
.message .message-content {
  border-radius: 12px;
  padding: 12px 16px;
  position: relative;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  max-width: 90%;
  width: fit-content;
}

/* 用户消息 - 轻蓝色渐变（主色调） */
.user .message-content {
  background: linear-gradient(135deg, #e3f2fd, #bbdefb); /* 浅蓝到更柔和的蓝 */
  color: #1a237e; /* 深蓝色文字，保证可读性 */
  border: 1px solid rgba(255, 255, 255, 0.5); /* 轻微白色边框增强层次 */
}

/* 通用样式优化 */
.message-content {
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  padding: 12px 16px;
  line-height: 1.5;
  transition: all 0.2s ease; /* 可选：添加悬浮动画 */
}

/* 悬停效果（可选） */
.user .message-content:hover {
  background: linear-gradient(135deg, #d8ebff, #b3d9ff);
}

/* 修改AI消息样式 */
.assistant .message-content {
  background-color: transparent;
  box-shadow: none;
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

/* 消息操作按钮样式 */
.message-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
}

.message-buttons {
  display: flex;
  gap: 4px;
}

.copy-message-button, .regenerate-button {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  opacity: 0.5;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.copy-message-button:hover, .regenerate-button:hover {
  opacity: 1;
  background-color: rgba(0, 0, 0, 0.05);
}

.copy-message-button.copied {
  color: #10a37f;
  opacity: 1;
}

.regenerate-button {
  color: #3498db;
}

.regenerate-button:hover {
  background-color: rgba(52, 152, 219, 0.1);
}

.user .copy-message-button {
  color: rgba(255, 255, 255, 0.9);
}

.user .copy-message-button:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.user .copy-message-button.copied {
  color: #ffffff;
  opacity: 1;
}

.assistant .copy-message-button,
.assistant .regenerate-button {
  color: rgba(0, 0, 0, 0.6);
}

/* 时间戳样式优化 */
.message-time {
  font-size: 0.75rem;
  color: rgba(0, 0, 0, 0.4);
  text-align: left;
}

.user .message-time {
  color: rgba(255, 255, 255, 0.7);
}

/* 复制成功通知样式 */
:deep(.copy-success-notification) {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  background-color: rgba(16, 163, 127, 0.9);
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  opacity: 0;
  transition: all 0.3s ease;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

:deep(.copy-success-notification.show) {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
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

/* 响应式样式 */
@media (max-width: 768px) {
  .preview-panel {
    width: 220px;
    min-width: 220px;
  }
  .message .message-content {
    max-width: 95%;
  }
}

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  /* 删除自定义滚动条样式，使用全局隐藏滚动条的样式 */
}

/* 删除自定义滚动条样式
.history-list::-webkit-scrollbar {
  width: 6px;
}

.history-list::-webkit-scrollbar-thumb {
  background-color: #ddd;
  border-radius: 3px;
}
*/

/* 保持工具调用清晰分离 */
.tool-calls-inline {
  margin: 0 0 16px 0;
  padding: 12px;
  border-radius: 8px;
  background-color: #f3f8ff;
  border: 1px solid #d0e1fd;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

/* 工具调用状态提示容器样式优化 */
.tool-call-status-hint {
  display: flex;
  align-items: center;
  font-size: 0.85rem;
  padding: 6px 10px;
  margin-top: 10px;
  color: #4a6586;
  background-color: rgba(255, 255, 255, 0.7);
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  border-left: 2px solid #4a6586;
}

.tool-call-status-hint.processing {
  color: #1e88e5;
  background-color: rgba(227, 242, 253, 0.7);
  border-left-color: #1e88e5;
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 8px;
}

.status-icon.completed {
  color: #4caf50;
}

.status-text {
  font-weight: 500;
}

/* 旋转动画 */
.rotating {
  animation: rotate 1.5s linear infinite;
}

@keyframes rotate {
  100% {
    transform: rotate(360deg);
  }
}
</style> 