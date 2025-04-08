import type { DirectiveBinding } from 'vue';
import { render, h } from 'vue';
import ToolCallView from '../components/ToolCallView.vue';

// 定义处理工具调用的函数
const handleToolCall = (el: HTMLElement, binding: DirectiveBinding) => {
  if (!binding.value) return;
  
  try {
    // 从 binding.value 中获取工具调用数据
    const toolCalls = binding.value;
    if (!Array.isArray(toolCalls) || toolCalls.length === 0) return;
    
    // 清除原有内容
    el.innerHTML = '';
    
    // 为每个工具调用创建一个容器
    toolCalls.forEach(toolCall => {
      // 创建一个容器来存放工具调用组件
      const container = document.createElement('div');
      container.className = 'tool-calls-inline';
      
      // 创建工具调用组件的VNode
      const toolCallNode = h(ToolCallView, {
        toolName: toolCall.name || '未知工具',
        params: toolCall.args || {},
        result: toolCall.result,
        error: toolCall.error,
        success: !toolCall.error
      });
      
      // 将组件渲染到容器中
      render(toolCallNode, container);
      
      // 将容器添加到指令绑定的元素中
      el.appendChild(container);
    });
  } catch (e) {
    console.error('渲染工具调用组件失败:', e);
  }
};

// 工具调用自定义指令
export const vToolCall = {
  mounted(el: HTMLElement, binding: DirectiveBinding) {
    handleToolCall(el, binding);
  },
  
  updated(el: HTMLElement, binding: DirectiveBinding) {
    if (binding.value !== binding.oldValue) {
      handleToolCall(el, binding);
    }
  }
};

export default vToolCall;
