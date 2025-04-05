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
  
  // 获取保存的API密钥
  const savedApiKeys = localStorage.getItem('providerApiKeys');
  let initialApiKeys: Record<string, string> = {};
  
  if (savedApiKeys) {
    initialApiKeys = JSON.parse(savedApiKeys);
  } else if (apiKey.value) {
    // 如果有旧的全局apiKey，将其转移到当前提供商
    initialApiKeys[providerId.value] = apiKey.value;
  }
  
  // 每个提供商的API密钥
  const providerApiKeys = ref<Record<string, string>>(initialApiKeys);
  
  // 自定义模型列表
  const customModels = ref<ModelInfo[]>(JSON.parse(localStorage.getItem('customModels') || '[]'));
  
  // 各提供商的模型列表
  const providerModels = ref<Record<string, ModelInfo[]>>(
    JSON.parse(localStorage.getItem('providerModels') || '{}')
  );
  
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
  
  // 计算属性：当前提供商的API密钥
  const currentProviderApiKey = computed(() => {
    return providerApiKeys.value[providerId.value] || '';
  });

  // 计算属性：遮盖的API Key (只显示前4位和后4位)
  const maskedApiKey = computed(() => {
    const key = currentProviderApiKey.value;
    if (!key) return '';
    if (key.length <= 8) return '••••••••';
    return key.slice(0, 4) + '••••••••' + key.slice(-4);
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

  // 更新提供商的API密钥
  function updateProviderApiKey(provider: string, key: string) {
    providerApiKeys.value = { ...providerApiKeys.value, [provider]: key };
    localStorage.setItem('providerApiKeys', JSON.stringify(providerApiKeys.value));
    
    // 如果是当前提供商，也更新旧的全局apiKey（向后兼容）
    if (provider === providerId.value) {
      apiKey.value = key;
      localStorage.setItem('apiKey', key);
    }
  }

  // 保存设置并重新加载
  function saveSettings(mcpClient: any, showNotification: (message: string) => void) {
    // 保存当前提供商的API密钥
    localStorage.setItem('providerApiKeys', JSON.stringify(providerApiKeys.value));
    
    // 为了向后兼容，也保存全局apiKey
    localStorage.setItem('apiKey', currentProviderApiKey.value);
    
    localStorage.setItem('providerId', providerId.value);
    
    if (providerId.value === 'custom') {
      localStorage.setItem('customBaseUrl', customBaseUrl.value);
      localStorage.setItem('customModelId', customModelId.value);
      localStorage.setItem('customModels', JSON.stringify(customModels.value));
    } else {
      localStorage.setItem('modelId', modelId.value);
    }
    
    // 保存各提供商的模型列表
    localStorage.setItem('providerModels', JSON.stringify(providerModels.value));
    
    // 强制更新MCPClient的API密钥，确保它使用当前提供商的API密钥
    if (mcpClient && typeof mcpClient.setApiKey === 'function') {
      mcpClient.setApiKey(currentProviderApiKey.value);
      console.log(`已通过saveSettings调用MCPClient.setApiKey更新API密钥`);
    }
    
    // 重新初始化客户端
    mcpClient.initialize();
    
    // 显示设置已保存的通知
    showNotification('设置已保存');
  }

  // 选择模型
  function selectModel(newModelId: string, mcpClient: any, showNotification: (message: string) => void, newProviderId?: string) {
    let didProviderChange = false;
    
    // 如果传入了新的providerId，设置它
    if (newProviderId && newProviderId !== 'custom' && providerId.value !== newProviderId) {
      providerId.value = newProviderId;
      localStorage.setItem('providerId', newProviderId);
      didProviderChange = true;
    }
    // 否则，如果当前是自定义提供商，尝试找到合适的提供商
    else if (providerId.value === 'custom') {
      // 找到拥有这个模型的提供商
      const provider = MODEL_PROVIDERS.find(p => 
        p.id !== 'custom' && 
        p.models.some(m => m.id === newModelId)
      );
      
      if (provider) {
        providerId.value = provider.id;
        localStorage.setItem('providerId', provider.id);
        didProviderChange = true;
      }
    }
    
    // 如果供应商发生变化，更新API密钥
    if (didProviderChange) {
      // 从providerApiKeys中获取对应供应商的API密钥
      const newApiKey = providerApiKeys.value[providerId.value] || '';
      
      // 更新当前apiKey
      apiKey.value = newApiKey;
      localStorage.setItem('apiKey', newApiKey);
      
      // 强制更新MCPClient的API密钥
      if (mcpClient && typeof mcpClient.setApiKey === 'function') {
        mcpClient.setApiKey(newApiKey);
        console.log(`已调用MCPClient.setApiKey更新API密钥: ${newApiKey.slice(0, 3)}...`);
      } else {
        console.warn('MCPClient不存在或没有setApiKey方法');
      }
      
      console.log(`供应商已切换到 ${providerId.value}，更新API密钥`);
    }
    
    modelId.value = newModelId;
    showModelDropdown.value = false;
    
    try {
      // 先写入localStorage，确保MCPClient读取正确的值
      localStorage.setItem('modelId', newModelId);
      
      // 设置模型
      mcpClient.setModel(newModelId);
      
      // 使用正确的模型名称显示通知
      const selectedModel = availableModels.value.find(model => model.id === newModelId);
      const modelName = selectedModel ? selectedModel.name : newModelId;
      showNotification(`已切换到 ${modelName}`);
      
      // 保存所有设置以确保状态一致
      saveSettings(mcpClient, () => {});
    } catch (error) {
      console.error('设置模型失败:', error);
      showNotification('设置模型失败，请稍后重试');
    }
  }

  // 切换模型下拉菜单显示
  function toggleModelDropdown() {
    showModelDropdown.value = !showModelDropdown.value;
  }

  // 选择自定义模型
  function selectCustomModel(id: string, mcpClient: any, showNotification: (message: string) => void) {
    console.log('选择自定义模型:', id);
    console.log('当前自定义模型列表:', customModels.value);
    
    const didProviderChange = providerId.value !== 'custom';
    
    // 确保providerId设置为custom
    if (didProviderChange) {
      providerId.value = 'custom';
      localStorage.setItem('providerId', 'custom');
      
      // 更新API密钥为自定义供应商的密钥
      const newApiKey = providerApiKeys.value['custom'] || '';
      apiKey.value = newApiKey;
      localStorage.setItem('apiKey', newApiKey);
      
      // 强制更新MCPClient的API密钥
      if (mcpClient && typeof mcpClient.setApiKey === 'function') {
        mcpClient.setApiKey(newApiKey);
        console.log(`已调用MCPClient.setApiKey更新API密钥: ${newApiKey.slice(0, 3)}...`);
      } else {
        console.warn('MCPClient不存在或没有setApiKey方法');
      }
      
      console.log('供应商已切换到custom，更新API密钥');
    }
    
    customModelId.value = id;
    showModelDropdown.value = false;
    
    try {
      // 先写入localStorage，确保MCPClient读取正确的值
      localStorage.setItem('customModelId', id);
      
      // 设置模型
      mcpClient.setModel(id);
      
      // 查找选中的模型名称
      const selectedModel = customModels.value.find(model => model.id === id);
      const modelName = selectedModel ? selectedModel.name : id;
      
      showNotification(`已切换到 ${modelName}`);
      console.log('切换到自定义模型:', modelName);
      
      // 保存所有设置以确保状态一致
      saveSettings(mcpClient, () => {});
    } catch (error) {
      console.error('设置自定义模型失败:', error);
      showNotification('设置自定义模型失败，请稍后重试');
    }
  }

  // 添加自定义模型
  function addCustomModel(showNotification: (message: string) => void, targetProviderId?: string) {
    if (!newCustomModelId.value.trim()) return;
    
    // 确定目标提供商ID，默认为当前提供商
    const provider = targetProviderId || providerId.value;
    
    // 根据提供商ID决定添加到哪个模型列表
    if (provider === 'custom') {
      // 检查模型是否已存在
      if (customModels.value.some(m => m.id === newCustomModelId.value)) {
        showNotification('模型已存在');
        return;
      }
      
      // 添加到自定义模型列表
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
      
      // 保存到本地存储
      localStorage.setItem('customModels', JSON.stringify(customModels.value));
    } else {
      // 确保该提供商在providerModels中有一个数组
      if (!providerModels.value[provider]) {
        providerModels.value[provider] = [];
      }
      
      // 检查模型是否已存在
      if (providerModels.value[provider].some(m => m.id === newCustomModelId.value)) {
        showNotification('模型已存在');
        return;
      }
      
      // 添加到指定提供商的模型列表
      providerModels.value[provider].push({
        id: newCustomModelId.value,
        name: newCustomModelName.value || newCustomModelId.value,
        description: newCustomModelDesc.value || `${provider}自定义模型`,
        contextLength: 4000,
        supportsTools: true
      });
      
      // 保存到本地存储
      localStorage.setItem('providerModels', JSON.stringify(providerModels.value));
    }
    
    // 显示成功通知
    showNotification(`已成功添加模型: ${newCustomModelName.value || newCustomModelId.value}`);
    
    // 清空输入
    newCustomModelId.value = '';
    newCustomModelName.value = '';
    newCustomModelDesc.value = '';
  }

  // 删除模型
  function removeCustomModel(id: string, targetProviderId?: string) {
    // 确定目标提供商ID，默认为当前提供商
    const provider = targetProviderId || providerId.value;
    
    if (provider === 'custom') {
      // 从自定义模型列表中删除
      customModels.value = customModels.value.filter(m => m.id !== id);
      localStorage.setItem('customModels', JSON.stringify(customModels.value));
      
      // 如果删除的是当前选中的模型，重置为第一个模型或空
      if (customModelId.value === id) {
        customModelId.value = customModels.value.length > 0 ? customModels.value[0].id : '';
        localStorage.setItem('customModelId', customModelId.value);
      }
    } else {
      // 确保该提供商在providerModels中有一个数组
      if (providerModels.value[provider]) {
        // 从指定提供商的模型列表中删除
        providerModels.value[provider] = providerModels.value[provider].filter(m => m.id !== id);
        localStorage.setItem('providerModels', JSON.stringify(providerModels.value));
        
        // 如果删除的是当前选中的模型，重置为默认模型
        if (providerId.value === provider && modelId.value === id) {
          modelId.value = getDefaultModelId(provider);
          localStorage.setItem('modelId', modelId.value);
        }
      }
    }
  }

  // 获取当前模型状态 - 用于调试
  function getCurrentModelState() {
    return {
      apiKey: apiKey.value,
      providerId: providerId.value,
      modelId: modelId.value,
      customModelId: customModelId.value,
      effectiveModelId: effectiveModelId.value,
      providerApiKeys: providerApiKeys.value
    };
  }

  /**
   * 获取指定提供商的脱敏API密钥
   * @param provider 提供商ID，如果不指定则使用当前选中的提供商
   * @returns 脱敏后的API密钥
   */
  function getMaskedApiKey(provider?: string) {
    const targetProviderId = provider || providerId.value;
    const key = providerApiKeys.value[targetProviderId] || '';
    
    if (!key) return '';
    if (key.length <= 8) return '••••••••';
    return key.slice(0, 4) + '••••••••' + key.slice(-4);
  }

  return {
    MODEL_PROVIDERS,
    apiKey,
    providerId,
    modelId,
    customBaseUrl,
    customModelId,
    customModels,
    providerModels,
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
    providerApiKeys,
    currentProviderApiKey,
    
    getCurrentModelState,
    saveSettings,
    selectModel,
    selectCustomModel,
    addCustomModel,
    removeCustomModel,
    updateProviderApiKey,
    toggleModelDropdown,
    getMaskedApiKey
  };
} 