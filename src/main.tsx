// Ref: Vite React+TS template entry point + 启动时迁移 chrome.storage → localStorage
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './tailwind.css';
import { initChromeStorage } from '@/utils/chromeStorage';

// Zustand persist store keys — 启动前从 chrome.storage.local 迁移到 localStorage
const STORE_KEYS = ['xshow-settings', 'xshow-transit-resources'];

/** 将全局字体缩放 CSS 变量应用到 <html>，启动时一次性设置，后续由 App 组件维护 */
function applyFontScale(fontSize: 'small' | 'medium' | 'large') {
  const scale = fontSize === 'small' ? 0.85 : fontSize === 'large' ? 1.15 : 1;
  document.documentElement.style.setProperty('--font-scale', String(scale));
}

/** 启动时从 localStorage 读取已有字体设置 */
function initFontScale() {
  try {
    const raw = localStorage.getItem('xshow-settings');
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: { canvasSettings?: { fontSize?: 'small' | 'medium' | 'large' } } };
      if (parsed?.state?.canvasSettings?.fontSize) {
        applyFontScale(parsed.state.canvasSettings.fontSize);
      }
    }
  } catch {
    // ignore
  }
}

async function bootstrap() {
  await initChromeStorage(STORE_KEYS);
  initFontScale();
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

bootstrap();