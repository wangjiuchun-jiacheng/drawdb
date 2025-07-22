# DrawDB微前端化实施方案

## 项目分析

### 当前架构
- **技术栈**: React 18 + Vite + React Router
- **UI库**: Semi-UI + Tailwind CSS
- **状态管理**: React Context
- **主要路由**:
  - `/` - 落地页
  - `/editor` - 核心编辑器功能
  - `/templates` - 模板页
  - `/bug-report` - 反馈页

### 核心需求
将DrawDB作为微前端子应用，嵌入到Vue主应用中，提供Vue组件调用接口。

## 技术方案选择

### 推荐方案: qiankun + Single SPA

**选择理由**:
1. ✅ 成熟稳定，阿里开源生态
2. ✅ 完善的React/Vue跨框架支持  
3. ✅ 强大的JS/CSS沙箱隔离
4. ✅ 丰富的生命周期钩子
5. ✅ 应用间通信机制完善

**备选方案**:
- **Module Federation**: 适合Webpack 5项目
- **iframe**: 简单但通信受限
- **Web Components**: 标准化但兼容性待考虑

## 实施计划

### 阶段一：DrawDB子应用改造

#### 1.1 安装qiankun依赖
```bash
npm install qiankun
```

#### 1.2 修改入口文件 (src/main.jsx)
```javascript
import ReactDOM from "react-dom/client";
import { LocaleProvider } from "@douyinfe/semi-ui";
import App from "./App.jsx";
import en_US from "@douyinfe/semi-ui/lib/es/locale/source/en_US";
import "./index.css";
import "./i18n/i18n.js";

// 微前端生命周期函数
function render(props) {
  const { container } = props;
  const containerElement = container 
    ? container.querySelector('#drawdb-root') 
    : document.getElementById('root');

  const root = ReactDOM.createRoot(containerElement);
  root.render(
    <LocaleProvider locale={en_US}>
      <App />
    </LocaleProvider>
  );
  
  return root;
}

// 独立运行时
if (!window.__POWERED_BY_QIANKUN__) {
  render({});
}

// 微前端生命周期
export async function bootstrap() {
  console.log('DrawDB bootstrap');
}

export async function mount(props) {
  console.log('DrawDB mount', props);
  render(props);
}

export async function unmount(props) {
  console.log('DrawDB unmount', props);
  const { container } = props;
  const containerElement = container 
    ? container.querySelector('#drawdb-root') 
    : document.getElementById('root');
  
  if (containerElement) {
    ReactDOM.unmountComponentAtNode(containerElement);
  }
}
```

#### 1.3 修改路由配置 (src/App.jsx)
```javascript
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
// ... 其他导入

export default function App() {
  // 获取基础路径，微前端模式下从props获取
  const basename = window.__POWERED_BY_QIANKUN__ ? '/drawdb' : '/';
  
  return (
    <SettingsContextProvider>
      <BrowserRouter basename={basename}>
        <RestoreScroll />
        <Routes>
          <Route path="/" element={<Editor />} /> {/* 直接进入编辑器 */}
          <Route path="/templates" element={<Templates />} />
          <Route path="*" element={<Editor />} />
        </Routes>
      </BrowserRouter>
    </SettingsContextProvider>
  );
}
```

#### 1.4 修改Vite配置 (vite.config.js)
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig(({ command, mode }) => {
  const isBuild = command === 'build';
  
  return {
    plugins: [react()],
    base: './',
    build: {
      rollupOptions: {
        external: isBuild ? [] : ['react', 'react-dom'],
        output: {
          // UMD格式，便于微前端加载
          format: 'umd',
          name: 'DrawDB',
          entryFileNames: 'js/[name].js',
          chunkFileNames: 'js/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]'
        }
      },
      // 生成sourcemap便于调试
      sourcemap: true,
    },
    server: {
      port: 3001,
      cors: true,
      // 配置头部允许微前端加载
      headers: {
        'Access-Control-Allow-Origin': '*',
      }
    }
  }
})
```

#### 1.5 修改index.html
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DrawDB</title>
  </head>
  <body>
    <div id="root">
      <!-- 微前端容器 -->
      <div id="drawdb-root"></div>
    </div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

### 阶段二：Vue主应用集成

#### 2.1 安装qiankun主应用依赖
```bash
npm install qiankun
```

#### 2.2 创建Vue组件 (components/DrawDBEditor.vue)
```vue
<template>
  <div class="drawdb-container">
    <div ref="microAppContainer" id="drawdb-micro-app"></div>
  </div>
</template>

<script>
import { registerMicroApps, start, loadMicroApp } from 'qiankun';

export default {
  name: 'DrawDBEditor',
  props: {
    // 传递给子应用的数据
    initData: {
      type: Object,
      default: () => ({})
    },
    // 子应用路由
    path: {
      type: String,
      default: '/'
    }
  },
  data() {
    return {
      microApp: null
    }
  },
  async mounted() {
    await this.loadDrawDB();
  },
  async beforeUnmount() {
    if (this.microApp) {
      this.microApp.unmount();
    }
  },
  methods: {
    async loadDrawDB() {
      try {
        this.microApp = loadMicroApp({
          name: 'drawdb',
          entry: process.env.NODE_ENV === 'development' 
            ? 'http://localhost:3001' 
            : '/drawdb/',
          container: this.$refs.microAppContainer,
          props: {
            initData: this.initData,
            onDataChange: this.handleDataChange,
            onSave: this.handleSave
          }
        });
      } catch (error) {
        console.error('加载DrawDB失败:', error);
        this.$emit('load-error', error);
      }
    },
    
    // 处理子应用数据变化
    handleDataChange(data) {
      this.$emit('data-change', data);
    },
    
    // 处理保存事件
    handleSave(data) {
      this.$emit('save', data);
    },
    
    // 导出数据
    exportData() {
      // 通过全局通信机制获取子应用数据
      return window.qiankunGlobalState?.drawdbData || {};
    },
    
    // 导入数据
    importData(data) {
      // 向子应用发送数据
      if (window.qiankunGlobalState) {
        window.qiankunGlobalState.setGlobalState({
          drawdbImport: data
        });
      }
    }
  }
}
</script>

<style scoped>
.drawdb-container {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

#drawdb-micro-app {
  width: 100%;
  height: 100%;
}
</style>
```

#### 2.3 主应用入口配置 (main.js)
```javascript
import { createApp } from 'vue';
import { registerMicroApps, start, initGlobalState } from 'qiankun';
import App from './App.vue';

const app = createApp(App);

// 初始化全局状态
const globalState = initGlobalState({
  drawdbData: null,
  drawdbImport: null
});

// 监听全局状态变化
globalState.onGlobalStateChange((value, prev) => {
  console.log('全局状态变化:', value, prev);
});

// 暴露到window供组件使用
window.qiankunGlobalState = globalState;

// 注册微应用
registerMicroApps([
  {
    name: 'drawdb',
    entry: process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3001' 
      : '/drawdb/',
    container: '#drawdb-micro-app',
    activeRule: '/drawdb'
  }
]);

// 启动qiankun
start({
  sandbox: {
    strictStyleIsolation: true,
    experimentalStyleIsolation: true
  }
});

app.mount('#app');
```

### 阶段三：应用间通信

#### 3.1 子应用通信接口 (src/utils/microapp-bridge.js)
```javascript
// 微前端通信桥接
export class MicroAppBridge {
  constructor() {
    this.globalState = window.qiankunGlobalState;
    this.listeners = new Map();
    
    // 监听全局状态变化
    if (this.globalState) {
      this.globalState.onGlobalStateChange(this.handleGlobalStateChange.bind(this));
    }
  }
  
  // 向主应用发送数据
  emitToParent(eventName, data) {
    if (this.globalState) {
      this.globalState.setGlobalState({
        [eventName]: {
          timestamp: Date.now(),
          data
        }
      });
    }
  }
  
  // 监听来自主应用的事件
  onParentEvent(eventName, callback) {
    this.listeners.set(eventName, callback);
  }
  
  // 处理全局状态变化
  handleGlobalStateChange(value, prev) {
    this.listeners.forEach((callback, eventName) => {
      if (value[eventName] !== prev[eventName]) {
        callback(value[eventName]?.data);
      }
    });
  }
  
  // 发送保存事件
  save(data) {
    this.emitToParent('drawdb-save', data);
  }
  
  // 发送数据变化事件
  dataChange(data) {
    this.emitToParent('drawdb-data-change', data);
  }
}

export const microBridge = new MicroAppBridge();
```

#### 3.2 在DrawDB中使用通信
```javascript
// src/context/DiagramContext.jsx 中添加
import { microBridge } from '../utils/microapp-bridge';

// 在数据变化时通知主应用
const updateDiagram = (newData) => {
  setDiagram(newData);
  
  // 通知主应用数据变化
  if (window.__POWERED_BY_QIANKUN__) {
    microBridge.dataChange(newData);
  }
};

// 监听主应用的导入事件
useEffect(() => {
  if (window.__POWERED_BY_QIANKUN__) {
    microBridge.onParentEvent('drawdbImport', (importData) => {
      if (importData) {
        setDiagram(importData);
      }
    });
  }
}, []);
```

## 使用示例

### Vue主应用中使用DrawDB
```vue
<template>
  <div>
    <h1>我的数据建模工具</h1>
    
    <!-- DrawDB编辑器组件 -->
    <DrawDBEditor
      :init-data="initialData"
      @data-change="handleDataChange"
      @save="handleSave"
      @load-error="handleLoadError"
      ref="drawdbRef"
    />
    
    <div class="actions">
      <button @click="exportSchema">导出Schema</button>
      <button @click="importSchema">导入Schema</button>
    </div>
  </div>
</template>

<script>
import DrawDBEditor from '@/components/DrawDBEditor.vue';

export default {
  components: {
    DrawDBEditor
  },
  data() {
    return {
      initialData: {
        // 初始数据结构
      }
    }
  },
  methods: {
    handleDataChange(data) {
      console.log('Schema发生变化:', data);
      // 可以实时保存到后端
    },
    
    handleSave(data) {
      console.log('用户点击保存:', data);
      // 保存到数据库
    },
    
    handleLoadError(error) {
      console.error('DrawDB加载失败:', error);
    },
    
    exportSchema() {
      const data = this.$refs.drawdbRef.exportData();
      console.log('导出的数据:', data);
    },
    
    importSchema() {
      const data = { /* 从后端获取的数据 */ };
      this.$refs.drawdbRef.importData(data);
    }
  }
}
</script>
```

## 部署配置

### 开发环境
1. 启动DrawDB子应用：`cd drawdb && npm run dev`
2. 启动Vue主应用：`cd vue-app && npm run serve`

### 生产环境
```nginx
# Nginx配置示例
server {
    listen 80;
    server_name your-domain.com;
    
    # 主应用
    location / {
        root /var/www/vue-app/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # DrawDB子应用
    location /drawdb/ {
        root /var/www/drawdb/dist;
        try_files $uri $uri/ /index.html;
        
        # 设置CORS头
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods 'GET, POST, OPTIONS';
        add_header Access-Control-Allow-Headers 'DNT,X-Mx-ReqToken,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type';
    }
}
```

## 优势总结

✅ **技术解耦** - React和Vue应用独立开发部署  
✅ **功能复用** - DrawDB可被多个Vue项目集成使用  
✅ **渐进升级** - 可以逐步迁移不同模块到微前端架构  
✅ **团队协作** - 不同团队可以使用熟悉的技术栈  
✅ **性能隔离** - 应用间样式和JS隔离，避免冲突

## 下一步行动

- [ ] 实施DrawDB子应用改造
- [ ] 开发Vue组件封装
- [ ] 建立应用间通信机制
- [ ] 配置开发和生产环境
- [ ] 编写详细的API文档