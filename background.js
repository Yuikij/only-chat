// 监听扩展安装事件
chrome.runtime.onInstalled.addListener(() => {
  console.log('扩展已安装');
  
  // 创建右键菜单
  chrome.contextMenus.create({
    id: "publishComment",
    title: "发布评论",
    contexts: ["selection"]  // 只在选中文本时显示
  });
});

// 监听右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "publishComment") {
    // 获取选中的文本
    const selectedText = info.selectionText;
    
    // 打开评论输入对话框
    chrome.tabs.sendMessage(tab.id, {
      action: 'openCommentDialog',
      selectedText: selectedText
    });
  }
});

// 在这里添加后台逻辑 