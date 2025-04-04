<template>
  <div class="notification" v-if="show" :class="{ 'show': show }">
    {{ message }}
  </div>
</template>

<script setup lang="ts">
import { defineProps } from 'vue';

defineProps({
  show: {
    type: Boolean,
    default: false
  },
  message: {
    type: String,
    default: ''
  }
});
</script>

<style scoped>
.notification {
  position: fixed;
  top: -50px;
  left: 50%;
  transform: translateX(-50%);
  background-color: #333;
  color: white;
  padding: 10px 20px;
  border-radius: 4px;
  z-index: 9999;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: top 0.3s ease;
  font-size: 14px;
}

.notification.show {
  top: 20px;
}
</style> 