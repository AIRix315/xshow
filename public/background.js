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
        console.log('[Background] Fetch success:', res.status);
        const headers = {};
        res.headers.forEach((v, k) => { headers[k] = v; });
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('json') || res.status !== 200) {
          return res.text().then((text) => ({
            ok: res.ok,
            status: res.status,
            headers,
            data: text,
          }));
        }
        return res.json().then((data) => ({
          ok: res.ok,
          status: res.status,
          headers,
          data,
        })).catch(() => res.text().then((text) => ({
          ok: res.ok,
          status: res.status,
          headers,
          data: text,
        })));
      })
      .then((result) => {
        console.log('[Background] Sending success response');
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
