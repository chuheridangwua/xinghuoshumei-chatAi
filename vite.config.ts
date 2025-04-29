import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), vueJsx()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    // 移除代理配置，改为直接使用完整URL
    // proxy: {
    //   '/api': {
    //     target: 'https://api.dify.ai',
    //     changeOrigin: true,
    //     rewrite: (path) => path.replace(/^\/api/, '')
    //   }
    // }
  },
  build: {
    // 生成带有内容哈希的文件名，用于触发CDN缓存更新
    rollupOptions: {
      output: {
        // 为入口点文件添加哈希
        entryFileNames: 'assets/[name].[hash].js',
        // 为代码分割后的chunk添加哈希
        chunkFileNames: 'assets/[name].[hash].js',
        // 为静态资源添加哈希
        assetFileNames: 'assets/[name].[hash].[ext]',
        // 确保清理掉旧资源
        manualChunks(id) {
          // 将node_modules中的代码单独分割成chunk
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    },
    // 设置sourcemap，便于线上调试
    sourcemap: true,
    // 启用CSS代码分割
    cssCodeSplit: true,
    // 启用CSS压缩
    cssMinify: true
  }
})
