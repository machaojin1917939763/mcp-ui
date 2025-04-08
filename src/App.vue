<script setup lang="ts">
import { ref } from 'vue';
import NewChatComponent from './components/NewChatComponent.vue';
import SettingsPanel from './components/SettingsPanel.vue';
import BottomControls from './components/BottomControls.vue';
import { useModelSettings } from './composables/useModelSettings';

// 创建一个MCPClient实例和一个通知函数的模拟
const mcpClient = {
  setModel: (id: string) => console.log(`设置模型: ${id}`),
  initialize: () => console.log('初始化MCPClient')
};
const showNotification = (message: string) => console.log(message);

// 使用model设置组合式函数
const {
  apiKey, 
  providerId, 
  modelId, 
  customBaseUrl, 
  customModelId, 
  customModels,
  newCustomModelId,
  newCustomModelName,
  newCustomModelDesc,
  effectiveModelId,
  maskedApiKey,
  currentModelDescription,
  MODEL_PROVIDERS,
  availableModels,
  providerApiKeys,
  providerModels,
  showModelDropdown,
  
  saveSettings,
  selectModel: originalSelectModel,
  selectCustomModel: originalSelectCustomModel,
  addCustomModel,
  removeCustomModel,
  updateProviderApiKey,
  toggleModelDropdown
} = useModelSettings();

// 显示设置
const showSettings = ref(false);

</script>

<template>
  <div>
    <NewChatComponent />
    <SettingsPanel
      :showSettings="showSettings"
      :apiKey="apiKey"
      :providerId="providerId"
      :modelId="modelId"
      :customBaseUrl="customBaseUrl"
      :customModelId="customModelId"
      :customModels="customModels"
      :providerModels="providerModels"
      :newCustomModelId="newCustomModelId"
      :newCustomModelName="newCustomModelName"
      :newCustomModelDesc="newCustomModelDesc"
      :MODEL_PROVIDERS="MODEL_PROVIDERS"
      :availableModels="availableModels"
      :currentModelDescription="currentModelDescription"
      :maskedApiKey="maskedApiKey"
      :providerApiKeys="providerApiKeys"
      @update:showSettings="showSettings = $event"
      @update:apiKey="apiKey = $event"
      @update:providerId="providerId = $event"
      @update:modelId="modelId = $event"
      @update:customBaseUrl="customBaseUrl = $event"
      @update:customModelId="customModelId = $event"
      @update:newCustomModelId="newCustomModelId = $event"
      @update:newCustomModelName="newCustomModelName = $event"
      @update:newCustomModelDesc="newCustomModelDesc = $event"
      @save-settings="() => saveSettings(mcpClient, showNotification)"
      @add-custom-model="() => addCustomModel(showNotification)"
      @remove-custom-model="removeCustomModel"
      @update:providerApiKey="updateProviderApiKey"
    />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}

html, body {
  height: 100%;
  overflow: hidden;
}
</style>
