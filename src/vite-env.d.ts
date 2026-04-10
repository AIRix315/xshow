/// <reference types="vite/client" />

interface ChromeWindow extends Window {
  chrome: typeof chrome;
}