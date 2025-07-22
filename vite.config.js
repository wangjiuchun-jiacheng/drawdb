import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const isBuild = command === 'build';
  const isMicroMode = mode === 'micro';
  
  return {
    plugins: [react()],
    
    // 基础路径配置
    base: './',
    
    // 构建配置
    build: {
      target: 'esnext',
      minify: false,
      
      // 微前端模式的构建配置
      rollupOptions: isMicroMode ? {
        input: {
          // 微前端入口
          index: 'src/micro-main.jsx'
        },
        output: {
          // UMD格式便于微前端加载
          format: 'umd',
          name: 'DrawDBMicro',
          entryFileNames: 'js/[name].js',
          chunkFileNames: 'js/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash][extname]',
          // 外部化大型依赖（可选）
          globals: {
            'react': 'React',
            'react-dom': 'ReactDOM'
          }
        }
      } : {
        // 正常模式构建配置
        output: {
          entryFileNames: 'js/[name].[hash].js',
          chunkFileNames: 'js/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash][extname]'
        }
      },
      
      // 生成sourcemap便于调试
      sourcemap: true,
      
      // 关闭CSS代码分割，确保样式完整加载
      cssCodeSplit: false
    },
    
    // 开发服务器配置
    server: {
      port: isMicroMode ? 3001 : 5173,
      cors: true,
      
      // 配置允许跨域的headers
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'DNT,X-Mx-ReqToken,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type'
      }
    },
    
    // 预览模式配置
    preview: {
      port: isMicroMode ? 3001 : 4173,
      cors: true,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    }
  }
})
