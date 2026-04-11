// Ref: §7.3 + chrome-extension-boilerplate-react-vite — 双层持久化适配器
// localStorage 作同步层（Zustand persist 即时读写）
// chrome.storage.local 作异步权威层（跨浏览器会话持久化）
import { createJSONStorage } from 'zustand/middleware';

const IS_CHROME_EXT = typeof chrome !== 'undefined' && !!chrome.storage?.local;

/**
 * 获取可用的同步存储后端。
 * 浏览器环境 → localStorage
 * 测试/SSR 环境 → 内存 Map 降级
 */
function getSyncStorage(): Storage {
  if (typeof localStorage !== 'undefined') {
    return localStorage;
  }
  // 测试/SSR 降级：内存 Storage
  const map = new Map<string, string>();
  return {
    getItem: (name: string) => map.get(name) ?? null,
    setItem: (name: string, value: string) => { map.set(name, value); },
    removeItem: (name: string) => { map.delete(name); },
    get length() { return map.size; },
    clear: () => { map.clear(); },
    key: (_index: number) => null,
  };
}

const syncStorage = getSyncStorage();

/**
 * 双层 Storage 适配器：
 * - 读：优先 localStorage/内存（同步，Zustand persist 立即可用）
 * - 写：同时写 localStorage/内存 + chrome.storage.local
 * - 删：同时删两层
 *
 * 解决了原 createChromeStorage() 的根本问题：
 * chrome.storage.local.get 是异步回调式 API，无法包装为同步 Storage.getItem。
 * 改用同步层作为 Zustand persist 的存储后端，chrome.storage.local 仅做异步备份。
 */
function createHybridStorage(): Storage {
  const storage: Storage = {
    getItem(name: string): string | null {
      return syncStorage.getItem(name);
    },

    setItem(name: string, value: string): void {
      syncStorage.setItem(name, value);
      if (IS_CHROME_EXT) {
        try {
          chrome.storage.local.set({ [name]: value });
        } catch {
          // chrome.storage 不可用时静默降级
        }
      }
    },

    removeItem(name: string): void {
      syncStorage.removeItem(name);
      if (IS_CHROME_EXT) {
        try {
          chrome.storage.local.remove(name);
        } catch {
          // 静默降级
        }
      }
    },

    get length(): number {
      return syncStorage.length;
    },

    clear(): void {
      syncStorage.clear();
      if (IS_CHROME_EXT) {
        try {
          chrome.storage.local.clear();
        } catch {
          // 静默降级
        }
      }
    },

    key(index: number): string | null {
      return syncStorage.key(index);
    },
  };

  return storage;
}

/**
 * 应用启动时将 chrome.storage.local 的数据迁移到同步存储。
 * 必须在 React 渲染之前调用，确保 Zustand hydrate 时已有最新数据。
 *
 * @param keys - 需要迁移的 storage key 列表（对应 Zustand persist name）
 */
export async function initChromeStorage(keys: string[]): Promise<void> {
  if (!IS_CHROME_EXT) return;

  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(keys, (result) => {
        for (const key of keys) {
          const value = result[key];
          if (typeof value === 'string') {
            syncStorage.setItem(key, value);
          }
        }
        resolve();
      });
    } catch {
      // chrome.storage 不可用，直接跳过
      resolve();
    }
  });
}

/**
 * 创建 Zustand persist 兼容的 Storage 适配器。
 * 替代原来无法工作的 createChromeStorage()。
 */
export function createPersistStorage() {
  return createJSONStorage(() => createHybridStorage());
}