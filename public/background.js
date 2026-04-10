// background.js
// 监听扩展图标点击事件，打开侧边栏
chrome.action.onClicked.addListener((tab) => {
  // Chrome 114+ supports opening side panel via action click
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

// 监听扩展更新，强制立即生效，避免一直提示“正在更新”
chrome.runtime.onUpdateAvailable.addListener((details) => {
  console.log("Update available: ", details.version);
  chrome.runtime.reload();
});

// 监听右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-to-transit") {
    let resourceUrl = info.srcUrl;
    let type = info.mediaType || 'image'; // 'image', 'video', 'audio'
    
    // Check if it is text selection
    if (info.selectionText) {
      type = 'text';
      resourceUrl = info.selectionText;
    }
    
    // 保存到 storage
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
        // 通知侧边栏更新
        chrome.runtime.sendMessage({ action: "resourceAdded", resource: newResource });
        
        // 尝试打开侧边栏 (如果未打开)
        if (tab.windowId) {
             chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
        }
      });
    });
  }
});
