const { app, BrowserWindow, ipcMain } = require('electron');
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

// 启动MCP服务器
function startMCPServer() {
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
    const possibleConfigDirs = [
      path.join(appPath, 'config'),
      path.join(process.resourcesPath, 'app.asar', 'config'),
      path.join(process.resourcesPath, 'app', 'config')
    ];
    
    for (const p of possibleConfigDirs) {
      if (fs.existsSync(p)) {
        configDir = p;
        break;
      }
    }
    
    if (!configDir) {
      // 如果找不到配置目录，使用应用数据目录
      configDir = path.join(app.getPath('userData'), 'config');
      // 确保目录存在
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
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
    MCP_SERVER_PORT: '3001',
    ELECTRON_RUN_AS_NODE: '1', // 确保子进程以Node模式运行
    NODE_PATH: modulesPath // 确保能找到依赖模块
  };

  try {
    // 启动服务器进程
    serverProcess = fork(serverPath, [], {
      env,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });

    // 监听服务器输出
    if (serverProcess.stdout) {
      serverProcess.stdout.on('data', (data) => {
        console.log('MCP服务器输出:', data.toString());
      });
    }

    if (serverProcess.stderr) {
      serverProcess.stderr.on('data', (data) => {
        console.error('MCP服务器错误:', data.toString());
      });
    }

    serverProcess.on('message', (message) => {
      console.log('收到MCP服务器消息:', message);
      
      // 处理不同类型的服务器消息
      if (message.type === 'SERVER_STARTED') {
        console.log(`MCP服务器已在端口 ${message.port} 上启动`);
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

    serverProcess.on('error', (error) => {
      console.error('MCP服务器错误:', error);
    });

    serverProcess.on('close', (code) => {
      console.log('MCP服务器已关闭，退出码:', code);
      // 如果在开发模式下服务器意外关闭，尝试重启
      if (isDev && code !== 0) {
        console.log('尝试重启MCP服务器...');
        setTimeout(startMCPServer, 5000);
      }
    });

    // 检查服务器是否成功启动
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        console.log('MCP服务器启动成功');
        
        // 尝试访问健康检查接口
        const healthCheckUrl = `http://localhost:${env.MCP_SERVER_PORT}/health`;
        
        http.get(healthCheckUrl, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            try {
              const response = JSON.parse(data);
              console.log('服务器健康检查结果:', response);
            } catch (error) {
              console.error('解析健康检查响应失败:', error);
            }
          });
        }).on('error', (error) => {
          console.error('健康检查请求失败:', error.message);
        });
      } else {
        console.error('MCP服务器启动失败');
      }
    }, 3000); // 增加到3秒

  } catch (error) {
    console.error('启动MCP服务器失败:', error);
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

// 这里可以添加与渲染进程通信的IPC监听器
ipcMain.on('example-message', (event, arg) => {
  console.log('收到渲染进程消息:', arg);
  event.reply('example-reply', 'Message received by main process');
});

// 增加MCP服务器的API调用接口
ipcMain.handle('mcp-server-status', async () => {
  try {
    // 获取服务器状态
    const response = await new Promise((resolve, reject) => {
      http.get(`http://localhost:3001/api/status`, (res) => {
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
    console.error('获取MCP服务器状态失败:', error);
    return { error: error.message, status: 'error' };
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