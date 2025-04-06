<template>
  <div 
    class="chat-header" 
    :class="{ 'visible': isVisible }"
    @mouseenter="showHeader" 
    @mouseleave="hideHeader"
  >
    <div class="header-title">
      <h2>
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="header-icon">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        MCP AI CHAT
      </h2>
    </div>
    <div class="model-info">
      <span class="provider-badge" :class="providerId">
        <svg v-if="providerId === 'openai'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
        </svg>
        <svg v-else-if="providerId === 'anthropic'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 16v-4"></path>
          <path d="M12 8h.01"></path>
        </svg>
        <svg v-else-if="providerId === 'deepseek'" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="18" cy="18" r="3"></circle>
          <circle cx="6" cy="6" r="3"></circle>
          <path d="M13 6h3a2 2 0 0 1 2 2v7"></path>
          <path d="M11 18H8a2 2 0 0 1-2-2V9"></path>
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <path d="M8 21h8"></path>
          <path d="M12 17v4"></path>
        </svg>
        {{ currentProvider?.name || '自定义' }}
      </span>
      <span class="model-badge">{{ providerId === 'custom' ? customModelId : modelId }}</span>
    </div>
    <div class="header-controls">
      <button class="icon-button clear-button" @click="clearChat" title="清除聊天记录">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
      <button class="icon-button settings-button" @click="toggleSettings" title="设置">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

defineProps({
  providerId: {
    type: String,
    default: 'custom'
  },
  modelId: {
    type: String,
    default: ''
  },
  customModelId: {
    type: String,
    default: ''
  },
  currentProvider: {
    type: Object,
    default: () => null
  }
});

const emit = defineEmits(['clear-chat', 'toggle-settings']);

const isVisible = ref(false);
const timeout = ref<number | null>(null);

const clearChat = () => {
  emit('clear-chat');
};

const toggleSettings = () => {
  emit('toggle-settings');
};

const showHeader = () => {
  // 清除定时器
  if (timeout.value) {
    clearTimeout(timeout.value);
    timeout.value = null;
  }
  isVisible.value = true;
};

const hideHeader = () => {
  // 延迟隐藏，防止过快消失
  timeout.value = setTimeout(() => {
    isVisible.value = false;
  }, 300);
};

// 在组件挂载时，创建一个检测顶部区域的事件监听器
onMounted(() => {
  // 页面加载时显示一下，然后隐藏
  showHeader();
  setTimeout(hideHeader, 2000);
  
  // 创建一个触发区域监听器，当鼠标移动到页面顶部时显示
  const handleMousePosition = (e: MouseEvent) => {
    if (e.clientY < 50) {
      showHeader();
    } else if (e.clientY > 100 && isVisible.value && !timeout.value) {
      hideHeader();
    }
  };
  
  document.addEventListener('mousemove', handleMousePosition);
  
  // 保存函数引用以便清理
  (window as any)._chatHeaderMouseHandler = handleMousePosition;
});

// 清理函数
onUnmounted(() => {
  // 移除事件监听器
  if ((window as any)._chatHeaderMouseHandler) {
    document.removeEventListener('mousemove', (window as any)._chatHeaderMouseHandler);
    delete (window as any)._chatHeaderMouseHandler;
  }
  
  // 清除任何剩余的超时
  if (timeout.value) {
    clearTimeout(timeout.value);
    timeout.value = null;
  }
});
</script>

<style scoped>
.chat-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--bg-color);
  border-bottom: 1px solid var(--border-color);
  z-index: 1000;
  transform: translateY(-100%);
  opacity: 0;
  transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.chat-header.visible {
  transform: translateY(0);
  opacity: 1;
}

/* 确保顶部有一个安全区域用于触发显示 */
.chat-header::before {
  content: '';
  position: absolute;
  top: -30px;
  left: 0;
  right: 0;
  height: 30px;
  z-index: 1001;
}

.header-title h2 {
  display: flex;
  align-items: center;
  font-size: 1.25rem;
  margin: 0;
}

.header-icon {
  margin-right: 0.5rem;
}

.model-info {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.provider-badge, .model-badge {
  display: flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
  border-radius: 1rem;
  font-size: 0.8rem;
  background-color: rgba(0, 0, 0, 0.1);
}

.provider-badge svg {
  margin-right: 0.25rem;
}

.provider-badge.openai {
  background-color: rgba(16, 163, 127, 0.1);
  color: rgb(16, 163, 127);
}

.provider-badge.anthropic {
  background-color: rgba(255, 90, 90, 0.1);
  color: rgb(255, 90, 90);
}

.provider-badge.deepseek {
  background-color: rgba(33, 150, 243, 0.1);
  color: rgb(33, 150, 243);
}

.header-controls {
  display: flex;
  gap: 0.5rem;
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: 50%;
  width: 2rem;
  height: 2rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.icon-button:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

@media (prefers-color-scheme: dark) {
  .icon-button:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
}
</style> 