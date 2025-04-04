import { ref, computed, watch, nextTick } from 'vue';
import { MCPClient } from '../utils/MCPClient';
import type { ChatHistoryItem } from './useChatHistory';
import { useChatHistory } from './useChatHistory';
import { useUIState } from './useUIState';
import type { AxiosError } from 'axios';
import { marked } from 'marked';
import hljs from 'highlight.js';

// 设置marked选项
marked.setOptions({
  breaks: true, // 将换行符转换为<br>
  gfm: true     // 使用GitHub风格的Markdown
});

// 自定义高亮函数
function highlightCode(code: string, language?: string): string {
  if (language && hljs.getLanguage(language)) {
    try {
      return hljs.highlight(code, { language }).value;
    } catch (err) {
      console.error('高亮错误:', err);
    }
  }
  return hljs.highlightAuto(code).value;
}

// 消息接口
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: number;
  isComplete?: boolean;
}

export function useChat() {
  // 界面相关状态
  const messages = ref<ChatMessage[]>([]);
  const newMessage = ref('');
  const isLoading = ref(false);
  const showSettings = ref(false); // 是否显示设置面板
  
  // 通知状态
  const notification = ref('');
  const showNotificationFlag = ref(false);

  // MCP客户端实例
  const mcpClient = new MCPClient();
  
  // 发送消息
  async function sendMessage(
    createNewChat: () => string,
    currentChatId: string, 
    chatHistoryList: ChatHistoryItem[],
    saveCurrentChat: (messages: ChatMessage[]) => void
  ) {
    if (!newMessage.value.trim()) return;
    
    // 如果没有当前对话，创建一个新对话
    if (!currentChatId) {
      createNewChat();
    }
    
    // 添加用户消息
    messages.value.push({
      role: 'user',
      content: newMessage.value,
      isComplete: true
    });
    
    // 清空输入框并设置加载状态
    const userMessage = newMessage.value;
    newMessage.value = '';
    isLoading.value = true;
    
    // 更新对话标题（如果是第一条消息）
    const currentChat = chatHistoryList.find(chat => chat.id === currentChatId);
    if (currentChat && currentChat.messages.length === 0) {
      // 如果是对话的第一条消息，将其设为标题（最多20个字符）
      currentChat.title = userMessage.length > 20 ? userMessage.substring(0, 20) + '...' : userMessage;
    }
    
    try {
      // 添加一个初始的助手消息占位符，用于流式更新
      const assistantMessageIndex = messages.value.length;
      messages.value.push({
        role: 'assistant',
        content: '',
        isComplete: false
      });
      
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
      const finalResponse = await mcpClient.processStreamQuery(userMessage, handleStreamChunk);
      
      // 标记消息已完成
      if (messages.value[assistantMessageIndex]) {
        messages.value[assistantMessageIndex].isComplete = true;
      }
      
      // 保存当前对话到历史记录
      saveCurrentChat(messages.value);
    } catch (error) {
      console.error('处理消息时出错:', error);
      
      // 如果还没有添加助手消息，添加一个错误消息
      const errorMessage = '抱歉，处理您的请求时发生错误。';
      if (messages.value.length > 0 && messages.value[messages.value.length - 1].role === 'assistant') {
        // 更新已存在的消息
        messages.value[messages.value.length - 1].content += '\n\n' + errorMessage;
        messages.value[messages.value.length - 1].isComplete = true;
      } else {
        // 添加新的错误消息
        messages.value.push({
          role: 'assistant',
          content: errorMessage,
          isComplete: true
        });
      }
      
      // 即使出错也保存对话
      saveCurrentChat(messages.value);
    } finally {
      isLoading.value = false;
    }
  }
  
  // 清除聊天记录函数
  function clearChat(currentChatId: string, chatHistoryList: ChatHistoryItem[]) {
    if (isLoading.value) return;
    
    // 清空当前消息
    messages.value = [];
    mcpClient.clearHistory();
    
    // 如果有当前对话，则更新它
    if (currentChatId) {
      const chatIndex = chatHistoryList.findIndex(chat => chat.id === currentChatId);
      if (chatIndex !== -1) {
        chatHistoryList[chatIndex].messages = [];
        chatHistoryList[chatIndex].title = '空对话';
        localStorage.setItem('chatHistoryList', JSON.stringify(chatHistoryList));
      }
    }
  }
  
  // 显示通知的函数
  function showNotification(message: string) {
    notification.value = message;
    showNotificationFlag.value = true;
    
    // 3秒后自动关闭通知
    setTimeout(() => {
      showNotificationFlag.value = false;
    }, 3000);
  }
  
  // 格式化消息，支持Markdown
  function formatMessage(content: string): string {
    if (!content) return '';
    
    try {
      // 解码HTML实体编码
      function decodeHTMLEntities(text: string): string {
        const textArea = document.createElement('textarea');
        textArea.innerHTML = text;
        return textArea.value;
      }
      
      // 使用DOMParser来解码HTML实体
      function safeDecodeHTML(html: string): string {
        try {
          return decodeHTMLEntities(html);
        } catch (e) {
          console.error('解码HTML失败:', e);
          return html;
        }
      }
      
      // 处理内容中的HTML实体
      const decodedContent = safeDecodeHTML(content);
      
      // 代码块接口定义
      interface CodeBlock {
        language: string;
        code: string;
      }
      
      // 处理代码块，保存它们以避免被marked处理
      const codeBlocks: CodeBlock[] = [];
      const processedContent = decodedContent.replace(/```(\w*)\n([\s\S]+?)```/g, (match, language, code) => {
        // 为HTML代码特殊处理
        if (language === 'html') {
          // 在这里解码HTML实体，以便正确显示
          code = safeDecodeHTML(code);
        }
        const id = `CODE_BLOCK_${codeBlocks.length}`;
        codeBlocks.push({ language, code });
        return id;
      });
      
      // 使用marked解析Markdown
      const htmlResult = marked(processedContent);
      
      // 确保结果是字符串
      if (typeof htmlResult !== 'string') {
        console.error('marked返回了非字符串结果');
        return content;
      }
      
      // 还原代码块
      let html = htmlResult;
      codeBlocks.forEach((block, index) => {
        const id = `CODE_BLOCK_${index}`;
        
        // 应用代码高亮
        const highlightedCode = block.language ? highlightCode(block.code, block.language) : highlightCode(block.code);
        
        // 创建包含复制按钮的代码块HTML
        const codeBlockHTML = `
          <div class="code-block-wrapper">
            <div class="code-block-header">
              <span class="code-language">${block.language || '代码'}</span>
              <button class="copy-btn" onclick="window.copyCode(this)">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span>复制</span>
              </button>
            </div>
            <pre><code class="hljs ${block.language ? `language-${block.language}` : ''}">${highlightedCode}</code></pre>
          </div>
        `;
        
        // 替换ID为代码块HTML
        html = html.replace(id, codeBlockHTML);
      });
      
      return html;
    } catch (error) {
      console.error('Markdown解析失败:', error);
      // 如果解析失败，回退到简单替换
      return content.replace(/\n/g, '<br>');
    }
  }
  
  // 初始化MCP客户端
  function initializeMCPClient() {
    return mcpClient.initialize();
  }
  
  // 添加消息到历史记录
  function addMessageToHistory(message: ChatMessage) {
    mcpClient.addMessageToHistory(message);
  }
  
  return {
    messages,
    newMessage,
    isLoading,
    showSettings,
    notification,
    showNotificationFlag,
    mcpClient,
    sendMessage,
    clearChat,
    showNotification,
    formatMessage,
    initializeMCPClient,
    addMessageToHistory
  };
} 