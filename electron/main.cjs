const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const isDev = process.env.NODE_ENV === 'development';

// 保持对窗口对象的全局引用，避免JavaScript垃圾回收时窗口关闭
let mainWindow;

function createWindow() {
  console.log('创建窗口，当前开发模式：', isDev);
  
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // 先不显示窗口
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

// Electron初始化完成后创建窗口
app.whenReady().then(createWindow);

// 所有窗口关闭时退出应用
app.on('window-all-closed', function () {
  // 在macOS上，用户通常期望应用程序及其菜单栏保持活动状态，直到用户使用Cmd + Q明确退出
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  // 在macOS上，当点击dock图标且没有其他窗口打开时，通常会在应用程序中重新创建一个窗口
  if (mainWindow === null) {
    createWindow();
  }
});

// 这里可以添加与渲染进程通信的IPC监听器
ipcMain.on('example-message', (event, arg) => {
  console.log('收到渲染进程消息:', arg);
  event.reply('example-reply', 'Message received by main process');
}); 