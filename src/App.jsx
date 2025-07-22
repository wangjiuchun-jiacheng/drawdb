import { BrowserRouter, Routes, Route, useLocation, HashRouter } from "react-router-dom";
import { useLayoutEffect } from "react";
import Editor from "./pages/Editor";
import BugReport from "./pages/BugReport";
import Templates from "./pages/Templates";
import LandingPage from "./pages/LandingPage";
import SettingsContextProvider from "./context/SettingsContext";
import NotFound from "./pages/NotFound";

export default function App({ microProps }) {
  // 微前端模式使用HashRouter避免路由冲突
  const Router = window.__POWERED_BY_QIANKUN__ ? HashRouter : BrowserRouter;
  const basename = window.__POWERED_BY_QIANKUN__ ? '' : '/';
  
  // 微前端模式下直接进入编辑器，简化路由结构
  const isMicroMode = window.__POWERED_BY_QIANKUN__;

  return (
    <SettingsContextProvider microProps={microProps}>
      <Router basename={basename}>
        <RestoreScroll />
        <Routes>
          {isMicroMode ? (
            // 微前端模式：简化路由，主要提供编辑器功能
            <>
              <Route path="/" element={<Editor />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="*" element={<Editor />} />
            </>
          ) : (
            // 独立模式：保持完整路由
            <>
              <Route path="/" element={<LandingPage />} />
              <Route path="/editor" element={<Editor />} />
              <Route path="/bug-report" element={<BugReport />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="*" element={<NotFound />} />
            </>
          )}
        </Routes>
      </Router>
    </SettingsContextProvider>
  );
}

function RestoreScroll() {
  const location = useLocation();
  useLayoutEffect(() => {
    // 微前端模式下不执行全局滚动操作，避免影响主应用
    if (!window.__POWERED_BY_QIANKUN__) {
      window.scroll(0, 0);
    }
  }, [location.pathname]);
  return null;
}
