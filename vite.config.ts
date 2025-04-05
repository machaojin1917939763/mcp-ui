import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: './', // 设置为相对路径，这样打包后的资源引用路径正确
  build: {
    outDir: 'dist', // 输出目录
    emptyOutDir: true, // 清空输出目录
  },
  server: {
    port: 5173, // 开发服务器端口
    strictPort: true, // 如果端口被占用，则会直接退出
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src') // 路径别名
    }
  }
})
