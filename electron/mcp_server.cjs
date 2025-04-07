const express = require('express');
const cors = require('cors');
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

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

// 初始化MCP客户端
async function initMCPClient(clientName) {
  const config = clientConfigs[clientName];
  
  if (!config) {
    logger.error(`初始化客户端 ${clientName} 失败: 未找到配置`);
    throw new Error(`未找到客户端配置: ${clientName}`);
  }

  try {
    logger.info(`初始化MCP客户端: ${clientName}`);
    
    // 检查命令是否有效
    if (!config.command) {
      logger.error(`命令无效: 命令为空`);
      throw new Error(`命令无效: 命令为空`);
    }
    
    // 检查可执行文件是否存在 - 如果是相对路径，则尝试解析为绝对路径
    let commandPath = config.command;
    if (!path.isAbsolute(commandPath)) {
      // 尝试在当前目录和其他可能的目录中查找
      const possiblePaths = [
        path.join(process.cwd(), commandPath),
        path.join(process.cwd(), 'bin', commandPath),
        path.join(process.cwd(), 'node_modules', '.bin', commandPath)
      ];
      
      // 在Windows上，尝试添加.exe后缀
      if (process.platform === 'win32') {
        possiblePaths.push(
          path.join(process.cwd(), `${commandPath}.exe`),
          path.join(process.cwd(), 'bin', `${commandPath}.exe`),
          path.join(process.cwd(), 'node_modules', '.bin', `${commandPath}.exe`)
        );
      }
      
      // 检查每个可能的路径
      let found = false;
      for (const testPath of possiblePaths) {
        try {
          if (fs.existsSync(testPath)) {
            commandPath = testPath;
            found = true;
            logger.info(`找到可执行文件: ${commandPath}`);
            break;
          }
        } catch (err) {
          logger.debug(`检查路径失败 ${testPath}: ${err.message}`);
        }
      }
      
      if (!found) {
        // 尝试使用which查找命令（依赖PATH环境变量）
        try {
          // 检查命令是否在PATH中
          logger.debug(`尝试在PATH中查找命令: ${config.command}`);
          // 在这里不执行which，而是假设命令可能存在于PATH中
          commandPath = config.command;
          logger.info(`假设命令存在于PATH中: ${commandPath}`);
        } catch (err) {
          logger.warn(`无法在PATH中找到命令: ${err.message}`);
        }
      }
    } else if (!fs.existsSync(commandPath)) {
      logger.error(`可执行文件不存在: ${commandPath}`);
      throw new Error(`可执行文件不存在: ${commandPath}`);
    }
    
    // 确保参数是数组
    const args = Array.isArray(config.args) ? config.args : [];
    
    // 创建客户端
    logger.debug(`创建客户端 ${clientName} 使用命令: ${commandPath} ${args.join(' ')}`);
    
    // 尝试使用child_process直接执行命令，测试命令是否可执行
    try {
      logger.debug(`测试命令是否可执行: ${commandPath}`);
      const testProcess = spawn(commandPath, ['--version'], {
        stdio: 'pipe',
        shell: process.platform === 'win32' // 在Windows上使用shell
      });
      
      // 收集输出
      let output = '';
      testProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      let errorOutput = '';
      testProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      // 等待进程结束
      await new Promise((resolve, reject) => {
        testProcess.on('close', (code) => {
          if (code === 0) {
            logger.info(`命令可执行: ${commandPath}，版本信息: ${output.trim()}`);
            resolve();
          } else {
            logger.warn(`命令测试失败，退出码: ${code}, 错误: ${errorOutput}`);
            // 不抛出错误，继续尝试
            resolve();
          }
        });
        
        testProcess.on('error', (err) => {
          logger.error(`命令测试错误: ${err.message}`);
          // 不抛出错误，继续尝试
          resolve();
        });
        
        // 超时处理
        setTimeout(() => {
          testProcess.kill();
          logger.warn(`命令测试超时: ${commandPath}`);
          resolve();
        }, 5000);
      });
    } catch (testError) {
      logger.warn(`测试命令可执行性失败: ${testError.message}`);
      // 继续尝试，不终止流程
    }
    
    // 创建传输
    const transport = new StdioClientTransport({
      command: commandPath,
      args: args,
      // 添加环境变量传递
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'production'
      },
      // 添加超时设置
      timeout: 30000,
      // 添加shell选项用于Windows
      shell: process.platform === 'win32'
    });

    // 创建客户端
    const client = new Client(
      {
        name: `mcp-chat-${clientName}-client`,
        version: "1.0.0"
      }
    );

    try {
      logger.debug(`正在连接到客户端 ${clientName}...`);
      // 添加超时处理
      const connectPromise = client.connect(transport);
      
      // 创建超时Promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`连接超时: 连接到 ${clientName} 超过了30秒`));
        }, 30000);
      });
      
      // 使用Promise.race来添加超时
      await Promise.race([connectPromise, timeoutPromise]);
      
      logger.info(`已成功连接到MCP服务: ${clientName}`);
      
      // 列出可用工具
      try {
        logger.debug(`正在获取客户端 ${clientName} 的工具列表...`);
        const tools = await client.listTools();
        logger.debug(`客户端 ${clientName} 可用工具列表: ${tools.tools.length}个工具`);

        // 更新工具到客户端的映射
        tools.tools.forEach(tool => {
          toolToClientMap[tool.name] = clientName;
          logger.debug(`已将工具 ${tool.name} 映射到客户端 ${clientName}`);
        });

        // 保存工具映射
        saveToolMappings();
      } catch (toolError) {
        logger.error(`获取客户端 ${clientName} 的工具列表失败:`, toolError);
        // 继续处理，不终止流程
      }

      mcpClients[clientName] = client;
      return client;
    } catch (connectError) {
      logger.error(`连接到客户端 ${clientName} 失败:`, connectError);
      
      // 提供更具体的错误信息
      let errorMessage = connectError.message;
      if (connectError.code === 'ENOENT') {
        errorMessage = `可执行文件不存在或无法访问: ${commandPath}`;
      } else if (connectError.code === 'EACCES') {
        errorMessage = `没有执行权限: ${commandPath}`;
      } else if (connectError.code === 'ETIMEDOUT' || connectError.message.includes('timeout')) {
        errorMessage = `连接超时: ${commandPath}`;
      } else if (connectError.code === 'ECONNREFUSED') {
        errorMessage = `连接被拒绝: ${commandPath}`;
      } else if (connectError.code === 'ECONNRESET') {
        errorMessage = `连接被重置: ${commandPath}`;
      } else if (connectError.message.includes('Network Error')) {
        errorMessage = `网络错误: 无法连接到服务. 请检查防火墙设置和网络连接.`;
      }
      
      throw new Error(`连接到客户端失败: ${errorMessage}`);
    }
  } catch (error) {
    logger.error(`MCP客户端 ${clientName} 初始化错误:`, error);
    throw error;
  }
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
    res.status(500).json({ error: error.message });
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

// 获取工具映射
app.get('/api/tools/mapping', (req, res) => {
  try {
    res.json(toolToClientMap);
  } catch (error) {
    logger.error(`获取工具映射失败: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 设置工具映射
app.post('/api/tools/mapping', (req, res) => {
  try {
    const { tool, client } = req.body;
    
    if (!tool || !client) {
      return res.status(400).json({ error: '缺少必要参数: tool, client' });
    }
    
    if (!mcpClients[client]) {
      return res.status(404).json({ error: `客户端 ${client} 不存在或未激活` });
    }
    
    toolToClientMap[tool] = client;
    saveToolMappings();
    
    res.status(201).json({ tool, client, status: 'mapped' });
  } catch (error) {
    logger.error(`设置工具映射失败: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 删除工具映射
app.delete('/api/tools/mapping/:tool', (req, res) => {
  try {
    const { tool } = req.params;
    
    if (toolToClientMap[tool]) {
      delete toolToClientMap[tool];
      saveToolMappings();
    }
    
    res.json({ tool, status: 'unmapped' });
  } catch (error) {
    logger.error(`删除工具映射失败: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 工具调用
app.post('/api/tools/:name/invocations', async (req, res) => {
  try {
    const { name } = req.params;
    const { parameters } = req.body;
    
    logger.info(`调用工具: ${name}`);
    logger.debug(`参数: ${JSON.stringify(parameters)}`);
    
    // 查找对应的客户端
    const clientId = toolToClientMap[name];
    if (!clientId) {
      return res.status(404).json({ error: `找不到工具 ${name} 的映射` });
    }
    
    const client = mcpClients[clientId];
    if (!client) {
      return res.status(404).json({ error: `客户端 ${clientId} 不存在或未激活` });
    }
    
    try {
      // 调用工具
      const result = await client.invoke(name, parameters);
      logger.debug(`工具 ${name} 调用结果: ${JSON.stringify(result)}`);
      res.json(result);
    } catch (error) {
      logger.error(`工具调用失败 ${name}: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  } catch (error) {
    logger.error(`处理工具调用请求失败: ${error.message}`);
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

// 重新加载配置
app.post('/api/reload', async (req, res) => {
  try {
    // 清理所有现有客户端
    await cleanupClients();
    
    // 重新加载配置
    loadClientConfigs();
    loadToolMappings();
    
    // 初始化工具映射
    await initializeToolMappings();
    
    res.json({ 
      success: true, 
      message: '配置已重新加载',
      clients: Object.keys(clientConfigs).length,
      activeClients: Object.keys(mcpClients).length,
      toolMappings: Object.keys(toolToClientMap).length
    });
  } catch (error) {
    logger.error(`重新加载配置失败: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// 初始化工具到客户端的映射
async function initializeToolMappings() {
  try {
    logger.info(`开始初始化工具到客户端的映射...`);

    // 先尝试从文件加载映射
    const loadedFromFile = loadToolMappings();

    if (loadedFromFile && Object.keys(toolToClientMap).length > 0) {
      logger.info(`已从文件加载工具映射，跳过初始化`);
      return;
    }

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
        // 继续处理下一个，不终止流程
      }
    }

    // 保存工具映射
    saveToolMappings();
    logger.info(`工具映射初始化完成，共映射 ${Object.keys(toolToClientMap).length} 个工具`);
  } catch (error) {
    logger.error(`初始化工具映射失败:`, error);
  }
}

// 在启动时尝试初始化工具映射
initializeToolMappings().catch(error => {
  logger.error(`工具映射初始化过程中出错:`, error);
});

// 错误处理中间件
app.use((err, req, res, next) => {
  logger.error('服务器错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 启动服务器
try {
  const server = app.listen(port, () => {
    logger.info(`MCP服务器运行在端口 ${port}`);
    // 通知主进程服务器已启动
    if (process.send) {
      process.send({ type: 'SERVER_STARTED', port });
    }
  });

  // 优雅关闭
  process.on('SIGTERM', () => {
    logger.info('收到SIGTERM信号，准备关闭服务器...');
    
    // 关闭所有客户端
    Object.entries(mcpClients).forEach(async ([id, client]) => {
      try {
        logger.info(`关闭客户端 ${id}`);
        if (typeof client.disconnect === 'function') {
          await client.disconnect();
        }
      } catch (error) {
        logger.warn(`关闭客户端 ${id} 失败: ${error.message}`);
      }
    });
    
    server.close(() => {
      logger.info('服务器已关闭');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.info('收到SIGINT信号，准备关闭服务器...');
    
    // 关闭所有客户端
    Object.entries(mcpClients).forEach(async ([id, client]) => {
      try {
        logger.info(`关闭客户端 ${id}`);
        if (typeof client.disconnect === 'function') {
          await client.disconnect();
        }
      } catch (error) {
        logger.warn(`关闭客户端 ${id} 失败: ${error.message}`);
      }
    });
    
    server.close(() => {
      logger.info('服务器已关闭');
      process.exit(0);
    });
  });

} catch (error) {
  logger.error('启动服务器失败:', error);
  process.exit(1);
}

// 导出app实例供测试使用
module.exports = app;

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

    if (!mcpClients[targetClientName]) {
      logger.info(`客户端 ${targetClientName} 未连接，尝试连接...`);
      try {
        await withRetry(
          () => initMCPClient(targetClientName),
          `连接客户端 ${targetClientName}`
        );
      } catch (connectError) {
        logger.error(`连接客户端 ${targetClientName} 失败:`, connectError);
        return res.status(500).json({ 
          error: `连接客户端失败`, 
          message: connectError.message,
          details: `请检查可执行文件路径和权限，确保网络连接正常`
        });
      }
    }

    const client = mcpClients[targetClientName];
    if (!client) {
      return res.status(500).json({ error: `客户端 ${targetClientName} 连接失败` });
    }

    try {
      // 使用重试逻辑调用工具
      const result = await withRetry(
        () => client.invoke(name, args || {}),
        `调用工具 ${name}`
      );

      // 更新工具到客户端的映射（确保调用成功的工具被正确映射）
      toolToClientMap[name] = targetClientName;
      // 保存更新后的工具映射
      saveToolMappings();

      logger.info(`成功调用客户端 ${targetClientName} 的工具 ${name}`);
      logger.debug(`工具 ${name} 调用结果:`, result);

      res.json({ result });
    } catch (invokeError) {
      logger.error(`调用工具 ${name} 失败:`, invokeError);
      
      // 检查是否需要重新连接
      if (invokeError.message.includes('not connected') || 
          invokeError.message.includes('connection closed') || 
          invokeError.message.includes('Network Error')) {
        
        logger.warn(`客户端 ${targetClientName} 连接状态异常，尝试重新连接...`);
        
        try {
          // 关闭现有连接
          await closeClient(targetClientName);
          
          // 重新连接
          await withRetry(
            () => initMCPClient(targetClientName),
            `重新连接客户端 ${targetClientName}`
          );
          
          logger.info(`已重新连接到客户端 ${targetClientName}，正在重试工具调用...`);
          
          // 重试工具调用
          const client = mcpClients[targetClientName];
          const result = await client.invoke(name, args || {});
          
          // 更新工具映射
          toolToClientMap[name] = targetClientName;
          saveToolMappings();
          
          logger.info(`在重新连接后成功调用客户端 ${targetClientName} 的工具 ${name}`);
          return res.json({ result });
        } catch (reconnectError) {
          logger.error(`重新连接和调用失败:`, reconnectError);
          return res.status(500).json({ 
            error: "工具调用失败", 
            message: `连接异常，重新连接后调用失败: ${reconnectError.message}`,
            suggestion: "请检查服务端程序是否正常运行，网络是否稳定"
          });
        }
      }
      
      res.status(500).json({ 
        error: "工具调用失败", 
        message: invokeError.message,
        suggestion: "请检查工具参数是否正确，服务是否支持该工具"
      });
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

// 获取工具映射(兼容旧路径)
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

// 连接特定客户端(兼容旧路径)
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