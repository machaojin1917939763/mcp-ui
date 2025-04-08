const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const url = require('url');
const { fork } = require('child_process');
const isDev = process.env.NODE_ENV === 'development';
const fs = require('fs-extra');
const http = require('http');

// 设置应用图标
if (process.platform === 'win32') {
  app.setAppUserModelId(process.execPath);
}

// 保持对服务器进程的引用
let serverProcess = null;
let serverStartAttempts = 0;
const MAX_START_ATTEMPTS = 5;
const SERVER_RESTART_DELAY = 5000; // 5秒后重启
let serverPort = process.env.MCP_SERVER_PORT || '3001';

// 存储最近的服务器日志
const serverLogs = {
  stdout: [],
  stderr: [],
  messages: [],
  maxLogLength: 1000 // 限制日志数量
};

// 获取MCP服务器日志
ipcMain.handle('get-mcp-server-logs', () => {
  return serverLogs;
});

// 添加一个日志记录函数
function addServerLog(type, message) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    message
  };
  
  // 添加到相应的日志类型
  serverLogs[type].push(logEntry);
  
  // 如果超出最大长度，删除旧日志
  if (serverLogs[type].length > serverLogs.maxLogLength) {
    serverLogs[type].shift();
  }
  
  return logEntry;
}

// 检查MCP服务器连接
ipcMain.handle('check-mcp-server-connection', async () => {
  try {
    // 检查服务器进程状态
    const processStatus = serverProcess ? 
      (serverProcess.killed ? '已终止' : '运行中') : 
      '未启动';
      
    console.log(`检查MCP服务器连接, 服务器进程状态: ${processStatus}`);
    
    // 只有在服务器进程正在运行时，才进行连接检查
    if (serverProcess && !serverProcess.killed) {
      const connectionUrl = `http://localhost:${serverPort}/health`;
      
      // 添加到日志
      addServerLog('messages', `尝试连接到 ${connectionUrl}`);
      
      // 测试连接
      const response = await new Promise((resolve, reject) => {
        const req = http.get(connectionUrl, { timeout: 3000 }, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            if (!data || data.trim() === '') {
              reject(new Error('空响应'));
              return;
            }
            
            try {
              resolve({
                statusCode: res.statusCode,
                headers: res.headers,
                data: JSON.parse(data)
              });
            } catch (error) {
              reject(new Error(`解析响应失败: ${error.message}, 原始数据: ${data}`));
            }
          });
        });
        
        req.on('error', (error) => {
          reject(error);
        });
        
        req.on('timeout', () => {
          req.abort();
          reject(new Error('请求超时'));
        });
      });
      
      addServerLog('messages', `连接成功: ${JSON.stringify(response)}`);
      
      return {
        success: true,
        processStatus,
        connection: {
          status: 'connected',
          port: serverPort,
          response
        }
      };
    } else {
      addServerLog('messages', `服务器进程未运行，无法检查连接`);
      
      return {
        success: false,
        processStatus,
        connection: {
          status: 'process_not_running',
          error: '服务器进程未运行'
        }
      };
    }
  } catch (error) {
    console.error('检查MCP服务器连接失败:', error);
    addServerLog('messages', `连接失败: ${error.message}`);
    
    return {
      success: false,
      processStatus: serverProcess ? (serverProcess.killed ? '已终止' : '运行中') : '未启动',
      connection: {
        status: 'error',
        error: error.message,
        code: error.code
      }
    };
  }
});

// 强制修复MCP服务器连接
ipcMain.handle('fix-mcp-server-connection', async () => {
  try {
    console.log('强制修复MCP服务器连接');
    addServerLog('messages', `强制修复服务器连接`);
    
    // 先尝试关闭现有服务器
    if (serverProcess) {
      try {
        serverProcess.kill('SIGKILL'); // 强制终止
      } catch (error) {
        console.error('强制终止服务器进程失败:', error);
      }
      serverProcess = null;
    }
    
    // 重置端口
    serverPort = process.env.MCP_SERVER_PORT || '3001';
    
    // 重置尝试次数
    serverStartAttempts = 0;
    
    // 启动新的服务器进程
    startMCPServer();
    
    return {
      success: true,
      message: '服务器连接修复进行中，请等待几秒后重试'
    };
  } catch (error) {
    console.error('修复MCP服务器连接失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// 获取当前服务器端口
ipcMain.handle('get-mcp-server-port', () => {
  return {
    port: serverPort,
    processExists: !!serverProcess,
    processRunning: serverProcess && !serverProcess.killed
  };
});

// 修改服务器输出监听，将输出添加到日志中
function setupServerProcessLogging() {
  if (serverProcess) {
    if (serverProcess.stdout) {
      serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('MCP服务器输出:', output);
        addServerLog('stdout', output);
      });
    }
    
    if (serverProcess.stderr) {
      serverProcess.stderr.on('data', (data) => {
        const output = data.toString();
        console.error('MCP服务器错误:', output);
        addServerLog('stderr', output);
      });
    }
    
    serverProcess.on('message', (message) => {
      console.log('收到MCP服务器消息:', message);
      addServerLog('messages', `IPC消息: ${JSON.stringify(message)}`);
      
      // 处理不同类型的服务器消息
      if (message.type === 'SERVER_STARTED') {
        console.log(`MCP服务器已在端口 ${message.port} 上启动`);
        // 重置尝试次数，因为服务器已成功启动
        serverStartAttempts = 0;
        
        // 如果有窗口，通知渲染进程服务器已启动
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('mcp-server-status-change', {
            status: 'running',
            port: message.port
          });
        }
      } else if (message.level) {
        // 处理日志消息
        const { level, message: logMessage, timestamp } = message;
        const prefix = timestamp ? `[${timestamp}]` : '';
        
        if (level === 'ERROR') {
          console.error(`${prefix}[MCP服务器] ${logMessage}`);
        } else if (level === 'WARN') {
          console.warn(`${prefix}[MCP服务器] ${logMessage}`);
        } else {
          console.log(`${prefix}[MCP服务器] ${logMessage}`);
        }
      }
    });
  }
}

// 启动MCP服务器
function startMCPServer() {
  // 如果已经尝试太多次，则放弃
  if (serverStartAttempts >= MAX_START_ATTEMPTS) {
    console.error(`已尝试启动服务器 ${MAX_START_ATTEMPTS} 次，放弃重试`);
    return;
  }
  
  serverStartAttempts++;
  console.log(`尝试启动MCP服务器 (尝试 ${serverStartAttempts}/${MAX_START_ATTEMPTS})`);
  
  // 在生产环境中，需要考虑asar打包带来的路径差异
  const appPath = app.getAppPath();
  const isPackaged = app.isPackaged;
  
  let serverPath;
  // 尝试不同的可能路径
  if (isDev) {
    serverPath = path.join(process.cwd(), 'electron', 'mcp_server.cjs');
  } else {
    const possiblePaths = [
      path.join(appPath, 'electron', 'mcp_server.cjs'),
      path.join(process.resourcesPath, 'app.asar', 'electron', 'mcp_server.cjs'),
      path.join(process.resourcesPath, 'app', 'electron', 'mcp_server.cjs')
    ];
    
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        serverPath = p;
        break;
      }
    }
    
    if (!serverPath) {
      console.error('无法找到服务器文件!');
      console.log('尝试的路径:', possiblePaths);
      return;
    }
  }

  console.log(`启动MCP服务器:
  - 服务器路径: ${serverPath}
  - 应用路径: ${appPath}
  - 资源路径: ${process.resourcesPath}
  - 是否已打包: ${isPackaged}
  - 开发模式: ${isDev}`);
  
  // 设置环境变量
  let configDir;
  if (isDev) {
    configDir = path.join(process.cwd(), 'config');
  } else {
    // 在生产模式下，首先尝试使用用户数据目录
    configDir = path.join(app.getPath('userData'), 'config');
    
    // 确保目录存在
    if (!fs.existsSync(configDir)) {
      try {
        fs.mkdirSync(configDir, { recursive: true });
        console.log(`已创建配置目录: ${configDir}`);
        
        // 如果打包的应用中有示例配置，复制到用户数据目录
        const packagedConfigDir = path.join(appPath, 'config');
        if (fs.existsSync(packagedConfigDir)) {
          fs.copySync(packagedConfigDir, configDir);
          console.log(`已从 ${packagedConfigDir} 复制配置文件到 ${configDir}`);
        }
      } catch (error) {
        console.error('创建配置目录失败:', error);
        
        // 失败时尝试使用应用目录中的配置
        const possibleConfigDirs = [
          path.join(appPath, 'config'),
          path.join(process.resourcesPath, 'app.asar', 'config'),
          path.join(process.resourcesPath, 'app', 'config')
        ];
        
        for (const p of possibleConfigDirs) {
          if (fs.existsSync(p)) {
            configDir = p;
            console.log(`使用备用配置目录: ${configDir}`);
            break;
          }
        }
      }
    }
  }
  
  console.log(`配置目录: ${configDir}`);
  
  // 设置模块路径
  const modulesPath = isDev 
    ? path.join(process.cwd(), 'node_modules') 
    : path.join(process.resourcesPath, 'node_modules');
    
  console.log(`模块路径: ${modulesPath}`);
  
  const env = {
    ...process.env,
    NODE_ENV: isDev ? 'development' : 'production',
    MCP_CONFIG_DIR: configDir,
    MCP_SERVER_PORT: serverPort,
    ELECTRON_RUN_AS_NODE: '1', // 确保子进程以Node模式运行
    NODE_PATH: modulesPath, // 确保能找到依赖模块
    // 添加额外的调试信息
    MCP_LOG_LEVEL: 'DEBUG' // 设置服务器日志级别为DEBUG以获取更多信息
  };

  try {
    // 启动前确保端口未被占用
    checkPortInUse(serverPort)
      .then(inUse => {
        if (inUse) {
          console.log(`端口 ${serverPort} 已被占用，尝试使用新端口`);
          addServerLog('messages', `端口 ${serverPort} 已被占用，尝试新端口`);
          serverPort = (parseInt(serverPort) + 1).toString();
          // 递归尝试新端口
          startMCPServer();
          return;
        }
        
        console.log(`端口 ${serverPort} 可用，启动服务器进程`);
        addServerLog('messages', `端口 ${serverPort} 可用，启动服务器进程`);
        
        // 启动服务器进程
        serverProcess = fork(serverPath, [], {
          env,
          stdio: ['pipe', 'pipe', 'pipe', 'ipc']
        });
        
        // 设置日志记录
        setupServerProcessLogging();
        
        // 添加额外的错误处理
        serverProcess.on('error', (error) => {
          console.error('MCP服务器错误:', error);
          addServerLog('stderr', `服务器错误: ${error.message}`);
          
          // 如果是端口被占用错误，尝试其他端口
          if (error.code === 'EADDRINUSE') {
            console.log(`端口 ${serverPort} 已被占用，尝试其他端口`);
            serverPort = (parseInt(serverPort) + 1).toString();
            
            // 重启服务器
            setTimeout(() => {
              startMCPServer();
            }, 1000);
            return;
          }
          
          // 尝试重启服务器
          restartServerIfNeeded();
        });
        
        serverProcess.on('close', (code) => {
          console.log('MCP服务器已关闭，退出码:', code);
          addServerLog('messages', `服务器已关闭，退出码: ${code}`);
          
          // 通知渲染进程服务器已关闭
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('mcp-server-status-change', {
              status: 'stopped',
              exitCode: code
            });
          }
          
          // 意外关闭时尝试重启
          if (code !== 0 && code !== null) {
            restartServerIfNeeded();
          }
        });
        
        // 检查服务器是否成功启动
        setTimeout(() => {
          if (serverProcess && !serverProcess.killed) {
            checkServerHealth();
          } else {
            console.error('MCP服务器启动失败');
            addServerLog('stderr', '服务器启动失败');
            restartServerIfNeeded();
          }
        }, 3000);
      })
      .catch(error => {
        console.error('检查端口时出错:', error);
        addServerLog('stderr', `检查端口出错: ${error.message}`);
        
        // 继续尝试启动服务器
        serverProcess = fork(serverPath, [], {
          env,
          stdio: ['pipe', 'pipe', 'pipe', 'ipc']
        });
        
        // 设置日志记录
        setupServerProcessLogging();
        
        // 检查服务器是否成功启动
        setTimeout(() => {
          if (serverProcess && !serverProcess.killed) {
            checkServerHealth();
          } else {
            console.error('MCP服务器启动失败');
            addServerLog('stderr', '服务器启动失败');
            restartServerIfNeeded();
          }
        }, 3000);
      });
  } catch (error) {
    console.error('启动MCP服务器失败:', error);
    addServerLog('stderr', `启动服务器失败: ${error.message}`);
    restartServerIfNeeded();
  }
}

// 添加检查端口是否被占用的函数
function checkPortInUse(port) {
  return new Promise((resolve, reject) => {
    const net = require('net');
    const tester = net.createServer()
      .once('error', err => {
        if (err.code === 'EADDRINUSE') {
          resolve(true); // 端口被占用
        } else {
          reject(err); // 其他错误
        }
      })
      .once('listening', () => {
        // 端口可用，关闭服务器并返回false
        tester.close(() => resolve(false));
      })
      .listen(port, '127.0.0.1');
  });
}

// 检查服务器健康状态
function checkServerHealth() {
  console.log(`检查MCP服务器健康状态，尝试连接到端口 ${serverPort}`);
  addServerLog('messages', `检查服务器健康状态，端口 ${serverPort}`);
  
  const healthCheckUrl = `http://localhost:${serverPort}/health`;
  console.log(`发送健康检查请求到: ${healthCheckUrl}`);
  
  const req = http.get(healthCheckUrl, (res) => {
    console.log(`收到健康检查响应，状态码: ${res.statusCode}`);
    addServerLog('messages', `健康检查响应状态码: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        if (!data || data.trim() === '') {
          console.error('健康检查响应为空');
          addServerLog('stderr', '健康检查响应为空');
          restartServerIfNeeded();
          return;
        }
        
        const response = JSON.parse(data);
        console.log('服务器健康检查结果:', response);
        addServerLog('messages', `健康检查成功: ${JSON.stringify(response)}`);
        
        // 服务器健康，重置尝试次数
        serverStartAttempts = 0;
        
        // 尝试更详细的连接测试
        testApiEndpoints();
        
        // 通知渲染进程服务器状态
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('mcp-server-status-change', {
            status: 'running',
            port: serverPort,
            health: response
          });
        }
      } catch (error) {
        console.error('解析健康检查响应失败:', error);
        console.error('原始响应数据:', data);
        addServerLog('stderr', `解析响应失败: ${error.message}, 数据: ${data}`);
        restartServerIfNeeded();
      }
    });
  });
  
  req.setTimeout(3000, () => {
    console.error('健康检查请求超时');
    addServerLog('stderr', '健康检查请求超时');
    req.abort();
    restartServerIfNeeded();
  });

  req.on('error', (error) => {
    console.error('健康检查请求失败:', error.message);
    addServerLog('stderr', `健康检查失败: ${error.message}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.error(`无法连接到端口 ${serverPort}，服务器可能未启动或端口被占用`);
      addServerLog('stderr', `连接被拒绝 (端口 ${serverPort})`);
    }
    restartServerIfNeeded();
  });
}

// 添加测试API端点的函数
function testApiEndpoints() {
  setTimeout(() => {
    // 测试MCP客户端列表端点
    const apiUrl = `http://localhost:${serverPort}/api/clients`;
    console.log(`测试API端点: ${apiUrl}`);
    addServerLog('messages', `测试API端点: ${apiUrl}`);
    
    http.get(apiUrl, { timeout: 2000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (!data || data.trim() === '') {
            console.error('API测试响应为空');
            addServerLog('stderr', `API测试响应为空: ${apiUrl}`);
            return;
          }
          
          const response = JSON.parse(data);
          console.log('API测试成功:', response);
          addServerLog('messages', `API测试成功: ${apiUrl}`);
        } catch (error) {
          console.error(`API测试解析失败: ${apiUrl}`, error);
          addServerLog('stderr', `API测试解析失败: ${apiUrl}, ${error.message}`);
        }
      });
    }).on('error', (error) => {
      console.error(`API测试请求失败: ${apiUrl}`, error);
      addServerLog('stderr', `API测试失败: ${apiUrl}, ${error.message}`);
    });
    
    // 测试旧路径
    const oldApiUrl = `http://localhost:${serverPort}/mcp/clients`;
    console.log(`测试旧API端点: ${oldApiUrl}`);
    addServerLog('messages', `测试旧API端点: ${oldApiUrl}`);
    
    http.get(oldApiUrl, { timeout: 2000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (!data || data.trim() === '') {
            console.error('旧API测试响应为空');
            addServerLog('stderr', `旧API测试响应为空: ${oldApiUrl}`);
            return;
          }
          
          const response = JSON.parse(data);
          console.log('旧API测试成功:', response);
          addServerLog('messages', `旧API测试成功: ${oldApiUrl}`);
        } catch (error) {
          console.error(`旧API测试解析失败: ${oldApiUrl}`, error);
          addServerLog('stderr', `旧API测试解析失败: ${oldApiUrl}, ${error.message}`);
        }
      });
    }).on('error', (error) => {
      console.error(`旧API测试请求失败: ${oldApiUrl}`, error);
      addServerLog('stderr', `旧API测试失败: ${oldApiUrl}, ${error.message}`);
    });
  }, 1000); // 健康检查成功后等待1秒再测试API
}

// 根据需要重启服务器
function restartServerIfNeeded() {
  // 如果进程已存在但异常，先关闭
  if (serverProcess) {
    try {
      console.log('关闭现有服务器进程');
      addServerLog('messages', '关闭现有服务器进程');
      serverProcess.kill();
    } catch (error) {
      console.error('关闭现有服务器进程失败:', error);
      addServerLog('stderr', `关闭服务器进程失败: ${error.message}`);
    }
    serverProcess = null;
  }
  
  // 如果尝试次数未超过上限，则尝试重启
  if (serverStartAttempts < MAX_START_ATTEMPTS) {
    console.log(`将在 ${SERVER_RESTART_DELAY/1000} 秒后尝试重启MCP服务器...`);
    addServerLog('messages', `将在 ${SERVER_RESTART_DELAY/1000} 秒后尝试重启服务器 (尝试 ${serverStartAttempts+1}/${MAX_START_ATTEMPTS})`);
    
    // 通知渲染进程服务器状态
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mcp-server-status-change', {
        status: 'restarting',
        attempt: serverStartAttempts,
        maxAttempts: MAX_START_ATTEMPTS
      });
    }
    
    setTimeout(startMCPServer, SERVER_RESTART_DELAY);
  } else {
    console.error(`MCP服务器启动失败，已达到最大尝试次数 ${MAX_START_ATTEMPTS}`);
    addServerLog('stderr', `服务器启动失败，已达到最大尝试次数 ${MAX_START_ATTEMPTS}`);
    
    // 通知渲染进程服务器状态
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mcp-server-status-change', {
        status: 'failed',
        message: `启动失败，已尝试 ${MAX_START_ATTEMPTS} 次`
      });
    }
  }
}

// 保持对窗口对象的全局引用，避免JavaScript垃圾回收时窗口关闭
let mainWindow;

function createWindow() {
  console.log('创建窗口，当前开发模式：', isDev);
  
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // 先不显示窗口
    frame: true, // 保留窗口边框
    autoHideMenuBar: true, // 自动隐藏菜单栏
    icon: path.join(isDev ? process.cwd() : process.resourcesPath, 'public', 'icons', process.platform === 'win32' ? 'win.ico' : process.platform === 'darwin' ? 'mac.icns' : 'linux.png'),
    webPreferences: {
      nodeIntegration: false, // 不直接集成Node到渲染进程
      contextIsolation: true, // 启用上下文隔离
      enableRemoteModule: false, // 禁用remote模块
      preload: path.join(__dirname, 'preload.cjs') // 预加载脚本
    }
  });

  // 加载完成后再显示窗口以避免白屏
  mainWindow.once('ready-to-show', () => {
    console.log('窗口准备就绪，现在显示');
    mainWindow.show();
  });

  // 加载应用
  if (isDev) {
    // 开发模式下，使用Vite的开发服务器
    const devServerUrl = 'http://localhost:5173';
    console.log('正在加载开发服务器:', devServerUrl);
    
    // 添加加载错误处理
    mainWindow.webContents.on('did-fail-load', () => {
      console.log('加载失败，可能是开发服务器未启动，5秒后重试...');
      setTimeout(() => {
        console.log('重新尝试加载:', devServerUrl);
        mainWindow.loadURL(devServerUrl);
      }, 5000);
    });

    mainWindow.loadURL(devServerUrl);
    
    // 打开开发者工具
    mainWindow.webContents.openDevTools();
  } else {
    // 生产模式下，加载打包后的应用
    const filePath = path.join(__dirname, '../dist/index.html');
    console.log('正在加载生产环境文件:', filePath);
    mainWindow.loadURL(
      url.format({
        pathname: filePath,
        protocol: 'file:',
        slashes: true
      })
    );
  }

  // 窗口关闭时触发
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// Electron初始化完成后创建窗口并启动服务器
app.whenReady().then(() => {
  startMCPServer();
  createWindow();
  
  // 添加快捷键打开开发者工具
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow) {
      mainWindow.webContents.openDevTools();
    }
  });
});

// 所有窗口关闭时退出应用
app.on('window-all-closed', function () {
  // 在macOS上，用户通常期望应用程序及其菜单栏保持活动状态，直到用户使用Cmd + Q明确退出
  if (process.platform !== 'darwin') {
    if (serverProcess) {
      serverProcess.kill();
    }
    app.quit();
  }
});

app.on('activate', function () {
  // 在macOS上，当点击dock图标且没有其他窗口打开时，通常会在应用程序中重新创建一个窗口
  if (mainWindow === null) {
    createWindow();
  }
});

// 确保应用退出时关闭服务器
app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

// 确保在应用退出时取消注册所有快捷键
app.on('will-quit', () => {
  // 取消注册所有快捷键
  globalShortcut.unregisterAll();
});

// 这里可以添加与渲染进程通信的IPC监听器
ipcMain.on('example-message', (event, arg) => {
  console.log('收到渲染进程消息:', arg);
  event.reply('example-reply', 'Message received by main process');
});

// 修改mcp-server-status处理函数，添加更多错误处理
ipcMain.handle('mcp-server-status', async () => {
  try {
    if (!serverProcess || serverProcess.killed) {
      console.warn('请求服务器状态时发现服务器未运行，返回错误状态');
      return { error: '服务器未运行', status: 'stopped' };
    }
    
    // 获取服务器状态
    const statusUrl = `http://localhost:${serverPort}/api/status`;
    console.log(`发送状态请求到: ${statusUrl}`);
    
    const response = await new Promise((resolve, reject) => {
      const req = http.get(statusUrl, (res) => {
        console.log(`收到状态响应，状态码: ${res.statusCode}`);
        
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            if (!data || data.trim() === '') {
              reject(new Error('响应为空'));
              return;
            }
            
            resolve(JSON.parse(data));
          } catch (error) {
            console.error('解析服务器状态响应失败:', error);
            console.error('原始响应数据:', data);
            reject(error);
          }
        });
      });
      
      req.setTimeout(5000, () => {
        console.error('状态请求超时');
        req.abort();
        reject(new Error('请求超时'));
      });
      
      req.on('error', (error) => {
        console.error('状态请求失败:', error.message);
        reject(error);
      });
    });
    
    return response;
  } catch (error) {
    console.error('获取MCP服务器状态失败:', error);
    
    // 检查服务器是否需要重启
    if (error.code === 'ECONNREFUSED' || error.message.includes('响应为空')) {
      console.warn('服务器可能未正常运行，尝试重启...');
      restartServerIfNeeded();
    }
    
    return { 
      error: error.message, 
      status: 'error',
      serverProcessExists: !!serverProcess,
      serverProcessKilled: serverProcess ? serverProcess.killed : true,
      port: serverPort
    };
  }
});

// 健康检查API
ipcMain.handle('mcp-server-health', async () => {
  try {
    // 获取服务器健康状态
    const response = await new Promise((resolve, reject) => {
      http.get(`http://localhost:3001/health`, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
    
    return response;
  } catch (error) {
    console.error('获取MCP服务器健康状态失败:', error);
    return { error: error.message, status: 'error' };
  }
});

// 重启 MCP 服务器
ipcMain.handle('mcp-server-restart', async () => {
  try {
    console.log('收到重启 MCP 服务器请求');
    
    // 关闭现有服务器进程
    if (serverProcess) {
      try {
        serverProcess.kill();
        serverProcess = null;
      } catch (error) {
        console.error('关闭现有服务器进程失败:', error);
      }
    }
    
    // 重置尝试计数
    serverStartAttempts = 0;
    
    // 启动新的服务器进程
    startMCPServer();
    
    return { success: true, message: '服务器重启中' };
  } catch (error) {
    console.error('重启 MCP 服务器失败:', error);
    return { success: false, error: error.message };
  }
});

// 获取应用版本
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// 获取应用路径
ipcMain.handle('get-app-path', (event, name) => {
  try {
    return app.getPath(name || 'userData');
  } catch (error) {
    console.error('获取应用路径失败:', error);
    return null;
  }
});

// 打开外部链接
ipcMain.handle('open-external', async (event, url) => {
  try {
    const { shell } = require('electron');
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('打开外部链接失败:', error);
    return { success: false, error: error.message };
  }
});

// 退出应用
ipcMain.handle('quit-app', () => {
  app.quit();
  return { success: true };
});

// 添加请求代理功能，用于调试前端和后端通信
ipcMain.handle('proxy-request', async (event, options) => {
  try {
    const { method, url, data, headers, timeout = 10000 } = options;
    
    console.log(`代理请求: ${method} ${url}`);
    addServerLog('messages', `代理请求: ${method} ${url}`);
    
    if (data) {
      console.log('请求数据:', data);
      addServerLog('messages', `请求数据: ${JSON.stringify(data)}`);
    }
    
    // 构建完整URL
    let fullUrl = url;
    if (!url.startsWith('http')) {
      fullUrl = `http://localhost:${serverPort}${url}`;
    }
    
    // 创建请求选项
    const requestOptions = {
      method: method.toUpperCase(),
      headers: headers || {
        'Content-Type': 'application/json',
      },
      timeout
    };
    
    return new Promise((resolve, reject) => {
      const httpModule = require('http');
      const parsedUrl = new URL(fullUrl);
      
      // 如果是POST、PUT等需要请求体的方法，准备数据
      let postData = null;
      if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        postData = typeof data === 'string' ? data : JSON.stringify(data);
        requestOptions.headers['Content-Length'] = Buffer.byteLength(postData);
      }
      
      const req = httpModule.request(parsedUrl, requestOptions, (res) => {
        const statusCode = res.statusCode;
        const headers = res.headers;
        
        console.log(`代理响应: ${statusCode}, ${res.statusMessage}`);
        addServerLog('messages', `代理响应: ${statusCode}, ${res.statusMessage}`);
        
        let responseBody = '';
        res.setEncoding('utf8');
        
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        
        res.on('end', () => {
          try {
            let parsedBody = responseBody;
            
            // 尝试解析JSON
            if (responseBody && (res.headers['content-type'] || '').includes('application/json')) {
              try {
                parsedBody = JSON.parse(responseBody);
              } catch (e) {
                console.error('解析响应JSON失败:', e);
                addServerLog('stderr', `解析响应JSON失败: ${e.message}`);
              }
            }
            
            console.log('响应数据:', parsedBody);
            
            resolve({
              statusCode,
              headers,
              data: parsedBody,
              rawData: responseBody
            });
          } catch (err) {
            console.error('处理响应失败:', err);
            addServerLog('stderr', `处理响应失败: ${err.message}`);
            reject(err);
          }
        });
      });
      
      // 错误处理
      req.on('error', (err) => {
        console.error('代理请求错误:', err);
        addServerLog('stderr', `代理请求错误: ${err.message}`);
        
        // 检查是否是因为服务器未启动
        if (err.code === 'ECONNREFUSED') {
          console.log('服务器连接被拒绝，尝试重启服务器');
          addServerLog('stderr', `服务器连接被拒绝，尝试重启`);
          
          // 尝试重启服务器
          if (serverProcess) {
            try {
              serverProcess.kill();
            } catch (e) {
              console.error('关闭现有服务器进程失败:', e);
            }
            serverProcess = null;
          }
          
          // 重置尝试次数
          serverStartAttempts = 0;
          
          // 启动新的服务器进程
          startMCPServer();
          
          reject({
            code: 'SERVER_RESTARTING',
            message: '服务器连接失败，正在尝试重启服务器，请稍后重试'
          });
        } else {
          reject(err);
        }
      });
      
      // 设置超时
      req.setTimeout(timeout, () => {
        req.abort();
        console.error('代理请求超时');
        addServerLog('stderr', `代理请求超时: ${method} ${url}`);
        reject(new Error('请求超时'));
      });
      
      // 发送请求体数据
      if (postData) {
        req.write(postData);
      }
      
      req.end();
    });
  } catch (error) {
    console.error('代理请求失败:', error);
    addServerLog('stderr', `代理请求失败: ${error.message}`);
    return {
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    };
  }
});

// 添加MCP服务器诊断工具
ipcMain.handle('diagnose-mcp-server', async () => {
  try {
    console.log('开始MCP服务器诊断...');
    addServerLog('messages', '开始MCP服务器诊断');
    
    const diagnosticResults = {
      serverProcess: {
        exists: !!serverProcess,
        killed: serverProcess ? serverProcess.killed : null,
        pid: serverProcess ? serverProcess.pid : null
      },
      serverPort,
      serverStartAttempts,
      serverLogs: {
        totalStdout: serverLogs.stdout.length,
        totalStderr: serverLogs.stderr.length,
        totalMessages: serverLogs.messages.length,
        recentStdout: serverLogs.stdout.slice(-10),
        recentStderr: serverLogs.stderr.slice(-10),
        recentMessages: serverLogs.messages.slice(-10)
      },
      endpoints: {},
      environment: {
        isDev,
        resourcesPath: process.resourcesPath || null,
        appPath: app.getAppPath(),
        dataPath: app.getPath('userData'),
        electronVersion: process.versions.electron,
        nodeVersion: process.versions.node,
        platform: process.platform
      }
    };
    
    // 测试MCP服务器的关键端点
    if (serverProcess && !serverProcess.killed) {
      const apiEndpoints = [
        '/health',
        '/api/status',
        '/api/clients',
        '/mcp/clients'
      ];
      
      for (const endpoint of apiEndpoints) {
        try {
          const url = `http://localhost:${serverPort}${endpoint}`;
          console.log(`测试端点: ${url}`);
          
          const response = await new Promise((resolve, reject) => {
            const req = http.get(url, { timeout: 3000 }, (res) => {
              let data = '';
              res.on('data', (chunk) => {
                data += chunk;
              });
              
              res.on('end', () => {
                try {
                  const responseData = data ? JSON.parse(data) : null;
                  resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    data: responseData,
                    rawData: data
                  });
                } catch (error) {
                  resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    error: error.message,
                    rawData: data
                  });
                }
              });
            });
            
            req.on('error', (error) => {
              reject(error);
            });
            
            req.setTimeout(3000, () => {
              req.abort();
              reject(new Error('请求超时'));
            });
          });
          
          diagnosticResults.endpoints[endpoint] = {
            status: 'success',
            ...response
          };
        } catch (error) {
          diagnosticResults.endpoints[endpoint] = {
            status: 'error',
            error: error.message,
            code: error.code
          };
        }
      }
    }
    
    return diagnosticResults;
  } catch (error) {
    console.error('诊断MCP服务器失败:', error);
    return {
      error: error.message,
      stack: error.stack
    };
  }
}); 