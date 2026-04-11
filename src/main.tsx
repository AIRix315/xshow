// Ref: Vite React+TS template entry point + §7.3 — 启动时迁移 chrome.storage → localStorage
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './tailwind.css';
import { initChromeStorage } from '@/utils/chromeStorage';

// Zustand persist store keys — 启动前从 chrome.storage.local 迁移到 localStorage
const STORE_KEYS = ['xshow-settings', 'xshow-transit-resources'];

async function bootstrap() {
  await initChromeStorage(STORE_KEYS);
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

bootstrap();