import { ref, computed, watch } from 'vue';
import { 
  MODEL_PROVIDERS, 
  getProviderById, 
  getDefaultProviderId, 
  getDefaultModelId, 
  type ModelInfo 
} from '../services/ModelProviders';

// 重新导出ModelInfo类型以便在其他文件中使用
export type { ModelInfo };

export function useModelSettings() {
  // API设置
  const apiKey = ref(localStorage.getItem('apiKey') || '');
  const providerId = ref(localStorage.getItem('providerId') || getDefaultProviderId());
  const modelId = ref(localStorage.getItem('modelId') || getDefaultModelId(providerId.value));
  const customBaseUrl = ref(localStorage.getItem('customBaseUrl') || '');
  const customModelId = ref(localStorage.getItem('customModelId') || '');
  
  // 自定义模型列表
  const customModels = ref<ModelInfo[]>(JSON.parse(localStorage.getItem('customModels') || '[]'));
  
  // 如果自定义模型列表为空，初始化一个默认模型
  if (customModels.value.length === 0 && customModelId.value) {
    customModels.value.push({
      id: customModelId.value,
      name: '自定义模型',
      description: '手动添加的自定义模型',
      contextLength: 4000,
      supportsTools: true
    });
  }

  // 自定义模型输入状态
  const newCustomModelId = ref('');
  const newCustomModelName = ref('');
  const newCustomModelDesc = ref('');
  
  // 模型下拉选择器状态
  const showModelDropdown = ref(false);

  // 计算属性：当前提供商信息
  const currentProvider = computed(() => {
    return getProviderById(providerId.value);
  });

  // 计算属性：当前提供商的模型列表
  const availableModels = computed(() => {
    if (!currentProvider.value) return [];
    return currentProvider.value.models;
  });

  // 计算属性：显示的API基础URL
  const apiBaseUrl = computed(() => {
    if (providerId.value === 'custom') {
      return customBaseUrl.value;
    }
    return currentProvider.value?.baseUrl || '';
  });

  // 计算属性：实际使用的模型ID
  const effectiveModelId = computed(() => {
    if (providerId.value === 'custom') {
      return customModelId.value;
    }
    return modelId.value;
  });

  // 计算属性：遮盖的API Key (只显示前4位和后4位)
  const maskedApiKey = computed(() => {
    if (!apiKey.value) return '';
    if (apiKey.value.length <= 8) return '••••••••';
    return apiKey.value.slice(0, 4) + '••••••••' + apiKey.value.slice(-4);
  });

  // 计算当前选择模型的描述
  const currentModelDescription = computed(() => {
    if (!modelId.value || !currentProvider.value) return '';
    const selectedModel = availableModels.value.find((model: ModelInfo) => model.id === modelId.value);
    return selectedModel?.description || '';
  });

  // 当提供商变更时，重置模型选择
  watch(providerId, (newProviderId) => {
    if (newProviderId !== 'custom') {
      modelId.value = getDefaultModelId(newProviderId);
    }
  });

  // 保存设置并重新加载
  function saveSettings(mcpClient: any, showNotification: (message: string) => void) {
    localStorage.setItem('apiKey', apiKey.value);
    localStorage.setItem('providerId', providerId.value);
    
    if (providerId.value === 'custom') {
      localStorage.setItem('customBaseUrl', customBaseUrl.value);
      localStorage.setItem('customModelId', customModelId.value);
      localStorage.setItem('customModels', JSON.stringify(customModels.value));
    } else {
      localStorage.setItem('modelId', modelId.value);
    }
    
    // 重新初始化客户端
    mcpClient.initialize();
    
    // 显示设置已保存的通知
    showNotification('设置已保存');
  }

  // 选择模型
  function selectModel(newModelId: string, mcpClient: any, showNotification: (message: string) => void) {
    modelId.value = newModelId;
    showModelDropdown.value = false;
    
    try {
      mcpClient.setModel(newModelId);
      localStorage.setItem('modelId', newModelId);
      showNotification(`已切换到 ${availableModels.value.find(model => model.id === newModelId)?.name || newModelId}`);
    } catch (error) {
      console.error('设置模型失败:', error);
      showNotification('设置模型失败，请稍后重试');
    }
  }

  // 选择自定义模型
  function selectCustomModel(id: string, mcpClient: any, showNotification: (message: string) => void) {
    console.log('选择自定义模型:', id);
    console.log('当前自定义模型列表:', customModels.value);
    
    customModelId.value = id;
    showModelDropdown.value = false;
    
    try {
      mcpClient.setModel(id);
      localStorage.setItem('customModelId', id);
      
      // 查找选中的模型名称
      const selectedModel = customModels.value.find(model => model.id === id);
      const modelName = selectedModel ? selectedModel.name : id;
      
      showNotification(`已切换到 ${modelName}`);
      console.log('切换到自定义模型:', modelName);
    } catch (error) {
      console.error('设置自定义模型失败:', error);
      showNotification('设置自定义模型失败，请稍后重试');
    }
  }

  // 添加自定义模型
  function addCustomModel(showNotification: (message: string) => void) {
    if (!newCustomModelId.value.trim()) return;
    
    // 检查模型是否已存在
    if (customModels.value.some(m => m.id === newCustomModelId.value)) {
      showNotification('模型已存在');
      return;
    }
    
    // 添加新模型
    customModels.value.push({
      id: newCustomModelId.value,
      name: newCustomModelName.value || newCustomModelId.value,
      description: newCustomModelDesc.value || '自定义模型',
      contextLength: 4000,
      supportsTools: true
    });
    
    // 如果还没有选择模型，选择新添加的模型
    if (!customModelId.value) {
      customModelId.value = newCustomModelId.value;
    }
    
    // 清空输入
    newCustomModelId.value = '';
    newCustomModelName.value = '';
    newCustomModelDesc.value = '';
    
    // 保存到本地存储
    localStorage.setItem('customModels', JSON.stringify(customModels.value));
  }

  // 删除自定义模型
  function removeCustomModel(id: string) {
    customModels.value = customModels.value.filter(m => m.id !== id);
    localStorage.setItem('customModels', JSON.stringify(customModels.value));
    
    // 如果删除的是当前选中的模型，重置为第一个模型或空
    if (customModelId.value === id) {
      customModelId.value = customModels.value.length > 0 ? customModels.value[0].id : '';
      localStorage.setItem('customModelId', customModelId.value);
    }
  }

  return {
    MODEL_PROVIDERS,
    apiKey,
    providerId,
    modelId,
    customBaseUrl,
    customModelId,
    customModels,
    newCustomModelId,
    newCustomModelName,
    newCustomModelDesc,
    showModelDropdown,
    currentProvider,
    availableModels,
    apiBaseUrl,
    effectiveModelId,
    maskedApiKey,
    currentModelDescription,
    
    saveSettings,
    selectModel,
    selectCustomModel,
    addCustomModel,
    removeCustomModel
  };
} 