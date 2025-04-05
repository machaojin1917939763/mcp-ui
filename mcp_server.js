import express from 'express';
import cors from 'cors';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// 加载环境变量
dotenv.config();

const app = express();
const port = process.env.MCP_SERVER_PORT || 3001;

// 存储配置的文件路径
const CONFIG_DIR = process.env.MCP_CONFIG_DIR || './config';
const CLIENT_CONFIG_PATH = path.join(CONFIG_DIR, 'clients.json');

// 确保配置目录存在
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  console.log(`已创建配置目录: ${CONFIG_DIR}`);
}

// 启用CORS和JSON解析
app.use(cors());
app.use(bodyParser.json());

// 存储多个MCP客户端
const mcpClients = {};
const clientConfigs = {};
const defaultClientName = "playwright";

// 从文件加载客户端配置
function loadClientConfigs() {
  try {
    if (fs.existsSync(CLIENT_CONFIG_PATH)) {
      const data = fs.readFileSync(CLIENT_CONFIG_PATH, 'utf8');
      const loadedConfigs = JSON.parse(data);
      
      // 清空现有配置，加载保存的配置
      Object.keys(clientConfigs).forEach(key => delete clientConfigs[key]);
      
      // 加载配置
      Object.entries(loadedConfigs).forEach(([name, config]) => {
        clientConfigs[name] = config;
      });
      
      console.log(`已从 ${CLIENT_CONFIG_PATH} 加载 ${Object.keys(loadedConfigs).length} 个客户端配置`);
      return true;
    }
  } catch (error) {
    console.error(`加载客户端配置失败:`, error);
  }
  return false;
}

// 保存客户端配置到文件
function saveClientConfigs() {
  try {
    fs.writeFileSync(CLIENT_CONFIG_PATH, JSON.stringify(clientConfigs, null, 2), 'utf8');
    console.log(`已保存 ${Object.keys(clientConfigs).length} 个客户端配置到 ${CLIENT_CONFIG_PATH}`);
    return true;
  } catch (error) {
    console.error(`保存客户端配置失败:`, error);
    return false;
  }
}

// 设置默认客户端配置
if (!loadClientConfigs() || !clientConfigs[defaultClientName]) {
  clientConfigs[defaultClientName] = {
    command: "npx",
    args: ['-y', "@automatalabs/mcp-server-playwright"],
    description: "默认Playwright客户端"
  };
  saveClientConfigs();
}

// 初始化指定的MCP客户端
async function initMCPClient(clientName) {
  if (mcpClients[clientName]) {
    return mcpClients[clientName];
  }

  try {
    const config = clientConfigs[clientName];
    if (!config) {
      throw new Error(`未找到客户端配置: ${clientName}`);
    }

    console.log(`初始化客户端 ${clientName}，命令: ${config.command} ${config.args.join(' ')}`);

    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args
    });

    const client = new Client(
      {
        name: `mcp-chat-${clientName}-client`,
        version: "1.0.0"
      },
      {
        capabilities: {
          prompts: {},
          resources: {},
          tools: {}
        }
      }
    );

    try {
      await client.connect(transport);
      console.log(`已连接到MCP服务: ${clientName}`);
      
      // 确保client对象有disconnect方法
      if (typeof client.disconnect !== 'function') {
        console.warn(`警告: 客户端 ${clientName} 没有disconnect方法`);
        // 添加一个虚拟的disconnect方法以防止调用错误
        client.disconnect = async () => {
          console.log(`虚拟断开客户端 ${clientName} 的连接`);
          return true;
        };
      }
      
      // 列出可用工具
      try {
        const tools = await client.listTools();
        console.log(`客户端 ${clientName} 可用工具列表:`, tools);
      } catch (toolError) {
        console.error(`获取客户端 ${clientName} 的工具列表失败:`, toolError);
        // 继续处理，不终止流程
      }
      
      mcpClients[clientName] = client;
      return client;
    } catch (connectError) {
      console.error(`连接到客户端 ${clientName} 失败:`, connectError);
      throw new Error(`连接到客户端失败: ${connectError.message}`);
    }
  } catch (error) {
    console.error(`MCP客户端 ${clientName} 初始化错误:`, error);
    throw error;
  }
}

// 关闭并清理指定的客户端
async function closeClient(clientName) {
  const client = mcpClients[clientName];
  if (client) {
    try {
      // 检查client是否有disconnect方法
      if (typeof client.disconnect === 'function') {
        await client.disconnect();
        console.log(`MCP客户端 ${clientName} 已断开连接`);
      } else {
        console.log(`MCP客户端 ${clientName} 没有disconnect方法，直接删除引用`);
      }
      delete mcpClients[clientName];
      return true;
    } catch (error) {
      console.error(`断开MCP客户端 ${clientName} 连接失败:`, error);
      // 即使失败也删除引用，防止客户端残留
      delete mcpClients[clientName];
      throw error;
    }
  }
  return false;
}

// API路由
// 获取所有已配置的客户端列表
app.get('/mcp/clients', (req, res) => {
  const clients = Object.keys(clientConfigs).map(name => ({
    name,
    ...clientConfigs[name],
    isConnected: !!mcpClients[name]
  }));
  res.json({ clients });
});

// 获取特定客户端的详细信息
app.get('/mcp/clients/:clientName', (req, res) => {
  const { clientName } = req.params;
  
  if (!clientConfigs[clientName]) {
    return res.status(404).json({ error: `未找到客户端: ${clientName}` });
  }
  
  const clientInfo = {
    name: clientName,
    ...clientConfigs[clientName],
    isConnected: !!mcpClients[clientName]
  };
  
  res.json(clientInfo);
});

// 添加/更新客户端配置
app.post('/mcp/clients', async (req, res) => {
  try {
    const { name, command, args, description, autoConnect } = req.body;
    
    if (!name || !command || !args) {
      return res.status(400).json({ error: "缺少必要参数，需要提供 name, command 和 args" });
    }
    
    console.log(`添加/更新客户端 ${name}，autoConnect=${autoConnect}`);
    
    // 如果客户端已连接，需要先断开连接
    if (mcpClients[name]) {
      try {
        await closeClient(name);
      } catch (error) {
        console.error(`断开已有客户端 ${name} 连接失败:`, error);
        // 继续处理，不终止流程
      }
    }
    
    // 添加/更新配置
    clientConfigs[name] = {
      command,
      args,
      description: description || `MCP客户端: ${name}`,
      lastUpdated: new Date().toISOString()
    };
    
    // 保存配置到文件
    saveClientConfigs();
    
    // 如果设置了自动连接
    if (autoConnect) {
      try {
        await initMCPClient(name);
        res.json({ 
          success: true, 
          message: `客户端 ${name} 配置已保存并成功连接`, 
          client: { 
            name, 
            ...clientConfigs[name], 
            isConnected: true 
          } 
        });
      } catch (connectError) {
        res.status(207).json({ 
          success: true, 
          configSaved: true, 
          connectionError: connectError.message,
          message: `客户端 ${name} 配置已保存，但连接失败: ${connectError.message}`,
          client: { 
            name, 
            ...clientConfigs[name], 
            isConnected: false 
          } 
        });
      }
    } else {
      res.json({ 
        success: true, 
        message: `客户端 ${name} 配置已保存`, 
        client: { 
          name, 
          ...clientConfigs[name], 
          isConnected: false 
        } 
      });
    }
  } catch (error) {
    console.error("添加/更新客户端配置失败:", error);
    res.status(500).json({ error: "添加/更新客户端配置失败", message: error.message });
  }
});

// 删除客户端配置
app.delete('/mcp/clients/:clientName', async (req, res) => {
  try {
    const { clientName } = req.params;
    
    if (!clientConfigs[clientName]) {
      return res.status(404).json({ error: `未找到客户端: ${clientName}` });
    }
    
    // 如果客户端已连接，先断开连接
    if (mcpClients[clientName]) {
      await closeClient(clientName);
    }
    
    // 删除配置
    delete clientConfigs[clientName];
    
    // 保存配置到文件
    saveClientConfigs();
    
    res.json({ success: true, message: `客户端 ${clientName} 已删除` });
  } catch (error) {
    console.error("删除客户端配置失败:", error);
    res.status(500).json({ error: "删除客户端配置失败", message: error.message });
  }
});

// 导出所有客户端配置
app.get('/mcp/clients/export', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=mcp_clients_config.json');
  res.json(clientConfigs);
});

// 导入客户端配置
app.post('/mcp/clients/import', async (req, res) => {
  try {
    const { configs, overwrite = false } = req.body;
    
    if (!configs || typeof configs !== 'object') {
      return res.status(400).json({ error: "无效的配置数据" });
    }
    
    // 断开所有已连接的客户端
    if (overwrite) {
      for (const clientName of Object.keys(mcpClients)) {
        await closeClient(clientName);
      }
    }
    
    const results = {
      imported: [],
      skipped: [],
      failed: []
    };
    
    // 导入配置
    for (const [name, config] of Object.entries(configs)) {
      try {
        // 检查必要字段
        if (!config.command || !config.args) {
          results.failed.push({ name, reason: "配置缺少必要字段" });
          continue;
        }
        
        // 检查是否存在且未设置覆盖
        if (clientConfigs[name] && !overwrite) {
          results.skipped.push(name);
          continue;
        }
        
        // 如果已连接，先断开
        if (mcpClients[name]) {
          await closeClient(name);
        }
        
        // 导入配置
        clientConfigs[name] = {
          ...config,
          lastUpdated: new Date().toISOString()
        };
        
        results.imported.push(name);
      } catch (err) {
        results.failed.push({ name, reason: err.message });
      }
    }
    
    // 保存配置到文件
    saveClientConfigs();
    
    res.json({ 
      success: true, 
      message: `导入了 ${results.imported.length} 个客户端配置，跳过 ${results.skipped.length} 个，失败 ${results.failed.length} 个`, 
      results 
    });
  } catch (error) {
    console.error("导入客户端配置失败:", error);
    res.status(500).json({ error: "导入客户端配置失败", message: error.message });
  }
});

// 连接特定客户端
app.post('/mcp/clients/:clientName/connect', async (req, res) => {
  try {
    const { clientName } = req.params;
    
    if (!clientConfigs[clientName]) {
      return res.status(404).json({ error: `未找到客户端: ${clientName}` });
    }
    
    console.log(`尝试连接客户端: ${clientName}`);
    
    // 如果客户端已连接，先断开再重连
    if (mcpClients[clientName]) {
      try {
        await closeClient(clientName);
      } catch (error) {
        console.error(`断开已有客户端 ${clientName} 连接失败:`, error);
        // 继续处理，不终止流程
      }
    }
    
    // 连接客户端
    const client = await initMCPClient(clientName);
    
    // 确保客户端成功初始化
    if (!client) {
      throw new Error(`初始化客户端 ${clientName} 失败`);
    }
    
    res.json({ 
      success: true, 
      message: `客户端 ${clientName} 已连接`, 
      client: { 
        name: clientName, 
        ...clientConfigs[clientName], 
        isConnected: true 
      } 
    });
  } catch (error) {
    console.error(`连接客户端 ${req.params.clientName} 失败:`, error);
    res.status(500).json({ error: `连接客户端失败`, message: error.message });
  }
});

// 断开特定客户端
app.post('/mcp/clients/:clientName/disconnect', async (req, res) => {
  try {
    const { clientName } = req.params;
    
    if (!clientConfigs[clientName]) {
      return res.status(404).json({ error: `未找到客户端: ${clientName}` });
    }
    
    // 断开客户端
    const wasConnected = await closeClient(clientName);
    
    if (wasConnected) {
      res.json({ 
        success: true, 
        message: `客户端 ${clientName} 已断开连接`,
        client: { 
          name: clientName, 
          ...clientConfigs[clientName], 
          isConnected: false 
        }
      });
    } else {
      res.json({ 
        success: true, 
        message: `客户端 ${clientName} 本来就未连接`,
        client: { 
          name: clientName, 
          ...clientConfigs[clientName], 
          isConnected: false 
        }
      });
    }
  } catch (error) {
    console.error(`断开客户端 ${req.params.clientName} 连接失败:`, error);
    res.status(500).json({ error: `断开客户端连接失败`, message: error.message });
  }
});

// 获取指定客户端的可用工具列表
app.get('/mcp/clients/:clientName/tools', async (req, res) => {
  try {
    const { clientName } = req.params;
    
    if (!clientConfigs[clientName]) {
      return res.status(404).json({ error: `未找到客户端: ${clientName}` });
    }
    
    let client = mcpClients[clientName];
    if (!client) {
      client = await initMCPClient(clientName);
    }
    
    const tools = await client.listTools();
    res.json({ 
      client: clientName, 
      tools 
    });
  } catch (error) {
    console.error(`获取客户端 ${req.params.clientName} 工具列表失败:`, error);
    res.status(500).json({ error: "获取工具列表失败", message: error.message });
  }
});

// 调用指定客户端的工具
app.post('/mcp/clients/:clientName/tools/call', async (req, res) => {
  try {
    const { clientName } = req.params;
    const { name, arguments: args } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: "缺少工具名称" });
    }
    
    if (!clientConfigs[clientName]) {
      return res.status(404).json({ error: `未找到客户端: ${clientName}` });
    }
    
    let client = mcpClients[clientName];
    if (!client) {
      client = await initMCPClient(clientName);
    }
    
    const result = await client.callTool({
      name,
      arguments: args || {}
    });
    
    res.json({ 
      client: clientName, 
      tool: name,
      result 
    });
  } catch (error) {
    console.log(req.body);
    console.error(`调用客户端 ${req.params.clientName} 工具失败:`, error);
    res.status(500).json({ error: "工具调用失败", message: error.message });
  }
});

// 获取指定客户端的可用资源列表
app.get('/mcp/clients/:clientName/resources', async (req, res) => {
  try {
    const { clientName } = req.params;
    
    if (!clientConfigs[clientName]) {
      return res.status(404).json({ error: `未找到客户端: ${clientName}` });
    }
    
    let client = mcpClients[clientName];
    if (!client) {
      client = await initMCPClient(clientName);
    }
    
    const resources = await client.listResources();
    res.json({ 
      client: clientName, 
      resources 
    });
  } catch (error) {
    console.error(`获取客户端 ${req.params.clientName} 资源列表失败:`, error);
    res.status(500).json({ error: "获取资源列表失败", message: error.message });
  }
});

// 获取指定客户端的可用提示列表
app.get('/mcp/clients/:clientName/prompts', async (req, res) => {
  try {
    const { clientName } = req.params;
    
    if (!clientConfigs[clientName]) {
      return res.status(404).json({ error: `未找到客户端: ${clientName}` });
    }
    
    let client = mcpClients[clientName];
    if (!client) {
      client = await initMCPClient(clientName);
    }
    
    const prompts = await client.listPrompts();
    res.json({ 
      client: clientName, 
      prompts 
    });
  } catch (error) {
    console.error(`获取客户端 ${req.params.clientName} 提示列表失败:`, error);
    res.status(500).json({ error: "获取提示列表失败", message: error.message });
  }
});

// ===== 兼容旧接口 =====
// 这些API保持向后兼容性，默认使用defaultClientName客户端

// 获取可用工具列表
app.get('/mcp/tools', async (req, res) => {
  try {
    const clientName = req.query.client || defaultClientName;
    
    if (!clientConfigs[clientName]) {
      return res.status(404).json({ error: `未找到客户端: ${clientName}` });
    }
    
    let client = mcpClients[clientName];
    if (!client) {
      client = await initMCPClient(clientName);
    }
    
    const tools = await client.listTools();
    res.json({ client: clientName, tools });
  } catch (error) {
    console.error("获取工具列表失败:", error);
    res.status(500).json({ error: "获取工具列表失败", message: error.message });
  }
});

// 调用工具
app.post('/mcp/tools/call', async (req, res) => {
  try {
    const { name, arguments: args, clientName = defaultClientName } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: "缺少工具名称" });
    }
    
    if (!clientConfigs[clientName]) {
      return res.status(404).json({ error: `未找到客户端: ${clientName}` });
    }
    
    let client = mcpClients[clientName];
    if (!client) {
      client = await initMCPClient(clientName);
    }
    
    const result = await client.callTool({
      name,
      arguments: args || {}
    });
    
    res.json({ client: clientName, result });
  } catch (error) {
    console.error("工具调用失败:", error);
    res.status(500).json({ error: "工具调用失败", message: error.message });
  }
});

// 获取可用资源列表
app.get('/mcp/resources', async (req, res) => {
  try {
    const clientName = req.query.client || defaultClientName;
    
    if (!clientConfigs[clientName]) {
      return res.status(404).json({ error: `未找到客户端: ${clientName}` });
    }
    
    let client = mcpClients[clientName];
    if (!client) {
      client = await initMCPClient(clientName);
    }
    
    const resources = await client.listResources();
    res.json({ client: clientName, resources });
  } catch (error) {
    console.error("获取资源列表失败:", error);
    res.status(500).json({ error: "获取资源列表失败", message: error.message });
  }
});

// 获取可用提示列表
app.get('/mcp/prompts', async (req, res) => {
  try {
    const clientName = req.query.client || defaultClientName;
    
    if (!clientConfigs[clientName]) {
      return res.status(404).json({ error: `未找到客户端: ${clientName}` });
    }
    
    let client = mcpClients[clientName];
    if (!client) {
      client = await initMCPClient(clientName);
    }
    
    const prompts = await client.listPrompts();
    res.json({ client: clientName, prompts });
  } catch (error) {
    console.error("获取提示列表失败:", error);
    res.status(500).json({ error: "获取提示列表失败", message: error.message });
  }
});

// 应用启动时初始化默认MCP客户端
initMCPClient(defaultClientName).then(() => {
  console.log("默认MCP客户端初始化成功");
}).catch(error => {
  console.error("默认MCP客户端初始化失败:", error);
});

// 关闭应用时断开所有连接
process.on('SIGINT', async () => {
  for (const [clientName, client] of Object.entries(mcpClients)) {
    try {
      await client.disconnect();
      console.log(`MCP客户端 ${clientName} 已断开连接`);
    } catch (error) {
      console.error(`断开MCP客户端 ${clientName} 连接失败:`, error);
    }
  }
  process.exit(0);
});

// 启动服务器
app.listen(port, () => {
  console.log(`MCP后端服务运行在 http://localhost:${port}`);
  console.log(`客户端配置保存位置: ${CLIENT_CONFIG_PATH}`);
}); 