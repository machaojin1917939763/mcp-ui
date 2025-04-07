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

// 日志工具函数
const logLevels = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// 默认日志级别，可以从环境变量设置
const LOG_LEVEL = process.env.MCP_LOG_LEVEL || 'INFO';
const CURRENT_LOG_LEVEL = logLevels[LOG_LEVEL] || logLevels.INFO;

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
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  logger.info(`已创建配置目录: ${CONFIG_DIR}`);
}

// 启用CORS和JSON解析
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

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
        logger.debug(`已加载客户端配置: ${name}`, config);
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

// 清理所有已连接的客户端
async function cleanupClients() {
  const clientCount = Object.keys(mcpClients).length;
  if (clientCount > 0) {
    logger.info(`开始清理 ${clientCount} 个已连接的客户端...`);
  }
  
  for (const clientName of Object.keys(mcpClients)) {
    try {
      await closeClient(clientName);
      logger.info(`已清理客户端: ${clientName}`);
    } catch (error) {
      logger.error(`清理客户端 ${clientName} 失败:`, error);
    }
  }
}

// 初始化工具到客户端的映射
async function initializeToolMappings() {
  try {
    logger.info(`开始初始化工具到客户端的映射...`);
    
    // 先尝试从文件加载映射
    const loadedFromFile = loadToolMappings();
    
    if (loadedFromFile && Object.keys(toolToClientMap).length > 0) {
      logger.info(`已从文件加载工具映射，跳过连接初始化`);
      return;
    }
    
    // 获取所有已配置客户端的名称
    const clientNames = Object.keys(clientConfigs);
    
    if (clientNames.length === 0) {
      logger.info(`没有找到已配置的客户端，工具映射初始化跳过`);
      return;
    }
    
    let successCount = 0;
    let failCount = 0;
    let toolCount = 0;
    
    // 遍历每个客户端，尝试连接并获取工具
    for (const clientName of clientNames) {
      try {
        logger.debug(`正在初始化客户端 ${clientName} 的工具映射...`);
        
        // 初始化客户端
        const client = await initMCPClient(clientName);
        
        // 获取工具列表
        const tools = await client.listTools();
        logger.debug(`客户端 ${clientName} 可用工具列表:`, tools);
        // 更新工具映射
        tools.tools.forEach(tool => {
          toolToClientMap[tool.name] = clientName;
          toolCount++;
        });
        
        logger.info(`已为客户端 ${clientName} 映射 ${tools.length} 个工具`);
        successCount++;
      } catch (error) {
        logger.error(`初始化客户端 ${clientName} 的工具映射失败:`, error);
        failCount++;
      }
    }
    
    logger.info(`工具映射初始化完成: ${successCount} 个客户端成功, ${failCount} 个失败, 共映射 ${toolCount} 个工具`);
    
    // 保存工具映射到文件
    saveToolMappings();
    
    // 打印工具映射结果
    logger.debug(`工具到客户端映射结果:`, toolToClientMap);
  } catch (error) {
    logger.error(`初始化工具映射失败:`, error);
  }
}

// 加载客户端配置前先清理
cleanupClients().then(() => {
  logger.info('开始加载客户端配置...');
  if (loadClientConfigs()) {
    // 配置加载成功后初始化工具映射
    initializeToolMappings().catch(error => {
      logger.error('初始化工具映射时出错:', error);
    });
  }
}).catch(error => {
  logger.error('清理客户端时出错:', error);
  loadClientConfigs(); // 即使清理失败也继续加载配置
  // 配置加载后初始化工具映射
  initializeToolMappings().catch(error => {
    logger.error('初始化工具映射时出错:', error);
  });
});

// 初始化指定的MCP客户端
async function initMCPClient(clientName) {
  if (mcpClients[clientName]) {
    logger.debug(`客户端 ${clientName} 已初始化，重用现有实例`);
    return mcpClients[clientName];
  }

  try {
    const config = clientConfigs[clientName];
    if (!config) {
      throw new Error(`未找到客户端配置: ${clientName}`);
    }

    logger.info(`初始化客户端 ${clientName}，命令: ${config.command} ${config.args.join(' ')}`);

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
      logger.debug(`连接到客户端 ${clientName} 中...`);
      await client.connect(transport);
      logger.info(`已连接到MCP服务: ${clientName}`);
      // 列出可用工具
      try {
        const tools = await client.listTools();
        logger.debug(`客户端 ${clientName} 可用工具列表:`, tools);
        
        // 更新工具到客户端的映射
        tools.tools.forEach(tool => {
          toolToClientMap[tool.name] = clientName;
          logger.debug(`已将工具 ${tool.name} 映射到客户端 ${clientName}`);
        });
      } catch (toolError) {
        logger.error(`获取客户端 ${clientName} 的工具列表失败:`, toolError);
        // 继续处理，不终止流程
      }
      
      mcpClients[clientName] = client;
      return client;
    } catch (connectError) {
      logger.error(`连接到客户端 ${clientName} 失败:`, connectError);
      throw new Error(`连接到客户端失败: ${connectError.message}`);
    }
  } catch (error) {
    logger.error(`MCP客户端 ${clientName} 初始化错误:`, error);
    throw error;
  }
}

// 关闭并清理指定的客户端
async function closeClient(clientName) {
  const client = mcpClients[clientName];
  if (client) {
    logger.debug(`开始关闭客户端 ${clientName}...`);
    try {
      // 检查client是否有disconnect方法
      if (typeof client.disconnect === 'function') {
        await client.disconnect();
        logger.info(`MCP客户端 ${clientName} 已断开连接`);
      } else {
        logger.warn(`MCP客户端 ${clientName} 没有disconnect方法，直接删除引用`);
      }
      
      // 清理工具映射
      for (const [toolName, mappedClientName] of Object.entries(toolToClientMap)) {
        if (mappedClientName === clientName) {
          delete toolToClientMap[toolName];
          logger.debug(`已移除工具 ${toolName} 与客户端 ${clientName} 的映射`);
        }
      }
      
      delete mcpClients[clientName];
      return true;
    } catch (error) {
      logger.error(`断开MCP客户端 ${clientName} 连接失败:`, error);
      // 即使失败也删除引用，防止客户端残留
      delete mcpClients[clientName];
      throw error;
    }
  } else {
    logger.debug(`客户端 ${clientName} 未连接，无需断开`);
  }
  return false;
}

// API路由
// 获取所有已配置的客户端列表
app.get('/mcp/clients', (req, res) => {
  logger.debug(`API请求: 获取所有客户端列表`);
  const clients = Object.keys(clientConfigs).map(name => ({
    name,
    ...clientConfigs[name],
    isConnected: !!mcpClients[name]
  }));
  logger.debug(`返回 ${clients.length} 个客户端信息`);
  res.json({ clients });
});

// 根据服务器ID获取相关的客户端列表
app.get('/mcp/clients/by-server/:serverId', (req, res) => {
  try {
    const { serverId } = req.params;
    logger.debug(`API请求: 获取服务器 ${serverId} 的相关客户端列表`);
    
    // 先查找服务器配置
    if (!clientConfigs[serverId]) {
      logger.warn(`未找到服务器: ${serverId}`);
      return res.status(404).json({ error: `未找到服务器: ${serverId}` });
    }
    
    const serverConfig = clientConfigs[serverId];
    
    // 查找相同命令和参数的客户端配置
    const relatedClients = Object.entries(clientConfigs)
      .filter(([name, config]) => 
        config.command === serverConfig.command && 
        JSON.stringify(config.args) === JSON.stringify(serverConfig.args)
      )
      .map(([name, config]) => ({
        name,
        ...config,
        isConnected: !!mcpClients[name]
      }));
    
    logger.debug(`找到 ${relatedClients.length} 个相关客户端`);
    res.json({ 
      serverId, 
      clients: relatedClients 
    });
  } catch (error) {
    logger.error(`获取服务器 ${req.params.serverId} 的客户端列表失败:`, error);
    res.status(500).json({ error: "获取客户端列表失败", message: error.message });
  }
});

// 获取特定客户端的详细信息
app.get('/mcp/clients/:clientName', (req, res) => {
  const { clientName } = req.params;
  logger.debug(`API请求: 获取客户端 ${clientName} 的详细信息`);
  
  if (!clientConfigs[clientName]) {
    logger.warn(`未找到客户端: ${clientName}`);
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

// 删除客户端配置
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

// 导出所有客户端配置
app.get('/mcp/clients/export', (req, res) => {
  logger.debug(`API请求: 导出所有客户端配置`);
  logger.info(`正在导出 ${Object.keys(clientConfigs).length} 个客户端配置`);
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=mcp_clients_config.json');
  res.json(clientConfigs);
});

// 导入客户端配置
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
    
    // 如果客户端已连接，先断开再重连
    if (mcpClients[clientName]) {
      logger.debug(`客户端 ${clientName} 已连接，将断开后重新连接`);
      try {
        await closeClient(clientName);
      } catch (error) {
        logger.error(`断开已有客户端 ${clientName} 连接失败:`, error);
        // 继续处理，不终止流程
      }
    }
    
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

// 断开特定客户端
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

// 获取指定客户端的可用工具列表
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
    logger.info(`成功获取客户端 ${clientName} 的工具列表，共 ${tools.length} 个工具`);
    
    // 更新工具到客户端的映射
    tools.tools.forEach(tool => {
      toolToClientMap[tool.name] = clientName;
      logger.debug(`已将工具 ${tool.name} 映射到客户端 ${clientName}`);
    });
    
    // 保存更新后的工具映射
    saveToolMappings();
    
    res.json({ 
      client: clientName, 
      tools 
    });
  } catch (error) {
    logger.error(`获取客户端 ${req.params.clientName} 工具列表失败:`, error);
    res.status(500).json({ error: "获取工具列表失败", message: error.message });
  }
});

// 调用指定客户端的工具
app.post('/mcp/clients/:clientName/tools/call', async (req, res) => {
  try {
    const { clientName } = req.params;
    const { name, arguments: args } = req.body;
    
    if (!name) {
      logger.warn(`调用工具失败: 缺少工具名称`);
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
    
    // 更新工具到客户端的映射
    toolToClientMap[name] = clientName;
    // 保存更新后的工具映射
    saveToolMappings();
    
    logger.info(`成功调用客户端 ${clientName} 的工具 ${name}`);
    logger.debug(`工具 ${name} 调用结果:`, result);
    
    res.json({ 
      client: clientName, 
      tool: name,
      result 
    });
  } catch (error) {
    logger.error(`调用客户端 ${req.params.clientName} 的工具失败:`, error);
    logger.debug(`调用工具失败的请求体:`, req.body);
    res.status(500).json({ error: "工具调用失败", message: error.message });
  }
});

// 调用工具（兼容接口，支持自动查找客户端）
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
    
    if (!mcpClients[targetClientName]) {
      logger.info(`客户端 ${targetClientName} 未连接，尝试连接...`);
      await initMCPClient(targetClientName);
    }
    
    const client = mcpClients[targetClientName];
    if (!client) {
      return res.status(500).json({ error: `客户端 ${targetClientName} 连接失败` });
    }

    const result = await client.callTool({
      name,
      arguments: args || {}
    });
    
    // 更新工具到客户端的映射（确保调用成功的工具被正确映射）
    toolToClientMap[name] = targetClientName;
    // 保存更新后的工具映射
    saveToolMappings();
    
    logger.info(`成功调用客户端 ${targetClientName} 的工具 ${name}`);
    logger.debug(`工具 ${name} 调用结果:`, result);
    
    res.json({ result });
  } catch (error) {
    logger.error(`调用工具失败:`, error);
    logger.debug(`调用工具失败的请求体:`, req.body);
    res.status(500).json({ error: "工具调用失败", message: error.message });
  }
});

// 获取指定客户端的可用资源列表
app.get('/mcp/clients/:clientName/resources', async (req, res) => {
  try {
    const { clientName } = req.params;
    logger.debug(`API请求: 获取客户端 ${clientName} 的资源列表`);
    
    if (!clientConfigs[clientName]) {
      logger.warn(`获取资源列表失败: 未找到客户端配置 ${clientName}`);
      return res.status(404).json({ error: `未找到客户端: ${clientName}` });
    }
    
    let client = mcpClients[clientName];
    if (!client) {
      logger.info(`客户端 ${clientName} 未连接，尝试连接...`);
      client = await initMCPClient(clientName);
    }
    
    logger.debug(`正在获取客户端 ${clientName} 的资源列表...`);
    const resources = await client.listResources();
    logger.info(`成功获取客户端 ${clientName} 的资源列表，共 ${resources.length} 个资源`);
    
    res.json({ 
      client: clientName, 
      resources 
    });
  } catch (error) {
    logger.error(`获取客户端 ${req.params.clientName} 资源列表失败:`, error);
    res.status(500).json({ error: "获取资源列表失败", message: error.message });
  }
});

// 获取指定客户端的可用提示列表
app.get('/mcp/clients/:clientName/prompts', async (req, res) => {
  try {
    const { clientName } = req.params;
    logger.debug(`API请求: 获取客户端 ${clientName} 的提示列表`);
    
    if (!clientConfigs[clientName]) {
      logger.warn(`获取提示列表失败: 未找到客户端配置 ${clientName}`);
      return res.status(404).json({ error: `未找到客户端: ${clientName}` });
    }
    
    let client = mcpClients[clientName];
    if (!client) {
      logger.info(`客户端 ${clientName} 未连接，尝试连接...`);
      client = await initMCPClient(clientName);
    }
    
    logger.debug(`正在获取客户端 ${clientName} 的提示列表...`);
    const prompts = await client.listPrompts();
    logger.info(`成功获取客户端 ${clientName} 的提示列表，共 ${prompts.length} 个提示`);
    
    res.json({ 
      client: clientName, 
      prompts 
    });
  } catch (error) {
    logger.error(`获取客户端 ${req.params.clientName} 提示列表失败:`, error);
    res.status(500).json({ error: "获取提示列表失败", message: error.message });
  }
});

// ===== 兼容旧接口 =====
// 这些API需要客户端指定要使用哪个MCP客户端

// 获取可用工具列表
app.get('/mcp/tools', async (req, res) => {
  try {
    const { client: clientName } = req.query;
    logger.debug(`API请求(兼容): 获取客户端 ${clientName} 的工具列表`);
    const tools = await client.listTools();
    logger.info(`成功获取客户端 ${clientName} 的工具列表，共 ${tools.length} 个工具`);
    
    res.json({ client: clientName, tools });
  } catch (error) {
    logger.error(`获取工具列表失败:`, error);
    res.status(500).json({ error: "获取工具列表失败", message: error.message });
  }
});

// 调用工具
app.post('/mcp/tools/call', async (req, res) => {
  try {
    const { name, arguments: args, clientName } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: "缺少工具名称" });
    }
    
    logger.debug(`API请求(兼容): 调用工具: ${name}`);
    
    const client = mcpClients[clientName];

    const result = await client.callTool({
      name,
      arguments: args || {}
    });
    
    logger.info(`成功调用工具 ${name}`);
    logger.debug(`工具 ${name} 调用结果:`, result);
    
    res.json({ result });
  } catch (error) {
    logger.error(`调用工具失败:`, error);
    logger.debug(`调用工具失败的请求体:`, req.body);
    res.status(500).json({ error: "工具调用失败", message: error.message });
  }
});

// 获取可用资源列表
app.get('/mcp/resources', async (req, res) => {
  try {
    const { client: clientName } = req.query;
    logger.debug(`API请求(兼容): 获取客户端 ${clientName} 的资源列表`);
    
    if (!clientName) {
      logger.warn(`获取资源列表失败: 缺少client参数`);
      return res.status(400).json({ error: "必须指定client参数" });
    }
    
    if (!clientConfigs[clientName]) {
      logger.warn(`获取资源列表失败: 未找到客户端配置 ${clientName}`);
      return res.status(404).json({ error: `未找到客户端: ${clientName}` });
    }
    
    let client = mcpClients[clientName];
    if (!client) {
      logger.info(`客户端 ${clientName} 未连接，尝试连接...`);
      client = await initMCPClient(clientName);
    }
    
    logger.debug(`正在获取客户端 ${clientName} 的资源列表...`);
    const resources = await client.listResources();
    logger.info(`成功获取客户端 ${clientName} 的资源列表，共 ${resources.length} 个资源`);
    
    res.json({ client: clientName, resources });
  } catch (error) {
    logger.error(`获取资源列表失败:`, error);
    res.status(500).json({ error: "获取资源列表失败", message: error.message });
  }
});

// 获取可用提示列表
app.get('/mcp/prompts', async (req, res) => {
  try {
    const { client: clientName } = req.query;
    logger.debug(`API请求(兼容): 获取客户端 ${clientName} 的提示列表`);
    
    if (!clientName) {
      logger.warn(`获取提示列表失败: 缺少client参数`);
      return res.status(400).json({ error: "必须指定client参数" });
    }
    
    logger.debug(`正在获取客户端 ${clientName} 的提示列表...`);
    const prompts = await client.listPrompts();
    logger.info(`成功获取客户端 ${clientName} 的提示列表，共 ${prompts.length} 个提示`);
    
    res.json({ client: clientName, prompts });
  } catch (error) {
    logger.error(`获取提示列表失败:`, error);
    res.status(500).json({ error: "获取提示列表失败", message: error.message });
  }
});

// 获取工具到客户端的映射关系
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

// 关闭应用时断开所有连接
process.on('SIGINT', async () => {
  logger.info('收到关闭信号，正在断开所有客户端连接...');
  
  for (const [clientName, client] of Object.entries(mcpClients)) {
    try {
      if (typeof client.disconnect === 'function') {
        await client.disconnect();
        logger.info(`MCP客户端 ${clientName} 已断开连接`);
      } else {
        logger.warn(`MCP客户端 ${clientName} 没有disconnect方法，跳过断开处理`);
      }
    } catch (error) {
      logger.error(`断开MCP客户端 ${clientName} 连接失败:`, error);
    }
  }
  
  logger.info('所有客户端已断开连接，服务器即将关闭');
  process.exit(0);
});

// 启动服务器
app.listen(port, () => {
  logger.info(`MCP后端服务运行在 http://localhost:${port}`);
  logger.info(`客户端配置保存位置: ${CLIENT_CONFIG_PATH}`);
  logger.info(`工具映射保存位置: ${TOOL_MAPPING_PATH}`);
  logger.info(`日志级别: ${LOG_LEVEL}`);
  
  // 显示工具映射信息
  const toolCount = Object.keys(toolToClientMap).length;
  if (toolCount > 0) {
    logger.info(`已加载 ${toolCount} 个工具映射`);
    if (CURRENT_LOG_LEVEL <= logLevels.DEBUG) {
      logger.debug(`工具映射详情:`, toolToClientMap);
    }
  } else {
    logger.info(`尚未加载任何工具映射，等待初始化完成`);
  }
});