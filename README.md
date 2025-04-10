# MCP 聊天应用

基于 Model Context Protocol 的智能聊天应用，支持Web和桌面环境。

## 项目介绍

MCP聊天应用是一个基于Vue.js构建的现代化聊天界面，支持通过Model Context Protocol (MCP)与各种服务和工具进行交互。MCP是Anthropic推出的开放协议标准，允许AI模型直接调用诸如数据库、文件系统、浏览器自动化、第三方mcp服务等。

本应用同时支持Web端和桌面端（基于Electron），并且集成了OpenAI和Anthropic两种主流大模型服务。

## 应用界面展示

![应用界面概览](./image/截屏2025-04-09%2000.38.13.png)
![聊天功能展示](./image/截屏2025-04-09%2000.38.31.png)
![模型配置界面](./image/截屏2025-04-09%2000.38.53.png)
![环境配置示例](./image/截屏2025-04-09%2000.38.13.png)
![应用启动界面](./image/截屏2025-04-09%2000.39.07.png)
![构建后的应用](./image/截屏2025-04-09%2000.39.24.png)
![模型设置界面](./image/截屏2025-04-09%2000.39.38.png)


## 核心功能特点

- **简洁现代**的聊天界面设计
- **MCP协议支持**：与外部工具和服务进行无缝交互
- **多模型支持**：兼容OpenAI和Anthropic两种API格式
- **自定义配置**：可配置API密钥、基础URL和模型选项
- **可扩展架构**：支持添加自定义工具和服务
- **桌面应用**：提供跨平台（Windows/Mac/Linux）桌面体验
- **浏览器自动化**：支持AI控制浏览器执行任务
- **本地服务**：集成MCP后端服务提供强大功能

## 系统要求

- **Node.js**: v16.0.0+
- **npm**: v8.0.0+
- **现代浏览器**：Chrome, Firefox, Safari, Edge最新版本
- **操作系统**：Windows 10+, macOS 10.15+, Ubuntu 20.04+（桌面版）

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境变量（非必要）

复制`.env.example`文件到`.env`，并填入必要的API密钥和配置：

```bash
cp .env.example .env
```

编辑`.env`文件设置以下内容：
```
VITE_API_KEY=your_api_key_here
VITE_MODEL_PROVIDER=openai  # 或 anthropic
MCP_SERVER_PORT=3001        # MCP服务器端口
```

### 启动应用

#### Web应用开发模式

```bash
# 启动前端开发服务器
npm run dev

# 在另一个终端启动MCP后端服务
npm run mcp:server
```

#### 桌面应用开发模式

```bash
# 启动Electron应用
npm run electron:dev

# 在另一个终端启动MCP后端服务
npm run mcp:server
```

### 运行应用

#### Web应用

```bash
npm run dev

# 在另一个终端启动MCP后端服务
npm run mcp:server
```

#### 桌面应用

```bash
# 启动Electron应用
npm run electron:dev

# 在另一个终端启动MCP后端服务
npm run mcp:server
```

### 构建应用

#### Web应用构建

```bash
npm run build
```

#### 桌面应用构建

```bash
# 构建所有平台版本
npm run electron:build

# 构建特定平台版本
npm run electron:buildwin  # Windows
npm run electron:buildmac  # macOS
npm run electron:buildlinux  # Linux
```

## 详细使用说明

### 配置模型设置

1. 打开应用后，点击右上角的⚙️设置图标
2. 在设置面板中配置：
   - **模型提供商**：选择OpenAI或Anthropic
   - **API密钥**：输入对应服务的API密钥
   - **API基础URL**：可选，如使用自定义API端点或代理服务
   - **模型**：选择要使用的具体模型
   - **自定义模型**：添加和管理自定义模型配置

### 使用聊天功能

- 在底部输入框中输入问题或命令
- 点击发送按钮或按回车键发送消息
- 使用工具功能获取实时信息或执行任务（如浏览网页、查询数据等）
- 支持Markdown格式和代码高亮显示

### MCP工具使用

本应用集成了以下MCP工具：

- **浏览器自动化**：AI可控制浏览器访问网页、提取信息
- **天气查询**：获取实时天气信息
- **新闻搜索**：检索最新新闻内容
- **文件操作**：读取和写入文件（桌面版）

通过聊天界面直接请求AI使用这些工具，无需额外操作。

## 项目架构

### 目录结构

- `src/` - 前端源代码
  - `components/` - Vue组件
  - `services/` - API服务
  - `composables/` - Vue组合式函数
  - `utils/` - 工具函数
  - `styles/` - CSS样式文件
  - `assets/` - 静态资源
- `electron/` - Electron桌面应用代码
- `config/` - 应用配置文件
- `mcp_server.js` - MCP后端服务
- `public/` - 静态资源目录

### 关键技术栈

- **前端**：Vue 3, TypeScript, Vite
- **API集成**：OpenAI API, Anthropic API
- **MCP协议**：@modelcontextprotocol/sdk
- **桌面应用**：Electron
- **服务端**：Express, Node.js

## 开发指南

### 添加新的MCP工具

1. 在`mcp_server.js`中的工具定义部分添加新工具描述
2. 实现对应的工具处理逻辑
3. 重启MCP服务器以应用更改

示例：
```javascript
// 添加新工具定义
const tools = [
  {
    name: "my_new_tool",
    description: "这是一个新工具的描述",
    parameters: {
      type: "object",
      properties: {
        param1: { type: "string", description: "参数1的描述" }
      },
      required: ["param1"]
    }
  },
  // 其他工具...
];

// 实现工具处理逻辑
app.post('/mcp/tools/call', async (req, res) => {
  // ...
  if (toolName === "my_new_tool") {
    const result = await handleMyNewTool(arguments);
    return res.json({ result });
  }
  // ...
});
```

### 自定义UI组件

修改或创建`src/components/`目录下的Vue组件以定制UI。

## 部署指南

### Web应用部署

1. 运行`npm run build`生成生产环境代码
2. 将`dist`目录部署到任何静态Web服务器
3. 确保MCP后端服务正确配置并运行

### 桌面应用分发

1. 运行对应平台的构建命令
2. 在`dist_electron`目录找到构建好的安装包
3. 分发安装包给用户

## 故障排除

- **API连接问题**：检查API密钥和网络连接
- **MCP服务失败**：查看服务器日志，确保相关依赖已安装
- **UI显示异常**：清除浏览器缓存，检查控制台错误
- **工具调用失败**：检查MCP后端日志，确保工具正确配置

## 相关资源

- [Model Context Protocol 文档](https://mcplab.cc/zh/docs/getstarted/quickstart/client)
- [OpenAI API 文档](https://platform.openai.com/docs/api-reference)
- [Anthropic Claude API](https://www.anthropic.com/api)
- [Vue.js 文档](https://vuejs.org/)
- [Electron 文档](https://www.electronjs.org/docs)

## 贡献指南

欢迎提交Pull Request或Issue来改进这个项目。贡献前请先查看现有Issues和项目路线图。

## 许可证

MIT
