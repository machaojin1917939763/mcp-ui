<template>
  <div class="bottom-controls">
    <!-- 模型选择器容器 -->
    <div class="model-container">
      <div class="model-selector-simple" @click.stop="toggleModelDropdown">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
        <span class="current-model">{{ activeModelText }}</span>
      </div>
      
      <!-- 模型下拉选择器 -->
      <div v-show="showModelDropdown" class="models-dropdown-bottom">
        <!-- 标准模型 -->
        <div v-for="model in availableModels" :key="model.id" 
          class="model-option" 
          :class="{ active: isActiveModel(model.id) }"
          @click.stop="selectModel(model.id)">
          <div class="model-id">{{ model.id }}</div>
          <div class="model-name">{{ model.name }}</div>
        </div>
        
        <!-- 自定义模型 -->
        <div v-for="model in customModels" :key="`custom-${model.id}`" 
          class="model-option" 
          :class="{ active: isActiveCustomModel(model.id) }"
          @click.stop="selectCustomModel(model.id)">
          <div class="model-id">{{ model.id }} (自定义)</div>
          <div class="model-name">{{ model.name }}</div>
        </div>
      </div>
      
      <!-- 点击外部关闭下拉框的遮罩层 -->
      <div v-if="showModelDropdown" class="dropdown-overlay" @click.stop="toggleModelDropdown"></div>
    </div>
    
    <!-- 工具面板插槽 -->
    <slot></slot>
    
    <!-- 历史对话按钮 -->
    <button class="bottom-button history-button" @click="toggleHistory">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 8v4l3 3"></path>
        <circle cx="12" cy="12" r="10"></circle>
      </svg>
      <span>历史</span>
    </button>
    
    <!-- 新对话按钮 -->
    <button class="bottom-button new-chat-button" @click="createNewChat">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
      </svg>
      <span>新对话</span>
    </button>
    
    <!-- 设置按钮 -->
    <button class="bottom-button" @click="openSettings">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
      <span>设置</span>
    </button>
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
  }
});

const emit = defineEmits([
  'toggle-model-dropdown',
  'select-model',
  'select-custom-model',
  'toggle-history',
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
  console.log('切换模型下拉框状态');
  emit('toggle-model-dropdown');
};

const selectModel = (id: string) => {
  console.log('选择模型:', id);
  emit('select-model', id);
  emit('toggle-model-dropdown');
};

const selectCustomModel = (id: string) => {
  console.log('选择自定义模型:', id);
  emit('select-custom-model', id);
  emit('toggle-model-dropdown');
};

const toggleHistory = () => {
  emit('toggle-history');
};

const createNewChat = () => {
  emit('create-new-chat');
};

const openSettings = () => {
  emit('open-settings');
};
</script>

<style scoped>
.model-container {
  position: relative;
  z-index: 101;
}

.models-dropdown-bottom {
  z-index: 1001;
}
</style> 