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
import { computed, defineProps, defineEmits, ref, watch, h, render } from 'vue';
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

// 工具调用数据存储，用于v-tool-call指令
const toolCallsData = ref<Record<string, any>>({});

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
  
    // 提取工具调用数据，并存储到工具调用数据映射中
  // 这样我们可以在模板中使用 v-tool-call 指令将工具调用JSON替换为组件
  const toolCallMatches = processedContent.match(/\{"type":"tool_calls","tool_calls":\[(.*?)\]\}/gs);
  
  if (toolCallMatches) {
    toolCallMatches.forEach(match => {
      try {
        // 尝试解析完整的工具调用对象
        const toolCallObj = JSON.parse(match);
        if (toolCallObj && toolCallObj.type === 'tool_calls' && Array.isArray(toolCallObj.tool_calls)) {
          // 为当前消息的工具调用生成一个唯一标识符
          const toolCallId = `tool-call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          // 存储工具调用数据
          toolCallsData.value[toolCallId] = toolCallObj.tool_calls;
          
          // 在消息内容中替换为自定义标记，用于后续处理
          processedContent = processedContent.replace(match, `<div id="${toolCallId}" class="tool-call-placeholder"></div>`);
        }
      } catch (e) {
        console.error('解析工具调用JSON失败:', e);
      }
    });
  }
  
  // 移除已被替换的工具调用JSON
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

// 处理渲染后的消息，应用工具调用组件
const processRenderedMessages = () => {
  // 查找所有工具调用占位符
  setTimeout(() => {
    const placeholders = document.querySelectorAll('.tool-call-placeholder');
    placeholders.forEach(placeholder => {
      const id = placeholder.id;
      if (id && toolCallsData.value[id]) {
        // 获取工具调用数据
        const toolCalls = toolCallsData.value[id];
        
        // 检查是否所有工具调用都已完成
        const allCompleted = toolCalls.every((toolCall: any) => 
          toolCall.result !== undefined || toolCall.error !== undefined
        );
        
        // 如果所有调用都已完成，或者这是首次渲染，则更新组件
        if (allCompleted || !placeholder.hasAttribute('processed')) {
          // 标记为已处理，避免重复渲染未完成的调用
          placeholder.setAttribute('processed', 'true');
          
          // 如果所有调用都已完成，标记为完成状态
          if (allCompleted) {
            placeholder.setAttribute('completed', 'true');
          }
          
          // 清空占位符内容
          placeholder.innerHTML = '';
          
          // 为每个工具调用创建组件
          toolCalls.forEach((toolCall: any) => {
            // 创建工具调用视图组件实例
            const toolCallInstance = document.createElement('div');
            toolCallInstance.className = 'tool-calls-inline';
            
            // 创建工具调用组件
            const toolCallComponent = h(ToolCallView, {
              toolName: toolCall.name || '未知工具',
              params: toolCall.args || {},
              result: toolCall.result,
              error: toolCall.error,
              success: !toolCall.error
            });
            
            // 渲染组件到DOM
            render(toolCallComponent, toolCallInstance);
            placeholder.appendChild(toolCallInstance);
          });
        }
      }
    });
  }, 0);
};

// 定期检查工具调用状态，确保已完成的调用显示正确状态
const startToolCallStatusChecker = () => {
  const checkInterval = 1000; // 每秒检查一次
  let intervalId: number;
  
  const checkToolCallStatus = () => {
    const processingPlaceholders = document.querySelectorAll('.tool-call-placeholder:not([completed="true"])');
    
    // 如果没有处理中的占位符，可以停止检查
    if (processingPlaceholders.length === 0) {
      clearInterval(intervalId);
      return;
    }
    
    // 检查每个处理中的占位符
    processingPlaceholders.forEach(placeholder => {
      const id = placeholder.id;
      if (id && toolCallsData.value[id]) {
        const toolCalls = toolCallsData.value[id];
        
        // 检查是否所有工具调用都已完成
        const allCompleted = toolCalls.every((toolCall: any) => 
          toolCall.result !== undefined || toolCall.error !== undefined
        );
        
        // 如果所有调用都已完成，更新组件
        if (allCompleted) {
          // 标记为已完成
          placeholder.setAttribute('completed', 'true');
          
          // 在不改变DOM结构的情况下更新组件状态
          // 获取已渲染的工具调用组件
          const existingToolCallComponents = placeholder.querySelectorAll('.tool-calls-inline');
          
          // 如果有已渲染的组件，直接更新它们的属性
          if (existingToolCallComponents.length > 0) {
            toolCalls.forEach((toolCall: any, index: number) => {
              // 确保组件存在
              if (index < existingToolCallComponents.length) {
                const component = existingToolCallComponents[index];
                
                // 更新组件内部状态，不改变DOM结构
                // 得到组件内部的内容元素
                const headerElement = component.querySelector('.tool-call-header');
                const statusElement = component.querySelector('.tool-status');
                const infoElement = component.querySelector('.tool-call-info');
                
                if (headerElement && statusElement && infoElement) {
                  // 更新状态文本
                  statusElement.textContent = toolCall.error ? '调用失败' : '调用成功';
                  
                  // 更新类以反映状态
                  if (toolCall.error) {
                    headerElement.classList.remove('success', 'pending');
                    headerElement.classList.add('error');
                    statusElement.classList.remove('success', 'pending');
                    statusElement.classList.add('error');
                  } else {
                    headerElement.classList.remove('error', 'pending');
                    headerElement.classList.add('success');
                    statusElement.classList.remove('error', 'pending');
                    statusElement.classList.add('success');
                  }
                }
                
                // 更新结果部分
                const detailsElement = component.querySelector('.tool-call-details');
                if (detailsElement) {
                  const resultSection = detailsElement.querySelector('.tool-call-section:nth-child(2)');
                  if (resultSection) {
                    const titleElement = resultSection.querySelector('.section-title');
                    if (titleElement) {
                      titleElement.textContent = '调用结果';
                    }
                    
                    const codeBlock = resultSection.querySelector('.code-block');
                    if (codeBlock) {
                      try {
                        codeBlock.textContent = JSON.stringify(toolCall.result || toolCall.error, null, 2);
                        
                        if (toolCall.error) {
                          codeBlock.classList.add('error-result');
                        } else {
                          codeBlock.classList.remove('error-result');
                        }
                      } catch (e) {
                        codeBlock.textContent = String(toolCall.result || toolCall.error);
                      }
                    }
                  }
                }
              }
            });
          } else {
            // 如果还没有渲染组件，那么创建它们
            toolCalls.forEach((toolCall: any) => {
              const toolCallInstance = document.createElement('div');
              toolCallInstance.className = 'tool-calls-inline';
              
              const toolCallComponent = h(ToolCallView, {
                toolName: toolCall.name || '未知工具',
                params: toolCall.args || {},
                result: toolCall.result,
                error: toolCall.error,
                success: !toolCall.error
              });
              
              render(toolCallComponent, toolCallInstance);
              placeholder.appendChild(toolCallInstance);
            });
          }
        }
      }
    });
  };
  
  // 启动定期检查
  intervalId = window.setInterval(checkToolCallStatus, checkInterval);
  
  // 页面卸载时清除定时器
  window.addEventListener('beforeunload', () => {
    clearInterval(intervalId);
  });
};

// 监听消息变化，自动提取图片和处理工具调用
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
  
  // 处理渲染后的消息，应用工具调用组件
  processRenderedMessages();
  
  // 启动工具调用状态检查器
  startToolCallStatusChecker();
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