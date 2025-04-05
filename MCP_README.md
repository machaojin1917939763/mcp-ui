# MCP后端服务使用说明

## 概述

MCP（Model Context Protocol）后端服务是一个Node.js应用，用于在服务器端运行MCP客户端，与MCP服务器进行交互。由于浏览器环境不支持Node.js特有的功能（如`process`对象），我们需要在后端运行MCP客户端。

## 功能

- 提供REST API接口，支持前端调用MCP功能
- 支持STDIO类型的MCP服务器连接
- 支持浏览器自动化功能
- 提供工具、资源和提示的列表和调用接口

## 安装和设置

1. 确保已安装Node.js v16+
2. 安装依赖包：
   ```bash
   npm install
   ```
3. 配置环境变量：复制`.env.example`文件为`.env`文件，并根据需要修改相关配置

## 运行服务

启动MCP后端服务：

```bash
npm run mcp:server
```

默认情况下，服务将在`http://localhost:3001`运行。你可以通过`.env`文件中的`MCP_SERVER_PORT`变量修改端口。

## API接口

### 获取工具列表

```
GET /mcp/tools
```

返回MCP服务器提供的所有可用工具列表。

### 调用工具

```
POST /mcp/tools/call
```

请求体:
```json
{
  "name": "工具名称",
  "arguments": {
    "参数1": "值1",
    "参数2": "值2"
  }
}
```

### 浏览器导航

```
POST /mcp/browser/navigate
```

请求体:
```json
{
  "url": "https://example.com"
}
```

### 获取资源列表

```
GET /mcp/resources
```

### 获取提示列表

```
GET /mcp/prompts
```

## 前端集成

前端可以通过MCPService类与后端服务进行交互。这个服务类封装了与MCP后端的API调用，使前端能够方便地使用MCP功能。

### MCPToolsPanel组件

我们提供了一个Vue组件`MCPToolsPanel.vue`，用于展示和调用MCP工具。将其添加到你的应用中即可使用MCP功能。

## 调试和疑难解决

- 如果遇到连接问题，检查MCP服务器是否正在运行
- 查看控制台日志获取详细错误信息
- 确认环境变量配置正确
- 使用Postman等工具测试API接口

## 支持的MCP服务器

当前支持的MCP服务器包括：

- @automatalabs/mcp-server-playwright - 用于浏览器自动化
- 其他符合MCP协议的服务器 