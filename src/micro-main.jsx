import ReactDOM from "react-dom/client";
import { LocaleProvider } from "@douyinfe/semi-ui";
import App from "./App.jsx";
import en_US from "@douyinfe/semi-ui/lib/es/locale/source/en_US";
import "./index.css";
import "./i18n/i18n.js";

let root = null;

function render(props = {}) {
  const { container } = props;
  
  // 确定容器元素
  let containerElement;
  if (container) {
    // 微前端模式：使用传入的容器
    containerElement = container.querySelector('#drawdb-root') || container;
  } else {
    // 独立模式：使用默认容器
    containerElement = document.getElementById('root');
  }

  if (!containerElement) {
    console.error('DrawDB: 无法找到容器元素');
    return;
  }

  // 创建React应用根节点
  root = ReactDOM.createRoot(containerElement);
  root.render(
    <LocaleProvider locale={en_US}>
      <App microProps={props} />
    </LocaleProvider>
  );
  
  console.log('[DrawDB] 应用已渲染到容器:', containerElement);
}

// 独立运行模式（非微前端）
if (!window.__POWERED_BY_QIANKUN__) {
  console.log('[DrawDB] 独立运行模式');
  render();
}

// 微前端生命周期钩子
export async function bootstrap() {
  console.log('[DrawDB] 微前端应用启动 - bootstrap');
}

export async function mount(props) {
  console.log('[DrawDB] 微前端应用挂载 - mount', props);
  render(props);
}

export async function unmount(props) {
  console.log('[DrawDB] 微前端应用卸载 - unmount', props);
  
  if (root) {
    // 卸载React应用
    setTimeout(() => {
      root.unmount();
      root = null;
    }, 100);
  }
}

// 配置webpack公共路径（如果使用webpack）
if (window.__POWERED_BY_QIANKUN__) {
  // eslint-disable-next-line no-undef
  __webpack_public_path__ = window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__;
}