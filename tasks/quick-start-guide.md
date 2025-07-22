# DrawDB微前端集成快速开始指南

## 第一步：DrawDB子应用改造

### 1.1 安装微前端依赖
```bash
cd drawdb
npm install qiankun
```

### 1.2 创建微前端入口文件
创建 `src/micro-main.jsx`：
```javascript
import ReactDOM from "react-dom/client";
import { LocaleProvider } from "@douyinfe/semi-ui";
import App from "./App.jsx";
import en_US from "@douyinfe/semi-ui/lib/es/locale/source/en_US";
import "./index.css";
import "./i18n/i18n.js";

let root = null;

function render(props = {}) {
  const { container } = props;
  const containerElement = container 
    ? container.querySelector('#drawdb-root') 
    : document.getElementById('root');

  if (!containerElement) return;

  root = ReactDOM.createRoot(containerElement);
  root.render(
    <LocaleProvider locale={en_US}>
      <App microProps={props} />
    </LocaleProvider>
  );
}

// 独立运行
if (!window.__POWERED_BY_QIANKUN__) {
  render();
}

// 微前端生命周期
export async function bootstrap() {
  console.log('[DrawDB] bootstrap');
}

export async function mount(props) {
  console.log('[DrawDB] mount', props);
  render(props);
}

export async function unmount(props) {
  console.log('[DrawDB] unmount', props);
  if (root) {
    root.unmount();
    root = null;
  }
}

// 设置 webpack public path
if (window.__POWERED_BY_QIANKUN__) {
  __webpack_public_path__ = window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__;
}
```

### 1.3 修改 App.jsx 支持微前端
```javascript
import { BrowserRouter, Routes, Route, HashRouter } from "react-router-dom";
import { useLayoutEffect } from "react";
import Editor from "./pages/Editor";
import Templates from "./pages/Templates";
import SettingsContextProvider from "./context/SettingsContext";

export default function App({ microProps }) {
  // 微前端模式使用 HashRouter 避免路由冲突
  const Router = window.__POWERED_BY_QIANKUN__ ? HashRouter : BrowserRouter;
  const basename = window.__POWERED_BY_QIANKUN__ ? '/' : '/';

  return (
    <SettingsContextProvider microProps={microProps}>
      <Router basename={basename}>
        <RestoreScroll />
        <Routes>
          <Route path="/" element={<Editor />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="*" element={<Editor />} />
        </Routes>
      </Router>
    </SettingsContextProvider>
  );
}

function RestoreScroll() {
  const location = useLocation();
  useLayoutEffect(() => {
    if (!window.__POWERED_BY_QIANKUN__) {
      window.scroll(0, 0);
    }
  }, [location.pathname]);
  return null;
}
```

### 1.4 修改 vite.config.js
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        micro: 'src/micro-main.jsx' // 微前端入口
      },
      output: {
        format: 'system', // SystemJS 格式
        entryFileNames: 'js/[name].js',
        chunkFileNames: 'js/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash][extname]'
      },
    },
    target: 'esnext',
    minify: false
  },
  server: {
    port: 3001,
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    }
  }
})
```

### 1.5 添加构建脚本到 package.json
```json
{
  "scripts": {
    "build:micro": "vite build --mode=micro",
    "dev:micro": "vite --mode=micro"
  }
}
```

## 第二步：创建Vue组件

### 2.1 创建 DrawDB Vue组件
创建 `src/components/DrawDBEditor.vue`：
```vue
<template>
  <div class="drawdb-editor" :style="containerStyle">
    <div 
      ref="container" 
      class="drawdb-container"
      :id="containerId"
    >
      <div id="drawdb-root"></div>
    </div>
    
    <!-- 加载状态 -->
    <div v-if="loading" class="loading-overlay">
      <div class="spinner"></div>
      <p>正在加载数据建模工具...</p>
    </div>
    
    <!-- 错误状态 -->
    <div v-if="error" class="error-overlay">
      <p>加载失败: {{ error.message }}</p>
      <button @click="reload">重新加载</button>
    </div>
  </div>
</template>

<script>
import { loadMicroApp } from 'qiankun';

export default {
  name: 'DrawDBEditor',
  props: {
    // 容器样式
    width: {
      type: String,
      default: '100%'
    },
    height: {
      type: String,
      default: '600px'
    },
    // 初始化数据
    modelData: {
      type: Object,
      default: () => ({})
    },
    // 子应用URL
    entry: {
      type: String,
      default: process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3001' 
        : '/static/drawdb/'
    }
  },
  data() {
    return {
      microApp: null,
      loading: false,
      error: null,
      containerId: `drawdb-${Date.now()}`
    }
  },
  computed: {
    containerStyle() {
      return {
        width: this.width,
        height: this.height,
        position: 'relative'
      }
    }
  },
  mounted() {
    this.loadMicroApp();
  },
  beforeUnmount() {
    if (this.microApp) {
      this.microApp.unmount();
    }
  },
  watch: {
    modelData: {
      handler(newData) {
        this.sendDataToChild('importData', newData);
      },
      deep: true
    }
  },
  methods: {
    async loadMicroApp() {
      this.loading = true;
      this.error = null;
      
      try {
        this.microApp = loadMicroApp({
          name: 'drawdb-editor',
          entry: this.entry,
          container: `#${this.containerId}`,
          props: {
            // 传递给子应用的属性
            onSave: this.handleSave,
            onDataChange: this.handleDataChange,
            onError: this.handleError,
            initialData: this.modelData
          }
        });
        
        await this.microApp.mountPromise;
        this.loading = false;
        this.$emit('ready');
        
      } catch (error) {
        console.error('DrawDB加载失败:', error);
        this.error = error;
        this.loading = false;
        this.$emit('error', error);
      }
    },
    
    // 处理子应用保存事件
    handleSave(data) {
      this.$emit('save', data);
    },
    
    // 处理子应用数据变化
    handleDataChange(data) {
      this.$emit('model-change', data);
    },
    
    // 处理子应用错误
    handleError(error) {
      this.$emit('error', error);
    },
    
    // 向子应用发送消息
    sendDataToChild(action, data) {
      if (this.microApp && window.qiankunGlobalState) {
        window.qiankunGlobalState.setGlobalState({
          drawdbAction: {
            type: action,
            payload: data,
            timestamp: Date.now()
          }
        });
      }
    },
    
    // 重新加载
    async reload() {
      if (this.microApp) {
        await this.microApp.unmount();
      }
      await this.loadMicroApp();
    },
    
    // 导出当前模型数据
    exportModel() {
      return new Promise((resolve) => {
        const handleExport = (data) => {
          resolve(data);
          // 清理监听器
          if (window.qiankunGlobalState) {
            window.qiankunGlobalState.offGlobalStateChange(handleExport);
          }
        };
        
        if (window.qiankunGlobalState) {
          window.qiankunGlobalState.onGlobalStateChange((value, prev) => {
            if (value.drawdbExport && value.drawdbExport.timestamp !== prev.drawdbExport?.timestamp) {
              handleExport(value.drawdbExport.data);
            }
          });
          
          // 请求导出
          this.sendDataToChild('exportData', {});
        }
      });
    },
    
    // 导入模型数据
    importModel(data) {
      this.sendDataToChild('importData', data);
    }
  }
}
</script>

<style scoped>
.drawdb-editor {
  position: relative;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.drawdb-container {
  width: 100%;
  height: 100%;
}

.loading-overlay,
.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.9);
  z-index: 1000;
}

.spinner {
  border: 4px solid #f3f3f3;
  border-radius: 50%;
  border-top: 4px solid #3498db;
  width: 40px;
  height: 40px;
  animation: spin 2s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-overlay button {
  margin-top: 16px;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background-color: #3498db;
  color: white;
  cursor: pointer;
}
</style>
```

## 第三步：主应用配置

### 3.1 安装依赖
```bash
npm install qiankun
```

### 3.2 配置主应用 main.js
```javascript
import { createApp } from 'vue'
import { initGlobalState } from 'qiankun'
import App from './App.vue'

// 初始化全局状态管理
const globalState = initGlobalState({
  drawdbAction: null,
  drawdbExport: null
});

// 监听状态变化
globalState.onGlobalStateChange((value, prev) => {
  console.log('微前端状态变化:', value, prev);
});

// 暴露到全局
window.qiankunGlobalState = globalState;

const app = createApp(App)
app.mount('#app')
```

## 第四步：使用示例

### 4.1 基础使用
```vue
<template>
  <div class="my-app">
    <h1>数据库建模工具</h1>
    
    <DrawDBEditor
      width="100%"
      height="800px"
      :model-data="currentModel"
      @save="handleSave"
      @model-change="handleModelChange"
      @error="handleError"
      @ready="handleReady"
    />
    
    <div class="actions">
      <button @click="exportCurrentModel">导出模型</button>
      <button @click="loadSampleModel">加载示例</button>
    </div>
  </div>
</template>

<script>
import DrawDBEditor from '@/components/DrawDBEditor.vue'

export default {
  components: {
    DrawDBEditor
  },
  data() {
    return {
      currentModel: {},
      isReady: false
    }
  },
  methods: {
    handleSave(modelData) {
      console.log('保存模型:', modelData)
      // 发送到后端保存
      this.saveToBackend(modelData)
    },
    
    handleModelChange(modelData) {
      console.log('模型变化:', modelData)
      this.currentModel = modelData
    },
    
    handleError(error) {
      console.error('DrawDB错误:', error)
      this.$message.error('数据建模工具加载失败')
    },
    
    handleReady() {
      console.log('DrawDB已准备就绪')
      this.isReady = true
    },
    
    async exportCurrentModel() {
      if (this.isReady) {
        const modelData = await this.$refs.drawdbEditor.exportModel()
        console.log('导出的模型:', modelData)
        this.downloadFile(JSON.stringify(modelData, null, 2), 'model.json')
      }
    },
    
    loadSampleModel() {
      const sampleModel = {
        tables: [
          {
            id: 1,
            name: 'users',
            fields: [
              { id: 1, name: 'id', type: 'INTEGER', primaryKey: true },
              { id: 2, name: 'name', type: 'VARCHAR(100)' },
              { id: 3, name: 'email', type: 'VARCHAR(255)' }
            ]
          }
        ],
        relationships: []
      }
      this.currentModel = sampleModel
    },
    
    downloadFile(content, filename) {
      const blob = new Blob([content], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    },
    
    async saveToBackend(modelData) {
      try {
        await fetch('/api/models', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(modelData)
        })
        this.$message.success('模型保存成功')
      } catch (error) {
        this.$message.error('模型保存失败')
      }
    }
  }
}
</script>
```

## 第五步：生产环境部署

### 5.1 构建DrawDB子应用
```bash
cd drawdb
npm run build:micro
```

### 5.2 Nginx配置
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # Vue主应用
    location / {
        root /var/www/vue-app/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # DrawDB子应用静态资源
    location /static/drawdb/ {
        alias /var/www/drawdb/dist/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin "*";
    }
}
```

## API文档

### DrawDBEditor 组件属性

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| width | String | '100%' | 组件宽度 |
| height | String | '600px' | 组件高度 |
| modelData | Object | {} | 初始模型数据 |
| entry | String | auto | 子应用入口URL |

### DrawDBEditor 组件事件

| 事件 | 参数 | 描述 |
|------|------|------|
| save | modelData | 用户点击保存时触发 |
| model-change | modelData | 模型数据变化时触发 |
| error | error | 发生错误时触发 |
| ready | - | 组件加载完成时触发 |

### DrawDBEditor 组件方法

| 方法 | 参数 | 返回值 | 描述 |
|------|------|--------|------|
| exportModel() | - | Promise\<Object\> | 导出当前模型数据 |
| importModel(data) | Object | - | 导入模型数据 |
| reload() | - | Promise | 重新加载组件 |

现在你就可以在Vue项目中像使用普通组件一样使用DrawDB数据建模工具了！