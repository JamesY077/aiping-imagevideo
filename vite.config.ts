import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5500,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'https://aiping.cn',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 5500,
    strictPort: true,
  },
})
