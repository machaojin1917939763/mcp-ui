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
          :class="{ active: settingsTab === 'mcp' }"
          @click="settingsTab = 'mcp'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
          </svg>
          <span>MCP服务器</span>
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
      
      <!-- MCP服务器设置页面 -->
      <div class="settings-content" v-if="settingsTab === 'mcp'">
        <h3>MCP服务器设置</h3>
        
        <div class="mcp-description">
          <p>MCP (Model Context Protocol) 是一种协议，允许AI模型通过工具与外部系统进行交互。</p>
          <p>您可以配置多个MCP服务器，以便AI可以使用它们提供的工具。</p>
        </div>
        
        <div class="settings-group">
          <h4>已配置的MCP服务器</h4>
          <div class="mcp-servers-list">
            <div v-if="mcpServers.length === 0" class="no-servers">
              <p>暂无配置的服务器。请添加一个新服务器。</p>
            </div>
            <div 
              v-for="(server, index) in mcpServers" 
              :key="server.id" 
              class="mcp-server-item-wrapper"
            >
              <div class="mcp-server-item">
              <div class="mcp-server-details">
                <div class="mcp-server-header">
                  <div class="mcp-server-name">{{ server.name }}</div>
                  <div class="mcp-server-status" :class="{ enabled: server.enabled }">
                    {{ server.enabled ? '已启用' : '已禁用' }}
                  </div>
                </div>
                <div class="mcp-server-id">ID: {{ server.id }}</div>
                  
                  <!-- SSE类型显示URL -->
                  <div v-if="server.transport === 'sse'" class="mcp-server-url">
                    URL: {{ server.url }}
                  </div>
                  
                  <!-- STDIO类型显示命令和参数 -->
                  <div v-if="server.transport === 'stdio'" class="mcp-server-command">
                    命令: {{ server.command }}
                    <div class="mcp-server-args" v-if="server.args && server.args.length">
                      参数:
                      <div class="args-pills">
                        <span 
                          v-for="(arg, idx) in server.args" 
                          :key="idx"
                          class="arg-pill"
                        >
                          {{ arg }}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div class="mcp-server-transport">传输方式: {{ server.transport?.toUpperCase() || 'SSE' }}</div>
                <div v-if="server.description" class="mcp-server-description">
                  {{ server.description }}
                </div>
                  
                  <!-- 服务器状态信息 -->
                  <div class="mcp-server-status-info" v-if="server.enabled">
                    <div class="status-indicator" :class="{ connected: props.serverConnectionStatus[server.id]?.connected }">
                      <span class="status-dot"></span>
                      <span class="status-text">
                        {{ server.transport === 'stdio' 
                          ? '等待调用' 
                          : (props.serverConnectionStatus[server.id]?.connected ? '已连接' : '未连接') 
                        }}
                      </span>
                    </div>
                    <div class="last-checked" v-if="props.serverConnectionStatus[server.id]?.lastChecked">
                      最后检查: {{ new Date(props.serverConnectionStatus[server.id]?.lastChecked || 0).toLocaleString() }}
                    </div>
                    <div v-if="server.transport === 'stdio'" class="stdio-info">
                      <div class="stdio-note">
                        <strong>提示:</strong> {{ props.serverConnectionStatus[server.id]?.message || 'STDIO服务器将在您首次调用工具时启动' }}
                      </div>
                    </div>
                  </div>
                  
                  <!-- 服务器工具列表 -->
                  <div class="mcp-server-tools" v-if="server.enabled && props.serverTools[server.id]?.length">
                    <div class="tools-header" @click="toggleToolsList(server.id)">
                      <span>可用工具 ({{ props.serverTools[server.id]?.length || 0 }})</span>
                      <span class="toggle-icon">{{ props.expandedToolServers.includes(server.id) ? '▼' : '▶' }}</span>
                    </div>
                    <div class="tools-list" v-if="props.expandedToolServers.includes(server.id)">
                      <div class="tool-item" v-for="tool in props.serverTools[server.id]" :key="tool.name">
                        <div class="tool-name">{{ tool.name }}</div>
                        <div class="tool-description">{{ tool.description }}</div>
                      </div>
                    </div>
                  </div>
                  
                  <!-- 对于STDIO服务器但没有工具的情况显示提示 -->
                  <div class="mcp-server-tools" v-else-if="server.enabled && server.transport === 'stdio'">
                    <div class="tools-header">
                      <span>工具信息</span>
                    </div>
                    <div class="tools-list">
                      <div class="tool-item">
                        <div class="tool-description">STDIO服务器的工具将在首次调用时加载。当前未知可用工具列表。</div>
                      </div>
                      <div class="tool-item">
                        <button 
                          type="button" 
                          class="load-tools-btn"
                          @click="$emit('request-tools-info', server.id)"
                        >
                          尝试加载工具列表
                        </button>
                      </div>
                    </div>
                </div>
              </div>
              <div class="mcp-server-actions">
                <button 
                    type="button"
                  class="server-toggle-btn" 
                  :class="{ active: server.enabled }"
                    @click.stop.prevent="handleServerStatusChange(server.id)"
                >
                  {{ server.enabled ? '禁用' : '启用' }}
                </button>
                  <button 
                    type="button"
                    class="server-delete-btn" 
                    @click.stop.prevent="removeMcpServer(server.id)"
                  >
                  删除
                </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="settings-group">
          <h4>添加新MCP服务器</h4>
          <div class="add-mcp-server-form">
            <div class="input-group">
              <label for="mcpServerId">服务器ID:</label>
              <input 
                type="text" 
                id="mcpServerId" 
                :value="newMcpServerId" 
                @input="updateNewMcpServerId($event.target.value)"
                placeholder="唯一标识符，如：weather" 
                class="styled-input"
              />
            </div>
            <div class="input-group">
              <label for="mcpServerName">服务器名称:</label>
              <input 
                type="text" 
                id="mcpServerName" 
                :value="newMcpServerName" 
                @input="updateNewMcpServerName($event.target.value)"
                placeholder="显示名称，如：天气服务" 
                class="styled-input"
              />
            </div>
            
            <!-- 传输方式选择 -->
            <div class="input-group">
              <label for="mcpServerTransport">传输方式:</label>
              <div class="transport-options">
                <div 
                  class="transport-option" 
                  :class="{ active: newMcpServerTransport === 'sse' }"
                  @click="updateNewMcpServerTransport('sse')"
                >
                  <div class="transport-radio">
                    <div class="radio-inner" v-if="newMcpServerTransport === 'sse'"></div>
                  </div>
                  <div class="transport-info">
                    <div class="transport-name">SSE</div>
                    <div class="transport-desc">Server-Sent Events - 适用于基于HTTP的服务器</div>
                  </div>
                </div>
                <div 
                  class="transport-option" 
                  :class="{ active: newMcpServerTransport === 'stdio' }"
                  @click="updateNewMcpServerTransport('stdio')"
                >
                  <div class="transport-radio">
                    <div class="radio-inner" v-if="newMcpServerTransport === 'stdio'"></div>
                  </div>
                  <div class="transport-info">
                    <div class="transport-name">STDIO</div>
                    <div class="transport-desc">标准输入/输出 - 适用于本地运行的进程</div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- SSE类型特有的配置 -->
            <div v-if="newMcpServerTransport === 'sse'" class="transport-config sse-config">
            <div class="input-group">
              <label for="mcpServerUrl">服务器URL:</label>
              <input 
                type="text" 
                id="mcpServerUrl" 
                :value="newMcpServerUrl" 
                @input="updateNewMcpServerUrl($event.target.value)"
                placeholder="例如：http://localhost:8080" 
                class="styled-input"
              />
            </div>
            </div>
            
            <!-- STDIO类型特有的配置 -->
            <div v-if="newMcpServerTransport === 'stdio'" class="transport-config stdio-config">
              <div class="input-group">
                <label for="mcpServerCommand">命令:</label>
                <input 
                  type="text" 
                  id="mcpServerCommand" 
                  :value="newMcpServerCommand" 
                  @input="updateNewMcpServerCommand($event.target.value)"
                  placeholder="如：python, node, uv等" 
                  class="styled-input"
                />
              </div>
              
              <div class="input-group">
                <label>参数列表:</label>
                <div class="args-list">
                  <div v-for="(arg, idx) in newMcpServerArgs" :key="idx" class="arg-item">
                    <input 
                      type="text" 
                      :value="arg" 
                      @input="updateMcpServerArg(idx, $event.target.value)"
                      placeholder="参数" 
                      class="styled-input arg-input"
                    />
                    <button 
                      type="button" 
                      class="arg-remove-btn" 
                      @click="removeMcpServerArg(idx)"
                      aria-label="删除参数"
                    >
                      &times;
                    </button>
                  </div>
                  <button 
                    type="button" 
                    class="add-arg-btn" 
                    @click="addMcpServerArg"
                  >
                    添加参数
                  </button>
                </div>
                <div class="args-tip">
                  <small>提示: 对于目录路径，请使用绝对路径。例如参数：<code>--directory</code>, <code>/path/to/folder</code>, <code>run</code>, <code>script.py</code></small>
                </div>
              </div>
              
              <div class="config-example">
                <div class="example-header">Claude桌面版配置示例：</div>
                <pre class="config-json">{
  "mcpServers": {
    "{{ newMcpServerId || 'weather' }}": {
      "command": "{{ newMcpServerCommand || 'uv' }}",
      "args": {{ newMcpServerArgs.length ? JSON.stringify(newMcpServerArgs, null, 2) : '[\n    "--directory",\n    "/path/to/folder",\n    "run",\n    "script.py"\n  ]' }}
    }
  }
}</pre>
              </div>
            </div>
            
            <div class="input-group">
              <label for="mcpServerDesc">服务器描述 (可选):</label>
              <input 
                type="text" 
                id="mcpServerDesc" 
                :value="newMcpServerDesc" 
                @input="updateNewMcpServerDesc($event.target.value)"
                placeholder="这个服务器提供什么功能？" 
                class="styled-input"
              />
            </div>

            <button 
              type="button" 
              class="add-server-button" 
              @click="addMcpServer"
              :disabled="(newMcpServerTransport === 'sse' && !newMcpServerUrl.trim()) || 
                         (newMcpServerTransport === 'stdio' && !newMcpServerCommand.trim()) || 
                         !newMcpServerId.trim()"
            >
              添加服务器
            </button>
          </div>
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
import type { MCPServerConfig } from '../composables/useMCPSettings';
import { useMCPSettings } from '../composables/useMCPSettings';

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
  },
  // MCP服务器相关
  mcpServers: {
    type: Array as () => MCPServerConfig[],
    required: true
  },
  newMcpServerId: {
    type: String,
    required: true
  },
  newMcpServerName: {
    type: String,
    required: true
  },
  newMcpServerUrl: {
    type: String,
    required: true
  },
  newMcpServerDesc: {
    type: String,
    required: true
  },
  newMcpServerTransport: {
    type: String,
    required: true
  },
  newMcpServerCommand: {
    type: String,
    default: ''
  },
  newMcpServerArgs: {
    type: Array as () => string[],
    default: () => []
  },
  // 服务器状态和工具信息
  serverConnectionStatus: {
    type: Object as () => Record<string, { connected?: boolean; checking?: boolean; error?: string; lastChecked?: number; message?: string }>,
    default: () => ({})
  },
  serverTools: {
    type: Object as () => Record<string, any[]>,
    default: () => ({})
  },
  expandedToolServers: {
    type: Array as () => string[],
    default: () => []
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
  // MCP服务器相关
  'update:newMcpServerId',
  'update:newMcpServerName',
  'update:newMcpServerUrl',
  'update:newMcpServerDesc',
  'update:newMcpServerTransport',
  'update:newMcpServerCommand',
  'update-mcp-server-args',
  'add-mcp-server-arg',
  'remove-mcp-server-arg',
  'save-settings',
  'add-custom-model',
  'remove-custom-model',
  'add-mcp-server',
  'toggle-mcp-server-status',
  'remove-mcp-server',
  'request-tools-info',
  'update:expandedToolServers'
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

const updateNewMcpServerId = (value: string) => {
  emit('update:newMcpServerId', value);
};

const updateNewMcpServerName = (value: string) => {
  emit('update:newMcpServerName', value);
};

const updateNewMcpServerUrl = (value: string) => {
  emit('update:newMcpServerUrl', value);
};

const updateNewMcpServerDesc = (value: string) => {
  emit('update:newMcpServerDesc', value);
};

const updateNewMcpServerTransport = (value: 'sse' | 'stdio') => {
  emit('update:newMcpServerTransport', value);
};

const updateNewMcpServerCommand = (value: string) => {
  emit('update:newMcpServerCommand', value);
};

const updateMcpServerArg = (index: number, value: string) => {
  emit('update-mcp-server-args', { index, value });
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

// 切换工具列表显示
function toggleToolsList(serverId: string) {
  if (props.expandedToolServers.includes(serverId)) {
    emit('update:expandedToolServers', props.expandedToolServers.filter(id => id !== serverId));
  } else {
    emit('update:expandedToolServers', [...props.expandedToolServers, serverId]);
  }
}

// 检查服务器状态
async function checkServerStatus() {
  for (const server of props.mcpServers) {
    if (server.enabled) {
      if (server.transport === 'sse') {
        try {
          props.serverConnectionStatus[server.id] = {
            checking: true,
            lastChecked: Date.now()
          };
          
          // 尝试连接服务器
          const response = await fetch(`${server.url}/health`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('apiKey') || ''}`
            }
          });
          
          if (response.ok) {
            props.serverConnectionStatus[server.id] = {
              connected: true,
              lastChecked: Date.now()
            };
            
            // 获取工具列表
            fetchServerTools(server);
          } else {
            props.serverConnectionStatus[server.id] = {
              connected: false,
              error: `HTTP错误: ${response.status}`,
              lastChecked: Date.now()
            };
          }
        } catch (error: any) {
          props.serverConnectionStatus[server.id] = {
            connected: false,
            error: error.message,
            lastChecked: Date.now()
          };
        }
      } else if (server.transport === 'stdio') {
        // STDIO类型服务器的状态检查
        props.serverConnectionStatus[server.id] = {
          connected: false, // STDIO服务器需要调用时才会连接
          lastChecked: Date.now(),
          message: '服务器将在首次工具调用时启动'
        };
        
        // 清空STDIO服务器的工具列表
        props.serverTools[server.id] = [];
      }
    }
  }
}

// 获取服务器工具列表
async function fetchServerTools(server: MCPServerConfig) {
  if (server.enabled) {
    if (server.transport === 'sse') {
      try {
        const response = await fetch(`${server.url}/tools`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('apiKey') || ''}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          props.serverTools[server.id] = data.tools || [];
        } else {
          console.error(`获取服务器 ${server.id} 工具列表失败: HTTP错误 ${response.status}`);
          props.serverTools[server.id] = [];
        }
      } catch (error) {
        console.error(`无法获取服务器 ${server.id} 的工具列表:`, error);
        props.serverTools[server.id] = [];
      }
    } else if (server.transport === 'stdio') {
      // STDIO服务器暂不支持预先获取工具列表
      console.log(`STDIO服务器 ${server.id} 的工具列表将在首次调用时可用`);
      // 设置为空工具列表
      props.serverTools[server.id] = [];
    }
  }
}

// 当服务器状态改变时，重新检查状态
function handleServerStatusChange(id: string) {
  toggleMcpServerStatus(id);
  // 允许UI更新后再检查状态
  setTimeout(() => {
    checkServerStatus();
  }, 100);
}

// 组件挂载时加载当前主题和设置监听器
onMounted(() => {
  loadCodeTheme(currentTheme.value);
  
  // 使用事件委托来处理所有按钮点击
  const serversListEl = document.querySelector('.mcp-servers-list');
  if (serversListEl) {
    serversListEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const button = target.closest('button');
      
      if (!button) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      // 获取服务器ID
      const serverItemWrapper = button.closest('.mcp-server-item-wrapper');
      if (!serverItemWrapper) return;
      
      const serverIndex = Array.from(
        document.querySelectorAll('.mcp-server-item-wrapper')
      ).indexOf(serverItemWrapper);
      
      if (serverIndex === -1 || !props.mcpServers[serverIndex]) return;
      
      const serverId = props.mcpServers[serverIndex].id;
      
      if (button.classList.contains('server-toggle-btn')) {
        console.log('通过事件委托切换服务器状态:', serverId);
        emit('toggle-mcp-server-status', serverId);
      } else if (button.classList.contains('server-delete-btn')) {
        console.log('通过事件委托删除服务器:', serverId);
        emit('remove-mcp-server', serverId);
      }
    });
  }
  
  checkServerStatus();
});

// 直接调用emit的方法
const toggleMcpServerStatus = (serverId: string) => {
  console.log('切换服务器状态:', serverId);
  
  // 找到对应的服务器
  const server = props.mcpServers.find(s => s.id === serverId);
  const wasEnabled = server?.enabled || false;
  
  // 发送切换状态的事件
  emit('toggle-mcp-server-status', serverId);
  
  // 如果服务器从禁用变为启用，我们需要立即尝试获取其工具
  setTimeout(() => {
    // 再次查找服务器，因为状态可能已经更新
    const updatedServer = props.mcpServers.find(s => s.id === serverId);
    if (updatedServer && !wasEnabled && updatedServer.enabled) {
      console.log(`服务器 ${serverId} 已启用，正在尝试获取工具列表...`);
      
      // 更新状态为"正在检查"
      props.serverConnectionStatus[serverId] = {
        checking: true,
        connected: false,
        lastChecked: Date.now(),
        message: '正在检查服务器状态...'
      };
      
      // 对于STDIO服务器，我们需要从MCPClient自动加载工具
      if (updatedServer.transport === 'stdio') {
        // 发送信号表明我们正在加载STDIO服务器工具
        props.serverConnectionStatus[serverId] = {
          checking: false,
          connected: false,
          lastChecked: Date.now(),
          message: '等待首次调用以加载工具'
        };
        
        // 尝试请求外部获取工具信息
        emit('request-tools-info', serverId);
      } else {
        // 对于SSE服务器，我们可以立即尝试获取工具
        checkSingleServerStatus(updatedServer);
      }
    }
  }, 100);
};

// 检查单个服务器的状态
async function checkSingleServerStatus(server: MCPServerConfig) {
  if (!server.enabled) return;
  
  if (server.transport === 'sse') {
    try {
      props.serverConnectionStatus[server.id] = {
        checking: true,
        lastChecked: Date.now()
      };
      
      // 尝试连接服务器
      const response = await fetch(`${server.url}/health`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('apiKey') || ''}`
        }
      });
      
      if (response.ok) {
        props.serverConnectionStatus[server.id] = {
          connected: true,
          lastChecked: Date.now()
        };
        
        // 获取工具列表
        fetchServerTools(server);
      } else {
        props.serverConnectionStatus[server.id] = {
          connected: false,
          error: `HTTP错误: ${response.status}`,
          lastChecked: Date.now()
        };
      }
    } catch (error: any) {
      props.serverConnectionStatus[server.id] = {
        connected: false,
        error: error.message,
        lastChecked: Date.now()
      };
    }
  } else if (server.transport === 'stdio') {
    // STDIO类型服务器的状态检查
    props.serverConnectionStatus[server.id] = {
      connected: false, // STDIO服务器需要调用时才会连接
      lastChecked: Date.now(),
      message: '服务器将在首次工具调用时启动'
    };
    
    // 尝试请求外部获取工具信息
    emit('request-tools-info', server.id);
  }
}

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

// 添加MCP服务器
const addMcpServer = () => {
  console.log('添加服务器', {
    id: props.newMcpServerId,
    url: props.newMcpServerUrl, 
    transport: props.newMcpServerTransport
  });
  emit('add-mcp-server');
};

// 添加新的方法
const addMcpServerArg = () => {
  emit('add-mcp-server-arg');
};

const removeMcpServerArg = (index: number) => {
  emit('remove-mcp-server-arg', index);
};

const removeMcpServer = (serverId: string) => {
  console.log('删除服务器:', serverId);
  emit('remove-mcp-server', serverId);
};
</script> 

<style scoped>
@import '../styles/settings.css';
</style> 