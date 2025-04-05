<template>
  <div class="tools-container">
    <!-- 工具面板按钮 -->
    <div class="tools-selector-simple" @click.stop="toggleToolsDropdown">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
      </svg>
      <span class="current-tools">工具 ({{ totalToolsCount }})</span>
    </div>
    
    <!-- 工具下拉面板 -->
    <div v-show="showToolsDropdown" class="tools-dropdown">
      <div class="tools-dropdown-header">
        <h3>可用工具</h3>
        <button class="close-tools-dropdown" @click.stop="toggleToolsDropdown">&times;</button>
      </div>
      
      <!-- 如果没有可用工具 -->
      <div v-if="!hasTools" class="no-tools">
        <p>当前没有可用的工具。请在设置中添加并启用MCP服务器。</p>
      </div>
      
      <!-- 按服务器分组显示工具 -->
      <div v-for="(tools, serverId) in groupedTools" :key="serverId" class="tool-category">
        <div class="tool-category-header">
          <span>{{ getServerName(serverId) }}</span>
          <span class="tool-count">{{ tools.length }} 个工具</span>
        </div>
        <div class="tool-list">
          <div v-for="tool in tools" :key="`${serverId}.${tool.name}`" class="tool-item-dropdown">
            <div class="tool-item-header">
              <div class="tool-item-name">{{ tool.name }}</div>
              <label class="tool-toggle">
                <input 
                  type="checkbox" 
                  :checked="isToolEnabled(serverId, tool.name)" 
                  @change.stop="toggleToolStatus(serverId, tool.name)"
                >
                <span class="tool-toggle-slider"></span>
              </label>
            </div>
            <div class="tool-item-desc">{{ tool.description }}</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 点击外部关闭下拉框的遮罩层 -->
    <div v-if="showToolsDropdown" class="dropdown-overlay" @click.stop="toggleToolsDropdown"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

// 定义类型
interface ServerConfig {
  id: string;
  name: string;
  enabled: boolean;
  [key: string]: any;
}

interface Tool {
  name: string;
  description: string;
  [key: string]: any;
}

interface ServerTools {
  [serverId: string]: Tool[];
}

interface ToggleToolEvent {
  serverId: string;
  toolName: string;
  enabled: boolean;
}

const props = defineProps({
  serverTools: {
    type: Object as () => ServerTools,
    required: true
  },
  mcpServers: {
    type: Array as () => ServerConfig[],
    required: true
  }
});

const emit = defineEmits<{
  'toggle-tool': [event: ToggleToolEvent]
}>();

// 下拉框显示状态
const showToolsDropdown = ref(false);

// 切换下拉框显示状态
const toggleToolsDropdown = () => {
  console.log('切换工具下拉框状态', showToolsDropdown.value, '→', !showToolsDropdown.value);
  showToolsDropdown.value = !showToolsDropdown.value;
};

// 用于存储事件处理函数引用的变量
let totalToolsUpdateHandler: EventListener;

// 组件挂载和卸载时的事件监听
onMounted(() => {
  document.addEventListener('click', handleGlobalClick);
  
  // 创建事件处理函数
  totalToolsUpdateHandler = ((event: CustomEvent) => {
    const { totalCount } = event.detail;
    console.log(`收到工具总数更新事件，总工具数: ${totalCount}`);
    // 此处无需更新totalToolsCount，因为它是计算属性会自动更新
  }) as EventListener;
  
  // 添加事件监听器
  window.addEventListener('mcp-total-tools-update', totalToolsUpdateHandler);
});

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick);
  
  // 移除事件监听器
  if (totalToolsUpdateHandler) {
    window.removeEventListener('mcp-total-tools-update', totalToolsUpdateHandler);
  }
});

// 点击外部关闭下拉框
const handleGlobalClick = (event: MouseEvent) => {
  const target = event.target as Element;
  const toolsContainer = document.querySelector('.tools-container');
  
  if (showToolsDropdown.value && toolsContainer && !toolsContainer.contains(target)) {
    showToolsDropdown.value = false;
  }
};

// 获取服务器名称
const getServerName = (serverId: string): string => {
  const server = props.mcpServers.find(s => s.id === serverId);
  return server ? server.name : serverId;
};

// 按服务器分组的工具
const groupedTools = computed((): ServerTools => {
  const result: ServerTools = {};
  
  // 遍历所有服务器工具
  for (const [serverId, tools] of Object.entries(props.serverTools)) {
    // 跳过空工具列表
    if (!tools || tools.length === 0) continue;
    
    // 查找对应的服务器配置
    const server = props.mcpServers.find(s => s.id === serverId);
    
    // 只包含已启用的服务器
    if (server && server.enabled) {
      result[serverId] = tools;
    }
  }
  
  return result;
});

// 计算工具总数
const totalToolsCount = computed((): number => {
  let total = 0;
  for (const tools of Object.values(groupedTools.value)) {
    total += tools.length;
  }
  return total;
});

// 判断是否有工具可用
const hasTools = computed(() => {
  return Object.keys(groupedTools.value).length > 0;
});

// 已启用的工具列表 (使用服务器ID_工具名作为唯一标识)
const enabledTools = ref<Set<string>>(new Set());

// 用于检查工具是否启用
const isToolEnabled = (serverId: string, toolName: string): boolean => {
  return enabledTools.value.has(`${serverId}_${toolName}`);
};

// 切换工具启用状态
const toggleToolStatus = (serverId: string, toolName: string): void => {
  const toolId = `${serverId}_${toolName}`;
  
  if (enabledTools.value.has(toolId)) {
    enabledTools.value.delete(toolId);
  } else {
    enabledTools.value.add(toolId);
  }
  
  // 发送事件通知父组件
  emit('toggle-tool', {
    serverId,
    toolName,
    enabled: enabledTools.value.has(toolId)
  });
};

// 监听serverTools变化，初始化新工具为已启用
watch(() => props.serverTools, (newTools: ServerTools) => {
  // 遍历所有新工具
  for (const [serverId, tools] of Object.entries(newTools)) {
    // 跳过空工具列表
    if (!tools || tools.length === 0) continue;
    
    // 查找对应的服务器配置
    const server = props.mcpServers.find(s => s.id === serverId);
    
    // 只处理已启用的服务器
    if (server && server.enabled) {
      for (const tool of tools) {
        const toolId = `${serverId}_${tool.name}`;
        
        // 默认启用所有工具
        if (!enabledTools.value.has(toolId)) {
          enabledTools.value.add(toolId);
        }
      }
    }
  }
}, { deep: true });

// 在挂载时，初始化所有工具为已启用
for (const [serverId, tools] of Object.entries(props.serverTools)) {
  // 跳过空工具列表
  if (!tools || tools.length === 0) continue;
  
  for (const tool of tools) {
    enabledTools.value.add(`${serverId}_${tool.name}`);
  }
}
</script>

<style scoped>
.tools-container {
  position: relative;
  z-index: 101;
}

.tools-dropdown {
  position: absolute;
  bottom: 130%;
  right: 0;
  min-width: 320px;
  z-index: 1001;
}
</style> 