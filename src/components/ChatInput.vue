<template>
  <div class="chat-input">
    <input 
      v-model="message" 
      @keyup.enter="sendMessage" 
      placeholder="输入您的消息..." 
      :disabled="isLoading || !hasApiKey"
    />
    <button @click="sendMessage" :disabled="isLoading || !message.trim() || !hasApiKey">
      发送
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, defineProps, defineEmits } from 'vue';

const props = defineProps({
  isLoading: {
    type: Boolean,
    default: false
  },
  hasApiKey: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['send']);
const message = ref('');

const sendMessage = () => {
  if (!message.value.trim() || props.isLoading || !props.hasApiKey) return;
  
  emit('send', message.value);
  message.value = '';
}
</script> 