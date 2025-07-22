<template>
  <div class="drawdb-editor" :style="containerStyle">
    <div class="header">
      <h3>DrawDB 微前端测试</h3>
      <div class="controls">
        <button @click="loadMicroApp" :disabled="loading">
          {{ microApp ? '重新加载' : '加载DrawDB' }}
        </button>
        <button @click="exportData" :disabled="!ready">导出数据</button>
        <button @click="importSampleData" :disabled="!ready">导入示例</button>
      </div>
    </div>
    
    <div 
      ref="container" 
      class="drawdb-container"
      :id="containerId"
    >
      <div id="drawdb-root"></div>
    </div>
    
    <!-- 状态显示 -->
    <div class="status-bar">
      <div class="status-item">
        <span class="label">状态:</span>
        <span :class="['status', statusClass]">{{ status }}</span>
      </div>
      <div class="status-item">
        <span class="label">表数量:</span>
        <span class="value">{{ tableCount }}</span>
      </div>
      <div class="status-item">
        <span class="label">关系数量:</span>
        <span class="value">{{ relationshipCount }}</span>
      </div>
    </div>
    
    <!-- 消息日志 -->
    <div class="message-log">
      <h4>通信日志</h4>
      <div class="log-content">
        <div 
          v-for="(msg, index) in messages" 
          :key="index" 
          :class="['log-item', msg.type]"
        >
          <span class="timestamp">{{ formatTime(msg.timestamp) }}</span>
          <span class="type">{{ msg.type.toUpperCase() }}</span>
          <span class="content">{{ msg.content }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { loadMicroApp, initGlobalState } from 'qiankun';

export default {
  name: 'DrawDBEditor',
  data() {
    return {
      microApp: null,
      loading: false,
      ready: false,
      status: '未加载',
      containerId: `drawdb-${Date.now()}`,
      tableCount: 0,
      relationshipCount: 0,
      messages: [],
      globalState: null
    }
  },
  computed: {
    containerStyle() {
      return {
        width: '100%',
        height: '600px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        overflow: 'hidden'
      }
    },
    statusClass() {
      switch (this.status) {
        case '已就绪': return 'ready';
        case '加载中': return 'loading';
        case '错误': return 'error';
        default: return 'idle';
      }
    }
  },
  mounted() {
    this.initGlobalState();
  },
  beforeUnmount() {
    if (this.microApp) {
      this.microApp.unmount();
    }
  },
  methods: {
    initGlobalState() {
      // 初始化全局状态
      this.globalState = initGlobalState({
        'drawdb-import': null,
        'drawdb-export-request': null,
        'drawdb-data-change': null,
        'drawdb-save': null,
        'drawdb-ready': null,
        'drawdb-error': null
      });
      
      // 监听状态变化
      this.globalState.onGlobalStateChange((value, prev) => {
        Object.keys(value).forEach(key => {
          if (value[key] !== prev[key] && value[key]) {
            this.handleMicroAppMessage(key, value[key]);
          }
        });
      });
      
      // 暴露到全局供子应用使用
      window.qiankunGlobalState = this.globalState;
    },
    
    async loadMicroApp() {
      this.loading = true;
      this.status = '加载中';
      this.addMessage('system', 'LOADING', '开始加载DrawDB微前端应用...');
      
      try {
        if (this.microApp) {
          await this.microApp.unmount();
        }
        
        this.microApp = loadMicroApp({
          name: 'drawdb-editor',
          entry: 'http://localhost:3001',
          container: `#${this.containerId}`,
          props: {
            // 传递给子应用的属性
            onSave: this.handleSave,
            onDataChange: this.handleDataChange,
            onError: this.handleError
          }
        });
        
        await this.microApp.mountPromise;
        this.addMessage('system', 'SUCCESS', 'DrawDB微前端应用加载成功');
        
      } catch (error) {
        console.error('DrawDB加载失败:', error);
        this.status = '错误';
        this.addMessage('system', 'ERROR', `加载失败: ${error.message}`);
      } finally {
        this.loading = false;
      }
    },
    
    handleMicroAppMessage(eventName, data) {
      console.log('收到子应用消息:', eventName, data);
      
      switch (eventName) {
        case 'drawdb-ready':
          this.status = '已就绪';
          this.ready = true;
          this.addMessage('micro', 'READY', 'DrawDB应用已就绪');
          break;
          
        case 'drawdb-data-change':
          if (data.data && data.data.diagram) {
            const { tables = [], relationships = [] } = data.data.diagram;
            this.tableCount = tables.length;
            this.relationshipCount = relationships.length;
            this.addMessage('micro', 'DATA_CHANGE', `数据更新 - 表:${tables.length}, 关系:${relationships.length}`);
          }
          break;
          
        case 'drawdb-save':
          this.addMessage('micro', 'SAVE', '用户触发保存操作');
          break;
          
        case 'drawdb-export':
          if (data.data && data.data.diagram) {
            this.handleExportData(data.data.diagram);
          }
          break;
          
        case 'drawdb-error':
          this.addMessage('micro', 'ERROR', `子应用错误: ${data.data?.message || '未知错误'}`);
          break;
      }
    },
    
    exportData() {
      if (!this.ready) return;
      
      this.addMessage('vue', 'EXPORT_REQUEST', '请求导出数据...');
      this.globalState.setGlobalState({
        'drawdb-export-request': {
          timestamp: Date.now(),
          source: 'vue'
        }
      });
    },
    
    handleExportData(diagramData) {
      console.log('导出的数据:', diagramData);
      this.addMessage('vue', 'EXPORT_SUCCESS', '数据导出成功');
      
      // 下载JSON文件
      const dataStr = JSON.stringify(diagramData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `drawdb-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    
    importSampleData() {
      if (!this.ready) return;
      
      const sampleData = {
        tables: [
          {
            id: 1,
            name: 'users',
            x: 100,
            y: 100,
            locked: false,
            fields: [
              { id: 1, name: 'id', type: 'INTEGER', primary: true, notNull: true },
              { id: 2, name: 'name', type: 'VARCHAR(100)', notNull: true },
              { id: 3, name: 'email', type: 'VARCHAR(255)', unique: true }
            ],
            comment: '用户表'
          },
          {
            id: 2,
            name: 'posts',
            x: 400,
            y: 100,
            locked: false,
            fields: [
              { id: 1, name: 'id', type: 'INTEGER', primary: true, notNull: true },
              { id: 2, name: 'title', type: 'VARCHAR(200)', notNull: true },
              { id: 3, name: 'content', type: 'TEXT' },
              { id: 4, name: 'user_id', type: 'INTEGER', notNull: true }
            ],
            comment: '文章表'
          }
        ],
        relationships: [
          {
            id: 0,
            name: 'fk_posts_user_id',
            startTableId: 2,
            endTableId: 1,
            startFieldId: 4,
            endFieldId: 1,
            cardinality: 'Many-to-One'
          }
        ],
        database: 'GENERIC'
      };
      
      this.addMessage('vue', 'IMPORT', '导入示例数据...');
      this.globalState.setGlobalState({
        'drawdb-import': {
          diagram: sampleData,
          timestamp: Date.now(),
          source: 'vue'
        }
      });
    },
    
    addMessage(source, type, content) {
      this.messages.unshift({
        source,
        type: type.toLowerCase(),
        content,
        timestamp: Date.now()
      });
      
      // 限制日志数量
      if (this.messages.length > 50) {
        this.messages = this.messages.slice(0, 50);
      }
    },
    
    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString();
    }
  }
}
</script>

<style scoped>
.drawdb-editor {
  padding: 16px;
  font-family: Arial, sans-serif;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eee;
}

.controls {
  display: flex;
  gap: 8px;
}

button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
}

button:hover:not(:disabled) {
  background: #f5f5f5;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.drawdb-container {
  margin-bottom: 16px;
  background: #f9f9f9;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.status-bar {
  display: flex;
  gap: 24px;
  padding: 8px 16px;
  background: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 16px;
}

.status-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.label {
  font-weight: bold;
  color: #666;
}

.status {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.status.idle { background: #f0f0f0; color: #666; }
.status.loading { background: #e3f2fd; color: #1976d2; }
.status.ready { background: #e8f5e8; color: #388e3c; }
.status.error { background: #ffebee; color: #d32f2f; }

.value {
  font-weight: bold;
  color: #333;
}

.message-log {
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
}

.message-log h4 {
  margin: 0;
  padding: 8px 12px;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
}

.log-content {
  max-height: 200px;
  overflow-y: auto;
  padding: 8px;
}

.log-item {
  display: flex;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px solid #f0f0f0;
  font-size: 12px;
  align-items: center;
}

.log-item:last-child {
  border-bottom: none;
}

.timestamp {
  color: #999;
  min-width: 70px;
}

.type {
  min-width: 60px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: bold;
  text-align: center;
}

.type.system { background: #e3f2fd; color: #1976d2; }
.type.micro { background: #e8f5e8; color: #388e3c; }
.type.vue { background: #fff3e0; color: #f57c00; }
.type.error { background: #ffebee; color: #d32f2f; }

.content {
  flex: 1;
  color: #333;
}
</style>