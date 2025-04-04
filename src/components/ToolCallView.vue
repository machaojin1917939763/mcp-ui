<!-- 工具调用视图组件 -->
<template>
  <div class="tool-call-container">
    <!-- 工具调用信息 -->
    <div class="tool-call-header" @click="toggleExpanded">
      <div class="tool-call-status" :class="{ 'success': success, 'error': !success }">
        <svg v-if="success" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <div class="tool-call-info">
        <span class="tool-name">{{ formatToolName(toolName) }}</span>
        <span class="tool-status">{{ success ? '调用成功' : '调用失败' }}</span>
      </div>
      <div class="tool-call-toggle">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="{ 'expanded': expanded }">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
    </div>
    
    <!-- 展开的详细信息 -->
    <div class="tool-call-details" v-if="expanded">
      <!-- 调用参数 -->
      <div class="tool-call-section">
        <div class="section-title">输入参数</div>
        <pre class="code-block">{{ formatJSON(params) }}</pre>
      </div>
      
      <!-- 调用结果 -->
      <div class="tool-call-section">
        <div class="section-title">调用结果</div>
        <pre class="code-block" :class="{ 'error-result': !success }">{{ formatResult }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface ToolCallProps {
  toolName: string;
  params: any;
  result?: any;
  error?: string;
  success: boolean;
}

const props = defineProps<ToolCallProps>();

// 控制详情面板的展开状态
const expanded = ref(false);

// 切换展开状态
const toggleExpanded = () => {
  expanded.value = !expanded.value;
};

// 美化工具名称显示
const formatToolName = (name: string) => {
  // 如果工具名包含下划线，将其分割并格式化
  if (name.includes('_')) {
    const [serverId, toolName] = name.split('_', 2);
    return `${serverId} > ${toolName}`;
  }
  return name;
};

// 格式化JSON显示
const formatJSON = (data: any) => {
  try {
    return JSON.stringify(data, null, 2);
  } catch (e) {
    return String(data);
  }
};

// 计算结果显示
const formatResult = computed(() => {
  if (!props.success) {
    return props.error || '调用失败';
  }
  
  try {
    return formatJSON(props.result);
  } catch (e) {
    return String(props.result);
  }
});
</script>

<style scoped>
.tool-call-container {
  margin: 8px 0;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  background-color: #fafafa;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.tool-call-header {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  background-color: #f5f5f5;
  cursor: pointer;
  transition: background-color 0.2s;
}

.tool-call-header:hover {
  background-color: #eee;
}

.tool-call-status {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
}

.tool-call-status.success {
  color: #10a37f;
}

.tool-call-status.error {
  color: #e53935;
}

.tool-call-info {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.tool-name {
  font-weight: 500;
  font-size: 0.9rem;
  color: #333;
}

.tool-status {
  font-size: 0.8rem;
  color: #666;
}

.tool-call-toggle svg {
  transition: transform 0.3s;
}

.tool-call-toggle svg.expanded {
  transform: rotate(180deg);
}

.tool-call-details {
  padding: 12px;
  border-top: 1px solid #e0e0e0;
  background-color: white;
}

.tool-call-section {
  margin-bottom: 12px;
}

.tool-call-section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 0.85rem;
  font-weight: 500;
  color: #666;
  margin-bottom: 4px;
}

.code-block {
  background-color: #f5f5f5;
  border-radius: 4px;
  padding: 8px;
  font-family: monospace;
  font-size: 0.85rem;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  color: #333;
  max-height: 200px;
  overflow-y: auto;
}

.error-result {
  color: #e53935;
  background-color: #ffebee;
}
</style> 