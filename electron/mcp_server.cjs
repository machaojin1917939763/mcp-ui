const express = require('express');
const cors = require('cors');
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// 加载环境变量
dotenv.config();

// 日志工具函数
const logLevels = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// 默认日志级别，可以从环境变量设置
const LOG_LEVEL = process.env.MCP_LOG_LEVEL || 'DEBUG';
const CURRENT_LOG_LEVEL = logLevels[LOG_LEVEL] || logLevels.DEBUG;

// 添加时间戳的日志函数
function logWithTimestamp(level, message, ...args) {
  if (logLevels[level] >= CURRENT_LOG_LEVEL) {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}][${level}] ${message}`;
    
    if (level === 'ERROR') {
      console.error(formattedMessage, ...args);
    } else if (level === 'WARN') {
      console.warn(formattedMessage, ...args);
    } else {
      console.log(formattedMessage, ...args);
    }
  }
  // 如果是在Electron子进程中运行，发送消息给主进程
  if (process.send) {
    const timestamp = new Date().toISOString();
    process.send({ level, message, timestamp });
  }
}

// 日志工具对象
const logger = {
  debug: (message, ...args) => logWithTimestamp('DEBUG', message, ...args),
  info: (message, ...args) => logWithTimestamp('INFO', message, ...args),
  warn: (message, ...args) => logWithTimestamp('WARN', message, ...args),
  error: (message, ...args) => logWithTimestamp('ERROR', message, ...args)
};

const app = express();
const port = process.env.MCP_SERVER_PORT || 3001;

// 存储配置的文件路径
const CONFIG_DIR = process.env.MCP_CONFIG_DIR || './config';
const CLIENT_CONFIG_PATH = path.join(CONFIG_DIR, 'clients.json');
const TOOL_MAPPING_PATH = path.join(CONFIG_DIR, 'tool_mappings.json');

// 确保配置目录存在
if (!fs.existsSync(CONFIG_DIR)) {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    logger.info(`已创建配置目录: ${CONFIG_DIR}`);
  } catch (error) {
    logger.error(`创建配置目录失败: ${error.message}`);
  }
}

// 初始化配置文件
function initConfigFiles() {
  // 初始化客户端配置
  if (!fs.existsSync(CLIENT_CONFIG_PATH)) {
    try {
      fs.writeFileSync(CLIENT_CONFIG_PATH, JSON.stringify({}, null, 2));
      logger.info(`已创建客户端配置文件: ${CLIENT_CONFIG_PATH}`);
    } catch (error) {
      logger.error(`创建客户端配置文件失败: ${error.message}`);
    }
  }

  // 初始化工具映射配置
  if (!fs.existsSync(TOOL_MAPPING_PATH)) {
    try {
      fs.writeFileSync(TOOL_MAPPING_PATH, JSON.stringify({}, null, 2));
      logger.info(`已创建工具映射配置文件: ${TOOL_MAPPING_PATH}`);
    } catch (error) {
      logger.error(`创建工具映射配置文件失败: ${error.message}`);
    }
  }
}

// 初始化配置文件
initConfigFiles();

// 错误处理中间件 - 添加在CORS和bodyParser之前
app.use((req, res, next) => {
  // 捕获未被路由处理器捕获的异步错误
  const originalEnd = res.end;
  res.end = function(...args) {
    if (res.writableEnded) return originalEnd.apply(res, args);
    return originalEnd.apply(res, args);
  };
  
  // 设置请求超时
  req.setTimeout(60000, () => {
    logger.error(`请求超时: ${req.method} ${req.url}`);
    if (!res.headersSent) {
      res.status(408).json({
        error: "请求超时",
        message: "请求处理时间过长，已自动终止"
      });
    }
  });
  
  // 记录请求开始
  logger.debug(`接收请求: ${req.method} ${req.url}`);
  
  const startTime = Date.now();
  
  // 在请求完成时记录耗时
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.debug(`请求完成: ${req.method} ${req.url} - 状态: ${res.statusCode} - 耗时: ${duration}ms`);
  });
  
  next();
});

// 启用CORS和JSON解析
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// 全局错误重试机制
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 毫秒

// 添加重试逻辑的包装函数
async function withRetry(operation, name, maxRetries = MAX_RETRIES, delay = RETRY_DELAY) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const retryDelay = delay * attempt; // 指数退避
        logger.warn(`${name} 失败 (尝试 ${attempt}/${maxRetries}): ${error.message}. 将在 ${retryDelay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        logger.error(`${name} 在 ${maxRetries} 次尝试后失败: ${error.message}`);
      }
    }
  }
  
  throw lastError;
}

// 存储多个MCP客户端
const mcpClients = {};
const clientConfigs = {};
// 添加工具名到客户端的映射
const toolToClientMap = {};

// 从文件加载客户端配置
function loadClientConfigs() {
  try {
    if (fs.existsSync(CLIENT_CONFIG_PATH)) {
      const data = fs.readFileSync(CLIENT_CONFIG_PATH, 'utf8');

      // 检查文件是否为空
      if (!data || data.trim() === '') {
        logger.info(`配置文件 ${CLIENT_CONFIG_PATH} 为空，跳过加载`);
        return false;
      }

      const loadedConfigs = JSON.parse(data);

      // 清空现有配置，加载保存的配置
      Object.keys(clientConfigs).forEach(key => delete clientConfigs[key]);

      // 加载配置
      Object.entries(loadedConfigs).forEach(([name, config]) => {
        clientConfigs[name] = config;
        logger.debug(`已加载客户端配置: ${name}`);
      });

      logger.info(`已从 ${CLIENT_CONFIG_PATH} 加载 ${Object.keys(loadedConfigs).length} 个客户端配置`); 
      

      
      return true;
    } else {
      logger.info(`配置文件 ${CLIENT_CONFIG_PATH} 不存在，将创建新的配置文件`);
      // 创建空的配置文件
      fs.writeFileSync(CLIENT_CONFIG_PATH, JSON.stringify({}, null, 2), 'utf8');
    }
  } catch (error) {
    logger.error(`加载客户端配置失败:`, error);
  }
  return false;
}

// 保存客户端配置到文件
function saveClientConfigs() {
  try {
    fs.writeFileSync(CLIENT_CONFIG_PATH, JSON.stringify(clientConfigs, null, 2), 'utf8');
    logger.info(`已保存 ${Object.keys(clientConfigs).length} 个客户端配置到 ${CLIENT_CONFIG_PATH}`);        
    return true;
  } catch (error) {
    logger.error(`保存客户端配置失败:`, error);
    return false;
  }
}

// 保存工具映射到文件
function saveToolMappings() {
  try {
    fs.writeFileSync(TOOL_MAPPING_PATH, JSON.stringify(toolToClientMap, null, 2), 'utf8');
    logger.info(`已保存 ${Object.keys(toolToClientMap).length} 个工具映射到 ${TOOL_MAPPING_PATH}`);
    return true;
  } catch (error) {
    logger.error(`保存工具映射失败:`, error);
    return false;
  }
}

// 从文件加载工具映射
function loadToolMappings() {
  try {
    if (fs.existsSync(TOOL_MAPPING_PATH)) {
      const data = fs.readFileSync(TOOL_MAPPING_PATH, 'utf8');

      // 检查文件是否为空
      if (!data || data.trim() === '') {
        logger.info(`工具映射文件 ${TOOL_MAPPING_PATH} 为空，跳过加载`);
        return false;
      }

      const loadedMappings = JSON.parse(data);

      // 清空现有映射，加载保存的映射
      Object.keys(toolToClientMap).forEach(key => delete toolToClientMap[key]);

      // 加载映射
      Object.entries(loadedMappings).forEach(([toolName, clientName]) => {
        toolToClientMap[toolName] = clientName;
        logger.debug(`已加载工具映射: ${toolName} -> ${clientName}`);
      });

      logger.info(`已从 ${TOOL_MAPPING_PATH} 加载 ${Object.keys(loadedMappings).length} 个工具映射`);       
      return true;
    } else {
      logger.info(`工具映射文件 ${TOOL_MAPPING_PATH} 不存在，将创建新的映射文件`);
      // 创建空的映射文件
      fs.writeFileSync(TOOL_MAPPING_PATH, JSON.stringify({}, null, 2), 'utf8');
    }
  } catch (error) {
    logger.error(`加载工具映射失败:`, error);
  }
  return false;
}

// 加载配置
loadClientConfigs();
loadToolMappings();

// 关闭客户端连接
async function closeClient(clientName) {
  try {
    const client = mcpClients[clientName];
    if (!client) {
      logger.warn(`关闭客户端连接失败: 客户端 ${clientName} 未连接`);
      return false;
    }

    logger.debug(`正在关闭客户端 ${clientName} 连接...`);
    await client.disconnect();
    delete mcpClients[clientName];
    logger.info(`已关闭客户端 ${clientName} 连接`);
    return true;
  } catch (error) {
    logger.error(`关闭客户端 ${clientName} 连接失败:`, error);
    // 即使出错，也尝试从mcpClients中移除
    delete mcpClients[clientName];
    return false;
  }
}

// 初始化MCP客户端
async function initMCPClient(clientName) {
  const config = clientConfigs[clientName];
  if (!config) {
    logger.error(`初始化客户端 ${clientName} 失败: 未找到配置`);
    throw new Error(`未找到客户端配置: ${clientName}`);
  }

  // 创建传输
  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    env: config.env,
    // 添加windowsHide选项，在Windows中隐藏命令窗口
    options: {
      windowsHide: true,
      // 如果需要完全隐藏，可以添加detached和stdio配置
      detached: process.platform === 'win32',
      stdio: 'pipe'
    }
  });

  // 创建客户端
  const client = new Client({
    name: `mcp-chat-${clientName}-client`,
    version: "1.0.0"
  });

  try {
    logger.debug(`正在连接到客户端 ${clientName}...`);
    // 连接到客户端
    await client.connect(transport);

    // 连接成功
    logger.info(`已连接到客户端 ${clientName}`);
    mcpClients[clientName] = client;
    return client;
  } catch (connectError) {
    logger.error(`连接到客户端 ${clientName} 失败:`, connectError);
    throw new Error(`连接到客户端失败: ${connectError.message}`);
  }
}

// API路由
// 获取所有客户端
app.get('/api/clients', (req, res) => {
  try {
    res.json({
      clients: Object.keys(clientConfigs).map(id => ({
        id,
        ...clientConfigs[id],
        active: Boolean(mcpClients[id])
      }))
    });
  } catch (error) {
    logger.error(`获取客户端列表失败: ${error.message}`);
    res.status(500).json(`获取客户端列表失败: ${error.message}`);
  }
});

// 获取客户端工具列表
app.get('/api/clients/:id/tools', async (req, res) => {
  try {
    const { id } = req.params;
    const client = mcpClients[id];
    
    if (!client) {
      return res.status(404).json({ error: `客户端 ${id} 不存在或未激活` });
    }
    
    try {
      const tools = await client.listTools();
      res.json({ tools });
    } catch (error) {
      logger.error(`获取工具列表失败 ${id}: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  } catch (error) {
    logger.error(`处理获取工具列表请求失败: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 基本的健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    clients: Object.keys(mcpClients),
    toolMappings: Object.keys(toolToClientMap).length
  });
});

// 添加更多的API路由
// 获取服务器状态
app.get('/api/status', (req, res) => {
  try {
    const status = {
      server: {
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      },
      clients: {
        configured: Object.keys(clientConfigs).length,
        active: Object.keys(mcpClients).length,
        list: Object.keys(mcpClients)
      },
      tools: {
        mapped: Object.keys(toolToClientMap).length,
        list: Object.keys(toolToClientMap)
      }
    };
    
    res.json(status);
  } catch (error) {
    logger.error(`获取服务器状态失败: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 初始化工具到客户端的映射
async function initializeToolMappings() {
  try {
    logger.info(`开始初始化工具到客户端的映射...`);

    // 获取所有已配置客户端的名称
    const clientNames = Object.keys(clientConfigs);

    if (clientNames.length === 0) {
      logger.info(`没有找到已配置的客户端，工具映射初始化跳过`);
      return;
    }

    logger.info(`找到 ${clientNames.length} 个已配置的客户端，开始连接...`);

    // 尝试连接每个客户端并获取工具列表
    for (const clientName of clientNames) {
      try {
        if (!mcpClients[clientName]) {
          await initMCPClient(clientName);
        }
      } catch (error) {
        logger.error(`初始化客户端 ${clientName} 失败:`, error);
      }
    }
    // 保存工具映射
    saveToolMappings();
    logger.info(`工具映射初始化完成，共映射 ${Object.keys(toolToClientMap).length} 个工具`);
  } catch (error) {
    logger.error(`初始化工具映射失败:`, error);
  }
}

// ------------------------ 兼容旧API路径 --------------------------

// 获取所有客户端(兼容旧路径)
app.get('/mcp/clients', (req, res) => {
  try {
    res.json({
      clients: Object.keys(clientConfigs).map(name => ({
        name,
        ...clientConfigs[name],
        isConnected: !!mcpClients[name]
      }))
    });
  } catch (error) {
    logger.error(`获取客户端列表失败:`, error);
    res.status(500).json({ error: "获取客户端列表失败", message: error.message });
  }
});

// 添加/更新客户端配置(兼容旧路径)
app.post('/mcp/clients', async (req, res) => {
  try {
    const { name, command, args, description, autoConnect } = req.body;

    logger.debug(`API请求: 添加/更新客户端 ${name}`);

    if (!name || !command || !args) {
      logger.warn(`添加/更新客户端缺少必要参数`);
      return res.status(400).json({ error: "缺少必要参数，需要提供 name, command 和 args" });
    }

    logger.info(`添加/更新客户端 ${name}，命令: ${command}，自动连接=${autoConnect}`);

    // 如果客户端已连接，需要先断开连接
    if (mcpClients[name]) {
      logger.debug(`客户端 ${name} 已连接，需要先断开连接`);
      try {
        await closeClient(name);
      } catch (error) {
        logger.error(`断开已有客户端 ${name} 连接失败:`, error);
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
      logger.debug(`尝试自动连接客户端 ${name}`);
      try {
        await initMCPClient(name);
        logger.info(`客户端 ${name} 已配置并成功连接`);
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
        logger.warn(`客户端 ${name} 配置已保存，但连接失败: ${connectError.message}`);
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
      logger.info(`客户端 ${name} 配置已保存（未自动连接）`);
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
    logger.error(`添加/更新客户端配置失败:`, error);
    res.status(500).json({ error: "添加/更新客户端配置失败", message: error.message });
  }
});

// 删除客户端配置(兼容旧路径)
app.delete('/mcp/clients/:clientName', async (req, res) => {
  try {
    const { clientName } = req.params;
    logger.debug(`API请求: 删除客户端 ${clientName}`);

    if (!clientConfigs[clientName]) {
      logger.warn(`删除失败: 未找到客户端 ${clientName}`);
      return res.status(404).json({ error: `未找到客户端: ${clientName}` });
    }

    // 如果客户端已连接，先断开连接
    if (mcpClients[clientName]) {
      logger.debug(`客户端 ${clientName} 已连接，需要先断开连接`);
      await closeClient(clientName);
    }

    // 删除配置
    delete clientConfigs[clientName];
    logger.info(`客户端 ${clientName} 配置已删除`);

    // 保存配置到文件
    saveClientConfigs();

    res.json({ success: true, message: `客户端 ${clientName} 已删除` });
  } catch (error) {
    logger.error(`删除客户端配置失败:`, error);
    res.status(500).json({ error: "删除客户端配置失败", message: error.message });
  }
});

// 调用工具(兼容旧路径)
app.post('/mcp/tools/call', async (req, res) => {
  try {
    const { name, arguments: args, clientName } = req.body;

    if (!name) {
      logger.warn(`调用工具失败: 缺少工具名称`);
      return res.status(400).json({ error: "缺少工具名称" });
    }
    // 获取客户端名称，优先使用提供的clientName，如果没有则查找映射
    let targetClientName = clientName;
    if (!targetClientName) {
      targetClientName = toolToClientMap[name];
      if (!targetClientName) {
        logger.warn(`调用工具失败: 未找到工具 ${name} 对应的客户端`);
        return res.status(404).json({ error: `未找到工具 ${name} 对应的客户端，请确保工具名称正确或指定clientName` });
      }
      logger.info(`未提供clientName，根据工具 ${name} 自动选择客户端 ${targetClientName}`);
    }
    logger.debug(`API请求(兼容): 调用工具: ${name}，使用客户端: ${targetClientName}`);
    const client = await initMCPClient(targetClientName);
    if (!client) {
      logger.warn(`调用工具失败: 客户端 ${targetClientName} 未连接`);
      return res.status(500).json({ error: `客户端 ${targetClientName} 未连接` });
    }
    try {
      // 使用统一的格式调用工具
      logger.info(`开始调用工具 ${name}`);
      const result = await client.callTool({
        name: name,
        arguments: args
      });
      logger.info(`成功调用客户端 ${targetClientName} 的工具 ${name}`);
      res.json({ result });
    } catch (error) {
      logger.error(`调用工具失败:`, error);
      res.status(500).json({ error: "工具调用失败", message: error.message });      
    }
    } catch (error) {
    logger.error(`调用工具失败:`, error);
    logger.debug(`调用工具失败的请求体:`, req.body);
    res.status(500).json({ error: "工具调用失败", message: error.message });
  }
});

// 获取客户端工具列表(兼容旧路径)
app.get('/mcp/clients/:clientName/tools', async (req, res) => {
  try {
    const { clientName } = req.params;
    logger.debug(`API请求: 获取客户端 ${clientName} 的工具列表`);

    if (!clientConfigs[clientName]) {
      logger.warn(`获取工具列表失败: 未找到客户端配置 ${clientName}`);
      return res.status(404).json({ error: `未找到客户端: ${clientName}` });
    }

    let client = mcpClients[clientName];
    if (!client) {
      logger.info(`客户端 ${clientName} 未连接，尝试连接...`);
      client = await initMCPClient(clientName);
    }

    logger.debug(`正在获取客户端 ${clientName} 的工具列表...`);
    const tools = await client.listTools();
    logger.info(`成功获取客户端 ${clientName} 的工具列表，共 ${tools.tools.length} 个工具`);

    // 更新工具到客户端的映射
    tools.tools.forEach(tool => {
      toolToClientMap[tool.name] = clientName;
      logger.debug(`已将工具 ${tool.name} 映射到客户端 ${clientName}`);
    });
    res.json({
      client: clientName,
      tools
    });
  } catch (error) {
    logger.error(`获取客户端 ${req.params.clientName} 工具列表失败:`, error);
    res.status(500).json({ error: "获取工具列表失败", message: error.message });
  }
});

// 获取工具映射
app.get('/mcp/tools/mapping', (req, res) => {
  try {
    logger.debug(`API请求: 获取工具到客户端的映射关系`);

    const toolsCount = Object.keys(toolToClientMap).length;
    logger.info(`返回 ${toolsCount} 个工具映射信息`);

    // 构建更详细的映射信息
    const mappingInfo = Object.entries(toolToClientMap).map(([toolName, clientName]) => {
      return {
        tool: toolName,
        client: clientName,
        clientConnected: !!mcpClients[clientName]
      };
    });

    res.json({
      totalTools: toolsCount,
      mapping: mappingInfo
    });
  } catch (error) {
    logger.error(`获取工具映射信息失败:`, error);
    res.status(500).json({ error: "获取工具映射信息失败", message: error.message });
  }
});

// 连接特定客户端
app.post('/mcp/clients/:clientName/connect', async (req, res) => {
  try {
    const { clientName } = req.params;
    logger.debug(`API请求: 连接客户端 ${clientName}`);
    
    if (!clientConfigs[clientName]) {
      logger.warn(`连接失败: 未找到客户端配置 ${clientName}`);
      return res.status(404).json({ error: `未找到客户端: ${clientName}` });
    }
    
    logger.info(`尝试连接客户端: ${clientName}`);
    
    // 连接客户端
    const client = await initMCPClient(clientName);
    
    // 确保客户端成功初始化
    if (!client) {
      logger.error(`客户端 ${clientName} 初始化失败`);
      throw new Error(`初始化客户端 ${clientName} 失败`);
    }
    
    logger.info(`客户端 ${clientName} 连接成功`);
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
    logger.error(`连接客户端 ${req.params.clientName} 失败:`, error);
    res.status(500).json({ error: `连接客户端失败`, message: error.message });
  }
});

// 断开特定客户端(兼容旧路径)
app.post('/mcp/clients/:clientName/disconnect', async (req, res) => {
  try {
    const { clientName } = req.params;
    logger.debug(`API请求: 断开客户端 ${clientName} 连接`);
    
    if (!clientConfigs[clientName]) {
      logger.warn(`断开连接失败: 未找到客户端配置 ${clientName}`);
      return res.status(404).json({ error: `未找到客户端: ${clientName}` });
    }
    
    // 断开客户端
    const wasConnected = await closeClient(clientName);
    
    if (wasConnected) {
      logger.info(`客户端 ${clientName} 已断开连接`);
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
      logger.info(`客户端 ${clientName} 本来就未连接`);
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
    logger.error(`断开客户端 ${req.params.clientName} 连接失败:`, error);
    res.status(500).json({ error: `断开客户端连接失败`, message: error.message });
  }
});

// 导出客户端配置(兼容旧路径)
app.get('/mcp/clients/export', (req, res) => {
  logger.debug(`API请求: 导出所有客户端配置`);
  logger.info(`正在导出 ${Object.keys(clientConfigs).length} 个客户端配置`);
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=mcp_clients_config.json');
  res.json(clientConfigs);
});

// 导入客户端配置(兼容旧路径)
app.post('/mcp/clients/import', async (req, res) => {
  try {
    const { configs, overwrite = false } = req.body;
    logger.debug(`API请求: 导入客户端配置，覆盖模式=${overwrite}`);
    
    if (!configs || typeof configs !== 'object') {
      logger.warn(`导入失败: 无效的配置数据`);
      return res.status(400).json({ error: "无效的配置数据" });
    }
    
    const configCount = Object.keys(configs).length;
    logger.info(`收到 ${configCount} 个客户端配置待导入`);
    
    // 断开所有已连接的客户端
    if (overwrite) {
      logger.info(`覆盖模式开启，断开所有已连接的客户端`);
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
          logger.warn(`跳过导入客户端 ${name}: 配置缺少必要字段`);
          results.failed.push({ name, reason: "配置缺少必要字段" });
          continue;
        }
        
        // 检查是否存在且未设置覆盖
        if (clientConfigs[name] && !overwrite) {
          logger.info(`跳过导入客户端 ${name}: 已存在且未设置覆盖模式`);
          results.skipped.push(name);
          continue;
        }
        
        // 如果已连接，先断开
        if (mcpClients[name]) {
          logger.debug(`客户端 ${name} 已连接，需要先断开连接`);
          await closeClient(name);
        }
        
        // 导入配置
        clientConfigs[name] = {
          ...config,
          lastUpdated: new Date().toISOString()
        };
        
        logger.info(`已导入客户端 ${name} 配置`);
        results.imported.push(name);
      } catch (err) {
        logger.error(`导入客户端 ${name} 失败:`, err);
        results.failed.push({ name, reason: err.message });
      }
    }
    
    // 保存配置到文件
    saveClientConfigs();
    
    logger.info(`导入完成：${results.imported.length} 个成功，${results.skipped.length} 个跳过，${results.failed.length} 个失败`);
    res.json({ 
      success: true, 
      message: `导入了 ${results.imported.length} 个客户端配置，跳过 ${results.skipped.length} 个，失败 ${results.failed.length} 个`, 
      results 
    });
  } catch (error) {
    logger.error(`导入客户端配置失败:`, error);
    res.status(500).json({ error: "导入客户端配置失败", message: error.message });
  }
});


// 启动服务器
try {
  app.listen(port, () => {
    // 在启动时尝试初始化工具映射
    initializeToolMappings().catch(error => {
      logger.error(`工具映射初始化过程中出错:`, error);
    });
    logger.info(`MCP服务器运行在端口 ${port}`);
    // 通知主进程服务器已启动
    if (process.send) {
      process.send({ type: 'SERVER_STARTED', port });
    }
  });
} catch (error) {
  logger.error(`启动MCP服务器失败:`, error);
}
// 导出app实例供测试使用
module.exports = app;