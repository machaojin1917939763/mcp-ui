<template>
  <div class="bottom-controls">
    <div class="model-selector-simple model-selector-dropdown" @click.stop="toggleModelDropdown" :class="{ 'disabled': showSettings }">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
        <path d="M8 21h8"></path>
        <path d="M12 17v4"></path>
      </svg>
      <span class="current-model">{{ 
        providerId === 'custom' 
          ? (customModelId || '未选择模型')
          : availableModels.find((model: ModelInfo) => model.id === modelId)?.name || modelId 
      }}</span>
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
      
      <!-- 模型下拉列表，确保点击事件不会冒泡 -->
      <div class="models-dropdown-bottom model-selector-dropdown" v-if="showModelDropdown && !showSettings" @click.stop>
        <div v-if="providerId !== 'custom'">
          <div 
            v-for="model in availableModels" 
            :key="model.id" 
            class="model-option"
            :class="{ active: model.id === modelId }"
            @click.stop="selectModel(model.id)"
          >
            <div class="model-id">{{ model.id }}</div>
            <div class="model-name">{{ model.name }}</div>
          </div>
        </div>
        <div v-else>
          <div 
            v-for="model in customModels" 
            :key="model.id" 
            class="model-option"
            :class="{ active: model.id === customModelId }"
            @click.stop="selectCustomModel(model.id)"
          >
            <div class="model-id">{{ model.id }}</div>
            <div class="model-name">{{ model.name }}</div>
          </div>
          <div v-if="customModels.length === 0" class="no-models-message">
            <span @click.stop="openSettings">请在设置中添加自定义模型</span>
          </div>
        </div>
      </div>
    </div>
    
    <button class="bottom-button history-button" @click="toggleHistory" title="对话历史" :disabled="showSettings">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 8v4l3 3"></path>
        <circle cx="12" cy="12" r="10"></circle>
      </svg>
      <span>历史</span>
    </button>
    
    <button class="bottom-button new-chat-button" @click="createNewChat" title="新建对话" :disabled="showSettings">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 5v14"></path>
        <path d="M5 12h14"></path>
      </svg>
      <span>新对话</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';
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

const toggleModelDropdown = () => {
  emit('toggle-model-dropdown');
};

const selectModel = (modelId: string) => {
  emit('select-model', modelId);
};

const selectCustomModel = (modelId: string) => {
  emit('select-custom-model', modelId);
};

const toggleHistory = () => {
  emit('toggle-history');
};

const createNewChat = () => {
  emit('create-new-chat');
  setTimeout(() => {
    const chatMessagesElement = document.querySelector('.chat-messages');
    if (chatMessagesElement) {
      chatMessagesElement.scrollTop = 0;
    }
  }, 50);
};

const openSettings = () => {
  emit('open-settings');
};
</script> 