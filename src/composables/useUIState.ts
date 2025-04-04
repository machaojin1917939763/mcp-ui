import { ref } from 'vue';

export function useUIState() {
  const showSettings = ref(false);
  const showHistoryPanel = ref(false);
  
  // 切换设置面板
  function toggleSettings() {
    showSettings.value = !showSettings.value;
    if (showSettings.value) {
      showHistoryPanel.value = false;
    }
  }
  
  // 切换历史对话面板
  function toggleHistoryPanel() {
    showHistoryPanel.value = !showHistoryPanel.value;
    if (showHistoryPanel.value) {
      showSettings.value = false;
    }
  }
  
  // 关闭所有面板
  function closeAllPanels() {
    showHistoryPanel.value = false;
    showSettings.value = false;
  }
  
  // 点击外部关闭下拉框的处理函数
  function setupClickOutsideListener(showModelDropdown: any) {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.model-selector-dropdown')) {
        console.log('点击外部区域，关闭下拉列表');
        showModelDropdown.value = false;
      }
    };
    
    console.log('设置点击外部关闭下拉框的监听器');
    document.addEventListener('click', handleClickOutside);
    
    // 返回清理函数，用于在组件卸载时移除事件监听器
    return () => {
      console.log('移除点击外部关闭下拉框的监听器');
      document.removeEventListener('click', handleClickOutside);
    };
  }
  
  return {
    showSettings,
    showHistoryPanel,
    toggleSettings,
    toggleHistoryPanel,
    closeAllPanels,
    setupClickOutsideListener
  };
} 