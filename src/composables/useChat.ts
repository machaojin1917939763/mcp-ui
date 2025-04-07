import { ref, computed, watch, nextTick } from 'vue';
import { MCPClient } from '../utils/MCPClient';
import type { ChatHistoryItem } from './useChatHistory';
import { useChatHistory } from './useChatHistory';
import { useUIState } from './useUIState';
import type { AxiosError } from 'axios';
import { marked } from 'marked';
import hljs from 'highlight.js';
import katex from 'katex';

// 设置marked选项
marked.setOptions({
  breaks: true, // 将换行符转换为<br>
  gfm: true     // 使用GitHub风格的Markdown
});

// 自定义数学公式正则表达式 - 修复后更灵活的匹配
const inlineMathRegex = /(?<!\$)\$([^$]+?)\$|\\\\?\(([^)]+?)\\\\?\)/g;
const blockMathRegex = /(\$\$([\s\S]+?)\$\$)|(\\\[([\s\S]+?)\\\])/g;

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

// 工具调用接口
export interface ToolCall {
  name: string;
  params: any;
  result?: any;
  error?: string;
  success: boolean;
  timestamp: number;
}

// 消息接口
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: number;
  isComplete?: boolean;
  toolCalls?: ToolCall[]; // 添加工具调用数组
}

export function useChat() {
  // 界面相关状态
  const messages = ref<ChatMessage[]>([]);
  const newMessage = ref('');
  const isLoading = ref(false);
  const showSettings = ref(false); // 是否显示设置面板
  
  // 通知状态
  const notification = ref('');
  const notificationType = ref('info');
  const showNotificationFlag = ref(false);

  // MCP客户端实例
  const mcpClient = new MCPClient();
  
  // 发送消息
  async function sendMessage(
    createNewChat: () => string,
    currentChatId: string, 
    chatHistoryList: ChatHistoryItem[],
    saveCurrentChat: (messages: ChatMessage[]) => void,
    onToolCallComplete?: (toolCall: { name: string; params: any; result?: any; error?: string; success: boolean }) => void
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
      let currentToolCalls: ToolCall[] = [];

      // 定义工具调用处理器
      const handleToolCall = (toolCall: { name: string; params: any; result?: any; error?: string; success: boolean }) => {
        // 创建工具调用对象
        const newToolCall: ToolCall = {
          ...toolCall,
          timestamp: Date.now()
        };
        
        // 添加到当前工具调用列表
        currentToolCalls.push(newToolCall);
        
        // 更新消息的工具调用列表
        if (messages.value[assistantMessageIndex]) {
          messages.value[assistantMessageIndex].toolCalls = [...currentToolCalls];
        }
        
        // 如果提供了工具调用完成回调，调用它
        if (onToolCallComplete && (toolCall.result !== undefined || toolCall.error !== undefined)) {
          onToolCallComplete(toolCall);
        }
      };
      
      // 处理消息并获取流式响应
      const finalResponse = await mcpClient.processStreamQuery(
        userMessage, 
        handleStreamChunk,
        handleToolCall
      );
      
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
  function showNotification(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    // 根据消息内容自动推断类型（如果未指定）
    if (type === 'info') {
      if (message.includes('成功') || message.includes('已保存') || message.includes('已添加') || message.includes('已切换')) {
        type = 'success';
      } else if (message.includes('错误') || message.includes('失败') || message.includes('无法')) {
        type = 'error';
      } else if (message.includes('警告') || message.includes('注意')) {
        type = 'warning';
      }
    }
    
    notification.value = message;
    notificationType.value = type;
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
      
      // 数学公式接口定义
      interface MathBlock {
        isInline: boolean;
        expression: string;
      }
      
      // 保存的数学公式
      const mathBlocks: MathBlock[] = [];
      
      // 处理代码块，保存它们以避免被marked处理
      const codeBlocks: CodeBlock[] = [];
      let processedContent = decodedContent.replace(/```(\w*)\n([\s\S]+?)```/g, (match, language, code) => {
        // 为HTML代码特殊处理
        if (language === 'html') {
          // 在这里解码HTML实体，以便正确显示
          code = safeDecodeHTML(code);
        }
        const id = `CODE_BLOCK_${codeBlocks.length}`;
        codeBlocks.push({ language, code });
        return id;
      });
      
      // 提取并保存行内数学公式
      processedContent = processedContent.replace(inlineMathRegex, (match, dollarContent, bracketContent) => {
        // 确定实际内容
        const expression = dollarContent || bracketContent;
        
        // 排除可能是代码中的美元符号
        if (!expression || expression.trim() === '' || expression.includes('\n')) {
          return match;
        }

        // 处理表达式
        const cleanExpression = expression.trim().replace(/,\s/g, ' ');
        console.log('找到行内公式:', cleanExpression);
        const id = `MATH_BLOCK_${mathBlocks.length}`;
        mathBlocks.push({ isInline: true, expression: cleanExpression });
        return id;
      });
      
      // 提取并保存块级数学公式
      processedContent = processedContent.replace(blockMathRegex, (match, fullMatch, dollarContent, bracketMatch, bracketContent) => {
        // 确定实际内容
        const expression = dollarContent || bracketContent;
        
        if (!expression || expression.trim() === '') {
          return match;
        }
        
        // 处理表达式，替换数学公式中的逗号加空格为单纯的空格
        const cleanExpression = expression.trim().replace(/,\s/g, ' ');
        console.log('找到块级公式:', cleanExpression);
        const id = `MATH_BLOCK_${mathBlocks.length}`;
        mathBlocks.push({ isInline: false, expression: cleanExpression });
        return id;
      });
      
      // 使用marked解析Markdown
      const htmlResult = marked(processedContent);
      
      // 确保结果是字符串
      if (typeof htmlResult !== 'string') {
        console.error('marked返回了非字符串结果');
        return content;
      }
      
      // 还原代码块和数学公式
      let html = htmlResult;
      
      // 还原代码块
      codeBlocks.forEach((block, index) => {
        const id = `CODE_BLOCK_${index}`;
        
        // 应用代码高亮
        const highlightedCode = block.language ? highlightCode(block.code, block.language) : highlightCode(block.code);
        
        // 创建简洁的代码块HTML，把语言标识作为wrapper的data-language属性
        const codeBlockHTML = `
          <div class="code-block-wrapper" data-language="${block.language || '代码'}">
            <pre><code class="hljs ${block.language ? `language-${block.language}` : ''}">${highlightedCode}</code></pre>
            <button class="code-copy-button" onclick="window.copyCode(this)">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>复制</span>
            </button>
          </div>
        `;
        
        // 替换ID为代码块HTML
        html = html.replace(id, codeBlockHTML);
      });
      
      // 还原数学公式
      mathBlocks.forEach((block, index) => {
        const id = `MATH_BLOCK_${index}`;
        
        try {
          console.log(`尝试渲染公式: ${block.expression}, 行内: ${block.isInline}`);
          
          // 使用KaTeX渲染数学公式
          const renderedMath = katex.renderToString(block.expression, {
            displayMode: !block.isInline,
            throwOnError: false,
            output: 'html',
            strict: false,
            trust: true,
            macros: {
              "\\f": "f(#1)"
            },
            fleqn: false
          });
          
          console.log('公式渲染成功');
          
          // 创建包装器，为行内和块级公式提供不同的样式
          const mathHTML = block.isInline
            ? `<span class="math-inline">${renderedMath}</span>`
            : `<div class="math-block">${renderedMath}</div>`;
          
          // 替换ID为渲染后的数学公式
          html = html.replace(id, mathHTML);
        } catch (error) {
          console.error(`渲染数学公式时出错: ${block.expression}`, error);
          
          // 如果公式渲染失败，保留原始公式文本
          const fallbackHTML = block.isInline 
            ? `<span class="math-error">$${block.expression}$</span>` 
            : `<div class="math-error">$$${block.expression}$$</div>`;
          
          html = html.replace(id, fallbackHTML);
        }
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
    notificationType,
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