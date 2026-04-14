/// <reference types="vite/client" />

// Vite define 注入的全局常量
declare const __APP_VERSION__: string;

interface ChromeWindow extends Window {
  chrome: typeof chrome;
}