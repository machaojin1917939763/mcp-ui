<template>
  <div class="mcp-tools-panel">
    <div class="panel-header">
      <h3>MCP 工具</h3>
      <button @click="refreshTools" class="refresh-btn" title="刷新工具列表">
        <span class="refresh-icon">🔄</span>
      </button>
    </div>

    <div v-if="loading" class="loading">
      加载中...
    </div>
    <div v-else-if="error" class="error">
      加载失败: {{ error }}
    </div>
    <div v-else-if="tools.length === 0" class="empty-state">
      没有可用的工具
    </div>
    <div v-else class="tools-list">
      <div v-for="tool in tools" :key="tool.name" class="tool-item">
        <div class="tool-header" @click="toggleTool(tool)">
          <h4>{{ tool.name }}</h4>
          <span class="toggle-icon">{{ expandedTools.has(tool.name) ? '▼' : '▶' }}</span>
        </div>
        <div v-if="expandedTools.has(tool.name)" class="tool-details">
          <p class="tool-description">{{ tool.description }}</p>
          
          <div class="tool-params">
            <div v-for="(prop, propName) in tool.inputSchema.properties" :key="propName" class="param-item">
              <label :for="`${tool.name}-${propName}`">{{ propName }}: </label>
              <input
                :id="`${tool.name}-${propName}`"
                v-model="toolParams[tool.name][propName]"
                :placeholder="prop.description || propName"
                class="param-input"
              />
            </div>
          </div>
          
          <button
            @click="callTool(tool)"
            class="call-btn"
            :disabled="isCallingTool"
          >
            调用
          </button>
          
          <div v-if="toolResults[tool.name]" class="tool-result">
            <h5>结果:</h5>
            <pre>{{ JSON.stringify(toolResults[tool.name], null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>

    <div class="browser-navigation">
      <h4>浏览器导航</h4>
      <div class="browser-input">
        <input
          v-model="browserUrl"
          placeholder="输入URL"
          class="param-input"
          @keyup.enter="navigate"
        />
        <button @click="navigate" class="call-btn" :disabled="isNavigating">
          导航
        </button>
      </div>
      <div v-if="navigationResult" class="tool-result">
        <h5>结果:</h5>
        <pre>{{ JSON.stringify(navigationResult, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import MCPService from '../services/MCPService';
import type { MCPTool } from '../services/MCPService';

// 状态
const loading = ref(true);
const error = ref<string | null>(null);
const tools = ref<MCPTool[]>([]);
const expandedTools = reactive(new Set<string>());
const toolParams = reactive<Record<string, Record<string, any>>>({});
const toolResults = reactive<Record<string, any>>({});
const isCallingTool = ref(false);

// 浏览器导航状态
const browserUrl = ref('');
const isNavigating = ref(false);
const navigationResult = ref<any>(null);

// 初始化
onMounted(async () => {
  await refreshTools();
});

// 刷新工具列表
async function refreshTools() {
  loading.value = true;
  error.value = null;
  
  try {
    tools.value = await MCPService.getTools();
    
    // 初始化工具参数
    tools.value.forEach(tool => {
      if (!toolParams[tool.name]) {
        toolParams[tool.name] = {};
      }
    });
  } catch (err: any) {
    error.value = err.message || '获取工具失败';
    console.error('获取MCP工具失败', err);
  } finally {
    loading.value = false;
  }
}

// 切换工具展开/折叠状态
function toggleTool(tool: MCPTool) {
  if (expandedTools.has(tool.name)) {
    expandedTools.delete(tool.name);
  } else {
    expandedTools.add(tool.name);
  }
}

// 调用工具
async function callTool(tool: MCPTool) {
  isCallingTool.value = true;
  
  try {
    const result = await MCPService.callTool({
      name: tool.name,
      arguments: toolParams[tool.name] || {}
    });
    
    toolResults[tool.name] = result;
  } catch (err: any) {
    toolResults[tool.name] = { error: err.message || '调用失败' };
  } finally {
    isCallingTool.value = false;
  }
}

// 浏览器导航
async function navigate() {
  if (!browserUrl.value.trim()) return;
  
  isNavigating.value = true;
  navigationResult.value = null;
  
  try {
    // 确保URL有http/https前缀
    let url = browserUrl.value;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    // 先尝试确保playwright服务器已连接
    try {
      // 获取状态
      const clients = await MCPService.getClients();
      const playwright = clients.find(c => c.name === 'playwright');
      
      // 如果playwright客户端存在但未连接，则尝试连接
      if (playwright && !playwright.isConnected) {
        await MCPService.connectClient('playwright');
        console.log('已连接到Playwright服务');
      }
    } catch (err) {
      console.warn('连接Playwright服务失败，尝试直接调用', err);
      // 继续执行，即使连接失败也尝试调用
    }
    
    navigationResult.value = await MCPService.browserNavigate(url);
  } catch (err: any) {
    navigationResult.value = { error: err.message || '导航失败' };
  } finally {
    isNavigating.value = false;
  }
}
</script>

<style scoped>
.mcp-tools-panel {
  padding: 1rem;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #eee;
}

.refresh-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #666;
  font-size: 1rem;
}

.refresh-btn:hover {
  color: #333;
}

.loading, .error, .empty-state {
  padding: 1rem;
  text-align: center;
  color: #666;
}

.error {
  color: #e53935;
}

.tools-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tool-item {
  border: 1px solid #eee;
  border-radius: 4px;
  overflow: hidden;
}

.tool-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background-color: #f1f1f1;
  cursor: pointer;
}

.tool-header h4 {
  margin: 0;
  font-size: 1rem;
}

.toggle-icon {
  font-size: 0.8rem;
  color: #666;
}

.tool-details {
  padding: 0.75rem;
  background-color: #fff;
  border-top: 1px solid #eee;
}

.tool-description {
  margin-top: 0;
  color: #666;
  font-size: 0.9rem;
}

.tool-params {
  margin: 1rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.param-item {
  display: flex;
  flex-direction: column;
}

.param-input {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
}

.call-btn {
  padding: 0.5rem 1rem;
  background-color: #1976d2;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.call-btn:hover {
  background-color: #1565c0;
}

.call-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.tool-result {
  margin-top: 1rem;
  padding: 0.75rem;
  background-color: #f5f5f5;
  border-radius: 4px;
  font-size: 0.9rem;
}

.tool-result h5 {
  margin-top: 0;
  margin-bottom: 0.5rem;
}

.tool-result pre {
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.browser-navigation {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #eee;
}

.browser-input {
  display: flex;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.browser-input input {
  flex: 1;
}
</style> 