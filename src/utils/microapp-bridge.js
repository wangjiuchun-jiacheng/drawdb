/**
 * 微前端通信桥接器
 * 用于DrawDB子应用与Vue主应用之间的数据通信
 */
export class MicroAppBridge {
  constructor() {
    this.globalState = null;
    this.listeners = new Map();
    this.messageQueue = [];
    
    // 延迟初始化，等待qiankun环境准备就绪
    this.initializeGlobalState();
  }
  
  initializeGlobalState() {
    // 检查是否在微前端环境中
    if (!window.__POWERED_BY_QIANKUN__) {
      console.log('[MicroAppBridge] 当前运行在独立模式，通信桥接已禁用');
      return;
    }
    
    // 尝试获取全局状态管理器
    const checkGlobalState = () => {
      if (window.qiankunGlobalState) {
        this.globalState = window.qiankunGlobalState;
        this.setupGlobalStateListener();
        this.processMessageQueue();
        console.log('[MicroAppBridge] 通信桥接已建立');
      } else {
        // 如果全局状态还未准备就绪，延迟重试
        setTimeout(checkGlobalState, 100);
      }
    };
    
    checkGlobalState();
  }
  
  setupGlobalStateListener() {
    if (this.globalState) {
      this.globalState.onGlobalStateChange(this.handleGlobalStateChange.bind(this));
    }
  }
  
  /**
   * 向主应用发送消息
   * @param {string} eventName 事件名称
   * @param {*} data 数据内容
   */
  emitToParent(eventName, data) {
    const message = {
      eventName,
      data,
      timestamp: Date.now(),
      source: 'drawdb'
    };
    
    if (this.globalState) {
      try {
        this.globalState.setGlobalState({
          [eventName]: message
        });
        console.log('[MicroAppBridge] 消息已发送:', eventName, data);
      } catch (error) {
        console.error('[MicroAppBridge] 发送消息失败:', error);
      }
    } else {
      // 如果全局状态还未准备就绪，将消息加入队列
      this.messageQueue.push(message);
      console.log('[MicroAppBridge] 消息已加入队列:', eventName);
    }
  }
  
  /**
   * 监听来自主应用的事件
   * @param {string} eventName 事件名称
   * @param {Function} callback 回调函数
   */
  onParentEvent(eventName, callback) {
    if (typeof callback !== 'function') {
      console.error('[MicroAppBridge] 回调函数无效');
      return;
    }
    
    this.listeners.set(eventName, callback);
    console.log('[MicroAppBridge] 已注册事件监听器:', eventName);
  }
  
  /**
   * 移除事件监听器
   * @param {string} eventName 事件名称
   */
  offParentEvent(eventName) {
    this.listeners.delete(eventName);
    console.log('[MicroAppBridge] 已移除事件监听器:', eventName);
  }
  
  /**
   * 处理全局状态变化
   * @param {Object} value 新值
   * @param {Object} prev 旧值
   */
  handleGlobalStateChange(value, prev) {
    this.listeners.forEach((callback, eventName) => {
      const currentMessage = value[eventName];
      const prevMessage = prev[eventName];
      
      // 检查消息是否更新且不是自己发送的
      if (currentMessage && 
          currentMessage !== prevMessage && 
          currentMessage.source !== 'drawdb') {
        try {
          callback(currentMessage.data, currentMessage);
        } catch (error) {
          console.error(`[MicroAppBridge] 处理事件回调出错 ${eventName}:`, error);
        }
      }
    });
  }
  
  /**
   * 处理消息队列
   */
  processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.emitToParent(message.eventName, message.data);
    }
  }
  
  /**
   * 发送保存事件
   * @param {Object} diagramData 图表数据
   */
  save(diagramData) {
    this.emitToParent('drawdb-save', {
      type: 'save',
      diagram: diagramData,
      timestamp: Date.now()
    });
  }
  
  /**
   * 发送数据变化事件
   * @param {Object} diagramData 图表数据
   */
  dataChange(diagramData) {
    // 防抖处理，避免频繁发送
    if (this.dataChangeTimer) {
      clearTimeout(this.dataChangeTimer);
    }
    
    this.dataChangeTimer = setTimeout(() => {
      this.emitToParent('drawdb-data-change', {
        type: 'dataChange',
        diagram: diagramData,
        timestamp: Date.now()
      });
    }, 500); // 500ms防抖
  }
  
  /**
   * 发送导出数据响应
   * @param {Object} diagramData 图表数据
   */
  exportData(diagramData) {
    this.emitToParent('drawdb-export', {
      type: 'export',
      diagram: diagramData,
      timestamp: Date.now()
    });
  }
  
  /**
   * 发送错误信息
   * @param {Error|string} error 错误信息
   */
  error(error) {
    const errorData = {
      type: 'error',
      message: error?.message || error?.toString() || '未知错误',
      stack: error?.stack,
      timestamp: Date.now()
    };
    
    this.emitToParent('drawdb-error', errorData);
  }
  
  /**
   * 发送准备就绪信号
   */
  ready() {
    this.emitToParent('drawdb-ready', {
      type: 'ready',
      timestamp: Date.now()
    });
  }
  
  /**
   * 清理资源
   */
  destroy() {
    if (this.dataChangeTimer) {
      clearTimeout(this.dataChangeTimer);
    }
    this.listeners.clear();
    this.messageQueue = [];
    console.log('[MicroAppBridge] 通信桥接已销毁');
  }
}

// 创建全局单例
export const microBridge = new MicroAppBridge();

// 在开发模式下暴露到全局便于调试
if (import.meta.env.DEV) {
  window.__DRAWDB_MICRO_BRIDGE__ = microBridge;
}