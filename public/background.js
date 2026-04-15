// background.js

// =============================================================================
// SidePanel 代理（解决 CORS 限制）
// =============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'comfy-fetch') {
    const { url, options } = message;
    console.log('[Background] Received comfy-fetch for:', url);

    const fetchOptions = { ...options };

    fetch(url, fetchOptions)
      .then((res) => {
        console.log('[Background] Fetch response:', res.status, url);
        const headers = {};
        res.headers.forEach((v, k) => { headers[k] = v; });

        // 获取 Content-Type 判断是否需要二进制传输
        const contentType = res.headers.get('content-type') || '';
        const isBinary = contentType.includes('application/zip') ||
                         contentType.includes('image/') ||
                         contentType.includes('video/') ||
                         contentType.includes('audio/') ||
                         contentType.includes('application/octet-stream');

        if (isBinary) {
          // 二进制内容使用 arrayBuffer 传输，但 chrome.runtime.sendMessage
          // 不支持直接传递 ArrayBuffer，需要转 base64
          return res.arrayBuffer().then((buffer) => {
            // 将 ArrayBuffer 转换为 base64 字符串
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);
            return {
              ok: res.ok,
              status: res.status,
              headers,
              data: base64,
              isBinary: true,
            };
          });
        }

        // 文本内容使用 text() 传输
        return res.text().then((text) => ({
          ok: res.ok,
          status: res.status,
          headers,
          data: text,
          isBinary: false,
        }));
      })
      .then((result) => {
        sendResponse({ success: true, ...result });
      })
      .catch((err) => {
        console.error('[Background] Fetch error:', err, 'URL:', url);
        sendResponse({ success: false, error: err.message + ' [URL: ' + url + ']' });
      });
    return true;
  }
});

// 监听扩展图标点击事件，打开侧边栏
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-to-transit",
    title: "发送到资源",
    contexts: ["image", "video", "audio", "selection"]
  });
});

// 监听扩展更新，强制立即生效
chrome.runtime.onUpdateAvailable.addListener((details) => {
  console.log("Update available: ", details.version);
  chrome.runtime.reload();
});

// 监听右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-to-transit") {
    let resourceUrl = info.srcUrl;
    let type = info.mediaType || 'image';

    if (info.selectionText) {
      type = 'text';
      resourceUrl = info.selectionText;
    }

    chrome.storage.local.get(['transitResources'], (result) => {
      const resources = result.transitResources || [];
      const newResource = {
        id: Date.now().toString(),
        url: resourceUrl,
        type: type,
        timestamp: Date.now(),
        pageUrl: info.pageUrl,
        pageTitle: tab.title
      };

      chrome.storage.local.set({ transitResources: [newResource, ...resources] }, () => {
        chrome.runtime.sendMessage({ action: "resourceAdded", resource: newResource });
        if (tab.windowId) {
          chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
        }
      });
    });
  }
});
