<template>
  <div class="bottom-controls-wrapper">
    <div class="bottom-controls">
      <!-- 所有按钮控件集中放置 -->
      <div class="controls-group">
        <!-- 模型选择器 -->
        <div class="model-container">
          <div class="model-selector-simple" @click.stop="toggleModelDropdown">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
            <span class="current-model">{{ activeModelText }}</span>
            <svg class="dropdown-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          
          <!-- 模型下拉选择器 -->
          <transition name="dropdown-fade">
            <div v-show="showModelDropdown" class="models-dropdown-bottom">
              <div class="models-dropdown-header">
                <h3>选择模型</h3>
                <button class="close-dropdown-btn" @click.stop="toggleModelDropdown">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              
              <!-- 遍历所有供应商及其模型 -->
              <div v-for="provider in MODEL_PROVIDERS.filter((p: any) => p.id !== 'custom')" :key="provider.id" class="model-group">
                <div class="model-group-title">{{ provider.name }}</div>
                <div v-for="model in provider.models" :key="`${provider.id}-${model.id}`" 
                  class="model-option" 
                  :class="{ active: providerId === provider.id && modelId === model.id }"
                  @click.stop="selectModel(model.id, provider.id)">
                  <div class="model-id">{{ model.id }}</div>
                  <div class="model-name">{{ model.name }}</div>
                  <div v-if="providerId === provider.id && modelId === model.id" class="active-indicator">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                </div>
                
                <!-- 显示用户添加的提供商特定模型 -->
                <div v-if="providerModels && providerModels[provider.id] && providerModels[provider.id].length > 0">
                  <div v-for="model in providerModels[provider.id]" :key="`${provider.id}-custom-${model.id}`" 
                    class="model-option" 
                    :class="{ active: providerId === provider.id && modelId === model.id }"
                    @click.stop="selectModel(model.id, provider.id)">
                    <div class="model-id">{{ model.id }} <span class="custom-label">自定义</span></div>
                    <div class="model-name">{{ model.name }}</div>
                    <div v-if="providerId === provider.id && modelId === model.id" class="active-indicator">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- 自定义模型组 -->
              <div v-if="customModels.length > 0" class="model-group">
                <div class="model-group-title">自定义模型</div>
                <div v-for="model in customModels" :key="`custom-${model.id}`" 
                  class="model-option" 
                  :class="{ active: isActiveCustomModel(model.id) }"
                  @click.stop="selectCustomModel(model.id)">
                  <div class="model-id">{{ model.id }}</div>
                  <div class="model-name">{{ model.name }}</div>
                  <div v-if="isActiveCustomModel(model.id)" class="active-indicator">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </transition>
          
          <!-- 点击外部关闭下拉框的遮罩层 -->
          <div v-if="showModelDropdown" class="dropdown-overlay" @click.stop="toggleModelDropdown"></div>
        </div>
        
        <!-- 工具面板插槽 -->
        <div class="tools-container">
          <slot></slot>
        </div>
        
        <!-- 新对话按钮 -->
        <button class="bottom-button new-chat-button" @click="createNewChat" title="开始新对话">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
          </svg>
          <span>新对话</span>
        </button>
        
        <!-- 设置按钮 -->
        <button class="bottom-button settings-button" @click="openSettings" title="打开设置">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span>设置</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, computed, onMounted, onUnmounted } from 'vue';
import type { ModelInfo } from '../composables';

const props = defineProps({
  showSettings: {
    type: Boolean,
    required: true
  },
  providerId: {
    type: String,
    required: true
  },
  modelId: {
    type: String,
    required: true
  },
  customModelId: {
    type: String,
    required: true
  },
  customModels: {
    type: Array as () => ModelInfo[],
    required: true
  },
  availableModels: {
    type: Array as () => ModelInfo[],
    required: true
  },
  showModelDropdown: {
    type: Boolean,
    required: true
  },
  providerModels: {
    type: Object as () => Record<string, ModelInfo[]>,
    required: true
  },
  MODEL_PROVIDERS: {
    type: Array,
    required: true
  }
});

const emit = defineEmits([
  'toggle-model-dropdown',
  'select-model',
  'select-custom-model',
  'create-new-chat',
  'open-settings'
]);

// 计算当前显示的模型名称
const activeModelText = computed(() => {
  if (props.providerId === 'custom') {
    return props.customModelId || '未选择模型';
  } else {
    const model = props.availableModels.find(m => m.id === props.modelId);
    return model ? model.name : props.modelId;
  }
});

// 检查是否为活动模型
const isActiveModel = (id: string) => {
  return props.providerId !== 'custom' && id === props.modelId;
};

// 检查是否为活动自定义模型
const isActiveCustomModel = (id: string) => {
  return props.providerId === 'custom' && id === props.customModelId;
};

// 组件挂载和卸载时的事件监听
onMounted(() => {
  document.addEventListener('click', handleGlobalClick);
});

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick);
});

// 点击外部关闭下拉框
const handleGlobalClick = (event: MouseEvent) => {
  if (!props.showModelDropdown) return;
  
  const target = event.target as Element;
  const modelContainer = document.querySelector('.model-container');
  
  if (modelContainer && !modelContainer.contains(target)) {
    emit('toggle-model-dropdown');
  }
};

// 事件处理函数
const toggleModelDropdown = () => {
  emit('toggle-model-dropdown');
};

const selectModel = (id: string, providerId?: string) => {
  emit('select-model', id, providerId);
  emit('toggle-model-dropdown');
};

const selectCustomModel = (id: string) => {
  emit('select-custom-model', id);
  emit('toggle-model-dropdown');
};

const createNewChat = () => {
  emit('create-new-chat');
};

const openSettings = () => {
  emit('open-settings');
};
</script>

<style scoped>
.bottom-controls-wrapper {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 0 15px;
}

.bottom-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 16px;
  background-color: rgba(255, 255, 255, 0.9);
  border-radius: 12px;
  margin: 0 auto 12px auto;
  width: 100%;
  max-width: 700px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(230, 230, 230, 0.7);
  transition: all 0.3s ease;
}

.bottom-controls:hover {
  box-shadow: 0 3px 15px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

/* 控件组容器 */
.controls-group {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}

.model-container {
  position: relative;
  z-index: 101;
}

.model-selector-simple {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: #ffffff;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid #f0f0f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  min-width: 150px;
  max-width: 200px;
}

.model-selector-simple:hover {
  background-color: #f9f9f9;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.current-model {
  font-size: 0.95rem;
  max-width: 140px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
  color: #333;
  flex: 1;
}

.dropdown-icon {
  color: #888;
  transition: transform 0.3s ease;
}

.models-dropdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
  position: sticky;
  top: 0;
  background-color: white;
  z-index: 2;
  border-radius: 10px 10px 0 0;
}

.models-dropdown-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #333;
}

.close-dropdown-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.close-dropdown-btn:hover {
  background-color: #f0f0f0;
}

.models-dropdown-bottom {
  position: absolute;
  bottom: 100%;
  left: 0;
  background-color: white;
  border-radius: 10px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.15);
  width: 320px;
  max-height: 450px;
  overflow-y: auto;
  z-index: 1000;
  margin-bottom: 10px;
  border: 1px solid rgba(230, 230, 230, 0.8);
}

.model-group {
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
}

.model-group:last-child {
  border-bottom: none;
}

.model-group-title {
  padding: 0 16px 8px 16px;
  font-size: 0.85rem;
  color: #888;
  font-weight: 500;
}

.model-option {
  padding: 10px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  display: flex;
  flex-direction: column;
}

.model-option:hover {
  background-color: #f0f7ff;
}

.model-option.active {
  background-color: #e6f7ff;
  border-left: 3px solid #1064a3;
  padding-left: 13px;
}

.model-id {
  font-weight: 600;
  font-size: 0.95rem;
  color: #333;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.custom-label {
  font-size: 0.7rem;
  padding: 2px 5px;
  background-color: #f0f7ff;
  color: #1064a3;
  border-radius: 4px;
  margin-left: 5px;
}

.model-name {
  font-weight: 400;
  font-size: 0.85rem;
  color: #666;
  margin-top: 3px;
}

.active-indicator {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: #1064a3;
}

.tools-container {
  display: flex;
  justify-content: center;
}

.bottom-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background-color: #ffffff;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
  color: #333;
  height: 40px;
}

.bottom-button:hover {
  background-color: #f9f9f9;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.new-chat-button {
  color: #1a1a1a;
  background-color: #e6f7ff;
  border-color: #d1e9ff;
}

.new-chat-button:hover {
  background-color: #d1e9ff;
}

.new-chat-button svg {
  color: #1064a3;
}

.settings-button svg {
  color: #555;
}

.dropdown-overlay {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 99;
}

/* 动画效果 */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: all 0.3s ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* 响应式调整 */
@media (max-width: 768px) {
  .bottom-controls {
    padding: 10px;
  }
  
  .controls-group {
    gap: 6px;
  }
  
  .model-selector-simple {
    min-width: 100px;
    max-width: 120px;
    padding: 6px 10px;
  }
  
  .current-model {
    max-width: 80px;
    font-size: 0.9rem;
  }
  
  .bottom-button {
    padding: 6px 10px;
  }
  
  .bottom-button span {
    display: none;
  }
}
</style> 