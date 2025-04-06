<template>
  <div class="styles-container">
    <!-- 这个组件只用于样式引入，不渲染任何实际内容 -->
  </div>
</template>

<style>
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
  transition: opacity 0.3s ease;
}

.overlay.settings-overlay {
  z-index: 1000;
}

.history-overlay, .settings-overlay {
  opacity: 1;
}

/* 设置面板布局 */
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
  transform: translateX(100%);
  transition: transform 0.3s ease-out;
  visibility: hidden;
}

.settings-panel[style*="display: flex"] {
  transform: translateX(0);
  visibility: visible;
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
  padding-bottom: 80px; /* 为底部按钮留出更多空间 */
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

/* 底部控件禁用状态 */
.bottom-controls .disabled {
  opacity: 0.5;
  pointer-events: none;
}

.bottom-button[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 代码块样式 */
.code-block-wrapper {
  margin: 16px 0;
  border-radius: 6px;
  overflow: hidden;
  background-color: #f6f8fa;
  border: 1px solid #e1e4e8;
}

.code-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: #f1f2f3;
  border-bottom: 1px solid #e1e4e8;
}

.code-language {
  font-size: 0.85em;
  color: #24292e;
  font-weight: 600;
}

.copy-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 0.85em;
  color: #24292e;
  background-color: #fff;
  border: 1px solid #e1e4e8;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.copy-btn:hover {
  background-color: #f0f0f0;
}

.copy-btn svg {
  width: 14px;
  height: 14px;
}

.message-content pre {
  background-color: #f6f8fa;
  padding: 16px;
  overflow: auto;
  margin: 0;
}

.message-content code {
  font-family: SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace;
  font-size: 0.9em;
  padding: 0.2em 0.4em;
  margin: 0;
  background-color: rgba(175, 184, 193, 0.2);
  border-radius: 3px;
}

.message-content .code-block-wrapper code {
  background-color: transparent;
  padding: 0;
  margin: 0;
  border-radius: 0;
}

.message-content pre code {
  /* background-color: transparent; */
  padding: 0;
  margin: 0;
  border-radius: 0;
}

.message-content h1, 
.message-content h2, 
.message-content h3, 
.message-content h4, 
.message-content h5, 
.message-content h6 {
  margin-top: 16px;
  margin-bottom: 8px;
  font-weight: 600;
  line-height: 1.25;
  color: #24292f;
}

.message-content h1 { font-size: 2em; }
.message-content h2 { font-size: 1.5em; }
.message-content h3 { font-size: 1.25em; }
.message-content h4 { font-size: 1em; }
.message-content h5 { font-size: 0.875em; }
.message-content h6 { font-size: 0.85em; }

.message-content blockquote {
  padding: 0 1em;
  color: #57606a;
  border-left: 0.25em solid #d0d7de;
  margin: 0 0 16px 0;
}

.message-content table {
  display: block;
  width: 100%;
  overflow-x: auto;
  margin: 16px 0;
  border-collapse: collapse;
}

.message-content table th,
.message-content table td {
  padding: 6px 13px;
  border: 1px solid #d0d7de;
}

.message-content table tr {
  background-color: #ffffff;
  border-top: 1px solid #d0d7de;
}

.message-content table tr:nth-child(2n) {
  background-color: #f6f8fa;
}

.message-content ul,
.message-content ol {
  padding-left: 2em;
  margin-top: 0;
  margin-bottom: 16px;
}

.message-content img {
  max-width: 100%;
  box-sizing: content-box;
}

.message-content a {
  color: #0969da;
  text-decoration: none;
}

.message-content a:hover {
  text-decoration: underline;
}

/* 表单元素样式改进 */
.settings-group {
  margin-bottom: 24px;
}

.settings-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #24292e;
}

.styled-select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background-color: #fff;
  color: #24292e;
  font-size: 14px;
  transition: border-color 0.2s ease;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2324292e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
  cursor: pointer;
}

.styled-select:hover {
  border-color: #0969da;
}

.styled-select:focus {
  border-color: #0969da;
  box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.3);
  outline: none;
}

.styled-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background-color: #fff;
  color: #24292e;
  font-size: 14px;
  transition: all 0.2s ease;
}

.styled-input:hover {
  border-color: #0969da;
}

.styled-input:focus {
  border-color: #0969da;
  box-shadow: 0 0 0 3px rgba(9, 105, 218, 0.3);
  outline: none;
}

.model-description {
  margin-top: 8px;
  padding: 10px;
  background-color: #f6f8fa;
  border-radius: 6px;
  font-size: 14px;
  color: #57606a;
  line-height: 1.5;
}
</style> 