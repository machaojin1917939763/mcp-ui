<template>
  <div>
    <div 
      class="overlay settings-overlay" 
      v-if="showSettings" 
      @click="closeSettings"
    ></div>
    
    <div class="settings-panel" v-if="showSettings">
      <!-- 设置菜单 -->
      <div class="settings-menu">
        <div 
          class="settings-menu-item" 
          :class="{ active: settingsTab === 'api' }"
          @click="settingsTab = 'api'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <path d="M8 21h8"></path>
            <path d="M12 17v4"></path>
          </svg>
          <span>API设置</span>
        </div>
        <div 
          class="settings-menu-item" 
          :class="{ active: settingsTab === 'appearance' }"
          @click="settingsTab = 'appearance'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 5v2"></path>
            <path d="M12 17v2"></path>
            <path d="M5 12h2"></path>
            <path d="M17 12h2"></path>
            <path d="M19.071 4.929l-1.414 1.414"></path>
            <path d="M6.343 17.657l-1.414 1.414"></path>
            <path d="M19.071 19.071l-1.414-1.414"></path>
            <path d="M6.343 6.343l-1.414-1.414"></path>
          </svg>
          <span>外观设置</span>
        </div>
        <div 
          class="settings-menu-item" 
          :class="{ active: settingsTab === 'about' }"
          @click="settingsTab = 'about'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 16v-4"></path>
            <path d="M12 8h.01"></path>
          </svg>
          <span>关于</span>
        </div>
      </div>
      
      <!-- API设置页面 -->
      <div class="settings-content" v-if="settingsTab === 'api'">
        <h3>API设置</h3>
        
        <div class="settings-group">
          <label for="provider">模型提供商:</label>
          <select 
            id="provider" 
            :value="providerId" 
            @change="updateProviderId($event.target.value)" 
            class="styled-select"
          >
            <option v-for="provider in MODEL_PROVIDERS" :key="provider.id" :value="provider.id">
              {{ provider.name }}
            </option>
          </select>
        </div>
        
        <!-- 当选择自定义提供商时显示自定义设置 -->
        <div v-if="providerId === 'custom'" class="settings-group custom-provider-section">
          <label for="customBaseUrl">自定义API基础URL:</label>
          <input 
            type="text" 
            id="customBaseUrl" 
            :value="customBaseUrl" 
            @input="updateCustomBaseUrl($event.target.value)"
            placeholder="例如: https://api.example.com/v1"
            class="styled-input"
          />
          
          <label class="mt-3">自定义模型列表:</label>
          <div class="custom-models-container">
            <div class="custom-models-list">
              <div v-for="model in customModels" :key="model.id" class="custom-model-item">
                <div class="custom-model-details">
                  <div class="custom-model-id">{{ model.id }}</div>
                  <div class="custom-model-name">{{ model.name }}</div>
                </div>
                <div class="custom-model-actions">
                  <button 
                    class="model-select-btn" 
                    :class="{ active: customModelId === model.id }"
                    @click="updateCustomModelId(model.id)"
                  >
                    {{ customModelId === model.id ? '已选择' : '选择' }}
                  </button>
                  <button class="model-delete-btn" @click="removeCustomModel(model.id)">
                    删除
                  </button>
                </div>
              </div>
            </div>

            <div class="add-model-section">
              <h4>添加新模型</h4>
              <div class="add-model-form">
                <input 
                  type="text" 
                  :value="newCustomModelId" 
                  @input="updateNewCustomModelId($event.target.value)"
                  placeholder="模型ID (必填)" 
                  class="add-model-input"
                />
                <input 
                  type="text" 
                  :value="newCustomModelName" 
                  @input="updateNewCustomModelName($event.target.value)"
                  placeholder="模型名称 (可选)" 
                  class="add-model-input"
                />
                <input 
                  type="text" 
                  :value="newCustomModelDesc" 
                  @input="updateNewCustomModelDesc($event.target.value)"
                  placeholder="模型描述 (可选)" 
                  class="add-model-input"
                />
              </div>
              <button 
                class="add-model-button" 
                type="button"
                @click="addCustomModel" 
                :disabled="!newCustomModelId.trim()"
              >
                添加模型
              </button>
            </div>
          </div>
        </div>
        
        <!-- 当不是自定义提供商时显示模型下拉列表 -->
        <div v-else class="settings-group">
          <label for="model">模型:</label>
          <select 
            id="model" 
            :value="modelId" 
            @change="updateModelId($event.target.value)" 
            class="styled-select"
          >
            <option v-for="model in availableModels" :key="model.id" :value="model.id">
              {{ model.id }} - {{ model.name }}
            </option>
          </select>
          <div class="model-description" v-if="modelId && currentModelDescription">
            {{ currentModelDescription }}
          </div>
        </div>
        
        <div class="settings-group">
          <label for="apiKey">API密钥:</label>
          <input 
            type="password" 
            id="apiKey" 
            :value="apiKey" 
            @input="updateApiKey($event.target.value)"
            placeholder="sk-..." 
            class="styled-input"
          />
          <small>当前API密钥: {{ maskedApiKey || '未设置' }}</small>
        </div>
      </div>
      
      <!-- 外观设置页面 -->
      <div class="settings-content" v-if="settingsTab === 'appearance'">
        <h3>外观设置</h3>
        
        <div class="settings-group">
          <label for="codeTheme">代码高亮主题:</label>
          <select 
            id="codeTheme" 
            :value="currentTheme" 
            @change="loadCodeTheme($event.target.value)" 
            class="styled-select"
          >
            <option v-for="theme in codeThemes" :key="theme.id" :value="theme.id">
              {{ theme.name }}
            </option>
          </select>
          
          <div class="theme-preview">
            <div class="preview-label">主题预览:</div>
            <div class="code-block-wrapper preview-code-block">
              <div class="code-block-header">
                <span class="code-language">javascript</span>
                <button class="copy-btn">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  <span>复制</span>
                </button>
              </div>
              <pre><code class="hljs language-javascript">
function greeting(name) {
  console.log(`Hello, ${name}!`);
  return {
    message: `欢迎, ${name}`,
    timestamp: new Date().toLocaleString()
  };
}

// 示例对象
const user = {
  name: '张三',
  age: 28,
  isActive: true
};</code></pre>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 关于页面 -->
      <div class="settings-content" v-if="settingsTab === 'about'">
        <h3>关于 MCP 智能对话</h3>
        
        <div class="about-info">
          <p>MCP 智能对话是一个轻量级的AI对话工具，支持多种大型语言模型。</p>
          <p>版本: 1.0.0</p>
          <p>开发者: MCP Team</p>
        </div>
      </div>
      
      <!-- 底部按钮 -->
      <div class="settings-footer">
        <div class="settings-actions">
          <button @click="saveSettings" class="save-button">保存</button>
          <button @click="closeSettings" class="cancel-button">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, defineProps, defineEmits, onMounted } from 'vue';
import type { ModelInfo } from '../composables';

// 全局类型声明
declare global {
  interface Window {
    hljs: any;
  }
}

// 代码高亮主题列表
const codeThemes = [
  { id: 'github', name: 'GitHub' },
  { id: 'github-dark', name: 'GitHub Dark' },
  { id: 'atom-one-dark', name: 'Atom One Dark' },
  { id: 'atom-one-light', name: 'Atom One Light' },
  { id: 'vs', name: 'Visual Studio' },
  { id: 'vs2015', name: 'Visual Studio 2015' },
  { id: 'monokai', name: 'Monokai' },
  { id: 'dracula', name: 'Dracula' },
  { id: 'solarized-light', name: 'Solarized Light' },
  { id: 'solarized-dark', name: 'Solarized Dark' }
];

// 当前选择的主题
const currentTheme = ref(localStorage.getItem('codeTheme') || 'github');

// 设置面板标签页
const settingsTab = ref('api'); // 'api', 'appearance', 'about'

const props = defineProps({
  showSettings: {
    type: Boolean,
    required: true
  },
  apiKey: {
    type: String,
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
  customBaseUrl: {
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
  newCustomModelId: {
    type: String,
    required: true
  },
  newCustomModelName: {
    type: String,
    required: true
  },
  newCustomModelDesc: {
    type: String,
    required: true
  },
  MODEL_PROVIDERS: {
    type: Array,
    required: true
  },
  availableModels: {
    type: Array as () => ModelInfo[],
    required: true
  },
  currentModelDescription: {
    type: String,
    default: ''
  },
  maskedApiKey: {
    type: String,
    default: ''
  }
});

const emit = defineEmits([
  'update:showSettings',
  'update:apiKey',
  'update:providerId',
  'update:modelId',
  'update:customBaseUrl', 
  'update:customModelId', 
  'update:newCustomModelId',
  'update:newCustomModelName',
  'update:newCustomModelDesc',
  'update:currentTheme',
  'save-settings',
  'add-custom-model',
  'remove-custom-model'
]);

// 更新函数，用于替代v-model
const updateProviderId = (value: string) => {
  emit('update:providerId', value);
};

const updateModelId = (value: string) => {
  emit('update:modelId', value);
};

const updateApiKey = (value: string) => {
  emit('update:apiKey', value);
};

const updateCustomBaseUrl = (value: string) => {
  emit('update:customBaseUrl', value);
};

const updateCustomModelId = (value: string) => {
  emit('update:customModelId', value);
};

const updateNewCustomModelId = (value: string) => {
  emit('update:newCustomModelId', value);
};

const updateNewCustomModelName = (value: string) => {
  emit('update:newCustomModelName', value);
};

const updateNewCustomModelDesc = (value: string) => {
  emit('update:newCustomModelDesc', value);
};

// 加载代码高亮主题
function loadCodeTheme(themeId: string) {
  const themeLinks = document.querySelectorAll('link[data-hljs-theme]');
  
  // 移除之前的主题链接
  themeLinks.forEach(link => link.remove());
  
  // 添加新的主题链接
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://cdn.jsdelivr.net/npm/highlight.js@11.7.0/styles/${themeId}.min.css`;
  link.setAttribute('data-hljs-theme', themeId);
  document.head.appendChild(link);
  
  // 保存主题选择
  localStorage.setItem('codeTheme', themeId);
  currentTheme.value = themeId;
  emit('update:currentTheme', themeId);
  
  // 重新应用代码高亮
  setTimeout(() => {
    if (window.hljs) {
      document.querySelectorAll('pre code').forEach((block) => {
        window.hljs.highlightElement(block);
      });
    }
  }, 100);
}

// 组件挂载时加载当前主题
onMounted(() => {
  loadCodeTheme(currentTheme.value);
});

// 关闭设置面板
const closeSettings = () => {
  emit('update:showSettings', false);
};

// 保存设置
const saveSettings = () => {
  emit('save-settings');
};

// 添加自定义模型
const addCustomModel = () => {
  emit('add-custom-model');
};

// 移除自定义模型
const removeCustomModel = (id: string) => {
  emit('remove-custom-model', id);
};
</script> 

<style scoped>
/* 设置面板样式 */
.settings-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: row;
  width: 85%;
  max-width: 1200px;
  height: 100vh;
  background-color: #fff;
  border-radius: 8px 0 0 8px;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 1001;
  animation: slideIn 0.3s ease-out forwards;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* 设置菜单样式 */
.settings-menu {
  width: 220px;
  background-color: #f6f8fa;
  border-right: 1px solid #e1e4e8;
  padding: 30px 0;
  overflow-y: auto;
  height: 100%;
}

.settings-menu-item {
  display: flex;
  align-items: center;
  padding: 14px 20px;
  color: #24292e;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 4px;
  border-left: 3px solid transparent;
}

.settings-menu-item svg {
  margin-right: 12px;
  color: #57606a;
  transition: color 0.2s ease;
}

.settings-menu-item:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.settings-menu-item.active {
  background-color: rgba(9, 105, 218, 0.1);
  font-weight: 600;
  color: #0969da;
  border-left: 3px solid #0969da;
}

.settings-menu-item.active svg {
  color: #0969da;
}

/* 设置内容样式 */
.settings-content {
  flex: 1;
  padding: 30px;
  padding-bottom: 120px; /* 增加底部内边距，为底部按钮留出更多空间 */
  overflow-y: auto;
  height: 100%;
  position: relative;
}

.settings-content h3 {
  margin-top: 0;
  margin-bottom: 24px;
  color: #24292e;
  font-size: 20px;
  border-bottom: 1px solid #e1e4e8;
  padding-bottom: 12px;
}

/* 设置组样式 */
.settings-group {
  margin-bottom: 24px;
  position: relative;
}

.custom-provider-section {
  margin-bottom: 120px;
}

/* 自定义模型容器 */
.custom-models-container {
  position: relative;
  margin-top: 12px;
}

/* 自定义模型列表 */
.custom-models-list {
  margin-bottom: 20px;
  border: 1px solid #e1e4e8;
  border-radius: 6px;
  overflow: hidden;
  background-color: #f6f8fa;
}

.settings-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #24292e;
}

.styled-select, .styled-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid #d0d7de;
  font-size: 14px;
  background-color: #fff;
  color: #24292e;
  transition: border-color 0.2s ease;
}

.styled-select:focus, .styled-input:focus {
  border-color: #0969da;
  outline: none;
  box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.3);
}

.model-description {
  margin-top: 8px;
  font-size: 13px;
  color: #57606a;
  line-height: 1.5;
}

/* 遮罩层样式 */
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  opacity: 0;
  animation: fadeIn 0.3s ease-out forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 自定义模型列表 */
.custom-models-list {
  margin-top: 12px;
  margin-bottom: 100px;
  border: 1px solid #e1e4e8;
  border-radius: 6px;
  overflow: hidden;
  background-color: #f6f8fa;
}

.custom-model-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e1e4e8;
}

.custom-model-details {
  flex: 1;
}

.custom-model-id {
  font-weight: 600;
  color: #24292e;
  font-size: 14px;
}

.custom-model-name {
  font-size: 13px;
  color: #57606a;
  margin-top: 2px;
}

.custom-model-actions {
  display: flex;
  gap: 8px;
}

.model-select-btn, .model-delete-btn {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.model-select-btn {
  background-color: #f6f8fa;
  color: #24292e;
  border: 1px solid #d0d7de;
}

.model-select-btn:hover {
  background-color: #e9ebef;
}

.model-select-btn.active {
  background-color: #0969da;
  color: white;
  border-color: #0969da;
}

.model-delete-btn {
  background-color: #f6f8fa;
  color: #d73a49;
  border: 1px solid #d0d7de;
}

.model-delete-btn:hover {
  background-color: #fae3e3;
  border-color: #d73a49;
}

/* 添加模型区域 - 全新样式 */
.add-model-section {
  padding: 15px;
  margin-top: 10px;
  background-color: #e8f0fe;
  border: 1px solid #cce0ff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.add-model-section h4 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #1565c0;
  font-size: 15px;
  font-weight: 600;
}

.add-model-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.add-model-input {
  padding: 10px 12px;
  border: 1px solid #c0d6e9;
  border-radius: 6px;
  font-size: 14px;
  background-color: #fff;
  color: #333;
  transition: all 0.2s ease;
}

.add-model-input:focus {
  border-color: #1565c0;
  outline: none;
  box-shadow: 0 0 0 3px rgba(21, 101, 192, 0.2);
}

.add-model-button {
  width: 100%;
  padding: 12px 0;
  background-color: #1565c0;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
}

.add-model-button:hover:not(:disabled) {
  background-color: #0d47a1;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.add-model-button:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.add-model-button:disabled {
  background-color: #90caf9;
  opacity: 0.7;
  cursor: not-allowed;
}

/* 设置面板底部和按钮 */
.settings-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 15px 25px;
  margin-left: 220px;
  background-color: #f9f9fb;
  border-top: 1px solid #e1e4e8;
  text-align: right;
  z-index: 10;
  box-shadow: 0 -2px 5px rgba(0, 0, 0, 0.05);
}

.settings-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.settings-actions button {
  padding: 8px 18px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.save-button {
  background-color: #0969da;
  color: white;
  border: none;
}

.save-button:hover {
  background-color: #0553a8;
  transform: translateY(-1px);
}

.cancel-button {
  background-color: #f6f8fa;
  color: #24292e;
  border: 1px solid #d0d7de;
}

.cancel-button:hover {
  background-color: #e9ebef;
  transform: translateY(-1px);
}

/* 主题预览样式 */
.theme-preview {
  margin-top: 20px;
  border: 1px solid #e1e4e8;
  border-radius: 6px;
  overflow: hidden;
}

.preview-label {
  padding: 8px 12px;
  background-color: #f4f5f7;
  border-bottom: 1px solid #e1e4e8;
  font-weight: 600;
  font-size: 0.9em;
}

.preview-code-block {
  margin: 0;
  border: none;
}

/* 关于页面样式 */
.about-info {
  line-height: 1.6;
}

.about-info p {
  margin-bottom: 12px;
}
</style> 