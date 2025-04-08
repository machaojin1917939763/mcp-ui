import { createApp } from 'vue'
import './styles/app.css'
// 导入KaTeX样式表
import 'katex/dist/katex.min.css'
import App from './App.vue'
// 导入工具调用指令
import { vToolCall } from './directives/toolCall'

// 添加全局代码复制功能
declare global {
  interface Window {
    copyCode: (button: HTMLElement) => void;
  }
}

window.copyCode = function(button: HTMLElement) {
  const codeBlock = button.closest('.code-block-wrapper');
  if (!codeBlock) return;
  
  const codeElement = codeBlock.querySelector('code');
  if (!codeElement) return;
  
  const code = codeElement.textContent || '';
  
  navigator.clipboard.writeText(code).then(() => {
    // 更新按钮状态
    button.classList.add('copied');
    const originalText = button.querySelector('span')?.textContent;
    if (originalText) {
      button.querySelector('span')!.textContent = '已复制';
      setTimeout(() => {
        button.classList.remove('copied');
        button.querySelector('span')!.textContent = originalText;
      }, 2000);
    }
  }).catch(err => {
    console.error('复制失败:', err);
  });
};

const app = createApp(App)

// 注册自定义指令
app.directive('tool-call', vToolCall)

app.mount('#app')
