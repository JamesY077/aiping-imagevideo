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
      // V2Fun 产物（高斯点云 PLY / 预览视频）放在 oss-cn-1.v2fun.art，
      // 该 OSS 桶不返回 CORS 头，浏览器必须走同源反代才能读取模型字节。
      // 生产环境对应 Nginx 的 location /v2fun-assets/（见 DEPLOYMENT.md）。
      '/v2fun-assets': {
        target: 'https://oss-cn-1.v2fun.art',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/v2fun-assets/, ''),
      },
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 5500,
    strictPort: true,
  },
  build: {
    // three.js 让 3D 路由的懒加载 chunk 到 ~670KB（gzip 后 ~180KB），
    // 只影响 /model3d，不影响首屏；这里把告警阈值调到合理范围。
    chunkSizeWarningLimit: 800,
  },
})
