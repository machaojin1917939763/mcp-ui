# MCP 聊天应用

基于 Model Context Protocol 的智能聊天网页应用。

## 介绍

这是一个使用 Vue.js 构建的网页聊天应用，支持通过 Model Context Protocol (MCP) 与各种服务和工具进行交互。MCP 是 Anthropic 推出的开放协议标准，允许 AI 模型直接调用诸如数据库、文件系统、第三方平台等服务。

本应用支持 OpenAI 和 Anthropic 两种格式的 LLM 模型集成。

## 功能特点

- 简洁现代的聊天界面
- 支持 MCP 协议与外部工具交互
- 支持 OpenAI 和 Anthropic 两种模型格式
- 可配置自定义 API 密钥、基础URL和模型
- 可扩展的工具集成架构
- 集成模拟服务端提供示例功能

## 系统要求

- Node.js 16+
- 现代浏览器

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 文件到 `.env`，并填入你的 API 密钥:

```bash
cp .env.example .env
# 然后编辑 .env 文件设置:
# VITE_API_KEY=your_openai_api_key_here
# VITE_MODEL_PROVIDER=openai # 或 anthropic
```

### 3. 启动开发服务器

```bash
# 启动前端
npm run dev

# 在另一个终端启动模拟服务端
npm run server
```

### 4. 访问应用

浏览器打开 [http://localhost:5173](http://localhost:5173)

## 使用说明

### 配置API设置

1. 打开应用后，点击右上角的⚙️设置图标
2. 在设置面板中配置以下内容：
   - **API密钥**：输入您的OpenAI API密钥
   - **API基础URL**：可选，如果使用自定义API端点或代理服务
   - **模型**：选择要使用的OpenAI模型

这些设置将保存在浏览器的本地存储中，下次访问时自动加载。

### 使用聊天功能

- 在输入框中输入问题或命令
- 点击发送按钮或按回车键发送
- 可以尝试询问天气信息或新闻等，利用工具功能

### 清除聊天记录

点击右上角的🗑️图标可以清除当前聊天记录。

## 项目结构

- `src/` - 前端源代码
  - `components/` - Vue 组件
  - `utils/` - 工具类和辅助函数
  - `services/` - API服务类
  - `styles/` - CSS样式文件
- `server.js` - 模拟 MCP 服务端

## 扩展开发

### 添加新工具

在 `server.js` 中的 `tools` 数组添加新工具定义，并实现对应的路由处理函数。

### 定制聊天界面

修改 `src/components/ChatComponent.vue` 文件自定义聊天界面。

### 切换模型提供商

在 `.env` 文件中设置 `VITE_MODEL_PROVIDER` 为 `openai` 或 `anthropic` 来切换模型提供商。

## 相关资源

- [Model Context Protocol 文档](https://mcplab.cc/zh/docs/getstarted/quickstart/client)
- [OpenAI API 文档](https://platform.openai.com/docs/api-reference)
- [Anthropic Claude API](https://www.anthropic.com/api)
- [Vue.js 文档](https://vuejs.org/)

## 许可证

MIT
