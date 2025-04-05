<template>
  <transition name="notification-slide">
    <div class="notification-container" v-if="show">
      <div class="notification" :class="[`notification-${type}`, show ? 'show' : '']">
        <div class="notification-icon">
          <!-- 成功图标 -->
          <svg v-if="type === 'success'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          
          <!-- 错误图标 -->
          <svg v-else-if="type === 'error'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          
          <!-- 警告图标 -->
          <svg v-else-if="type === 'warning'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          
          <!-- 信息图标 -->
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        </div>
        
        <div class="notification-content">
          {{ message }}
        </div>
        
        <button v-if="dismissible" class="notification-close" @click="close">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        
        <div 
          v-if="duration > 0" 
          class="notification-progress" 
          :style="{ animationDuration: `${duration}ms` }"
        ></div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, ref, watch, onMounted } from 'vue';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  message: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'info',
    validator: (value: string) => ['info', 'success', 'warning', 'error'].includes(value)
  },
  duration: {
    type: Number,
    default: 3000 // 默认3秒后自动消失
  },
  dismissible: {
    type: Boolean,
    default: true // 默认可手动关闭
  }
});

const emit = defineEmits(['close']);

// 处理手动关闭
function close() {
  emit('close');
}

// 自动关闭计时器
let timer: number | null = null;

// 监视显示状态，设置自动关闭
watch(() => props.show, (newValue) => {
  if (newValue && props.duration > 0) {
    // 清除之前的计时器
    if (timer) {
      clearTimeout(timer);
    }
    
    // 设置新的自动关闭计时器
    timer = window.setTimeout(() => {
      close();
    }, props.duration);
  }
});

// 组件卸载时清除计时器
onMounted(() => {
  if (props.show && props.duration > 0) {
    timer = window.setTimeout(() => {
      close();
    }, props.duration);
  }
  
  return () => {
    if (timer) {
      clearTimeout(timer);
    }
  };
});
</script>

<style scoped>
.notification-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  pointer-events: none;
  z-index: 9999;
  padding-top: 24px;
}

.notification {
  margin: 0;
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 16px;
  padding: 18px 24px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15), 0 1px 8px rgba(0, 0, 0, 0.1);
  max-width: 460px;
  width: auto;
  pointer-events: auto;
  position: relative;
  overflow: hidden;
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  transform: translateY(0);
  opacity: 1;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.notification-icon {
  margin-right: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.notification-content {
  flex: 1;
  font-size: 16px;
  line-height: 1.5;
  color: #333;
  font-weight: 500;
}

.notification-close {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  margin-left: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  transition: color 0.2s;
}

.notification-close:hover {
  color: #666;
}

/* 进度条 */
.notification-progress {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 4px;
  background: rgba(255, 255, 255, 0.3);
  width: 100%;
  animation: notification-progress-animation linear forwards;
  animation-duration: inherit;
}

@keyframes notification-progress-animation {
  from { width: 100%; }
  to { width: 0%; }
}

/* 类型样式 */
.notification-success {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
}

.notification-success .notification-icon,
.notification-success .notification-content,
.notification-success .notification-close {
  color: white;
}

.notification-error {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
}

.notification-error .notification-icon,
.notification-error .notification-content,
.notification-error .notification-close {
  color: white;
}

.notification-warning {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: white;
}

.notification-warning .notification-icon,
.notification-warning .notification-content,
.notification-warning .notification-close {
  color: white;
}

.notification-info {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
}

.notification-info .notification-icon,
.notification-info .notification-content,
.notification-info .notification-close {
  color: white;
}

/* 动画效果 */
.notification-slide-enter-active,
.notification-slide-leave-active {
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
}

.notification-slide-enter-from {
  transform: translateY(-20px);
  opacity: 0;
}

.notification-slide-leave-to {
  transform: translateY(-20px);
  opacity: 0;
}
</style> 