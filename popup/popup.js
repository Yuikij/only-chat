document.addEventListener('DOMContentLoaded', function() {
  const toggleButton = document.getElementById('toggleChat');
  const danmuButton = document.getElementById('toggleDanmu');
  const danmuColor = document.getElementById('danmuColor');
  let danmuEnabled = false;
  
  toggleButton.addEventListener('click', async () => {
    // 打开侧边栏
    try {
      // 获取当前窗口
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        // 在当前标签页打开侧边栏
        await chrome.sidePanel.open({ tabId: tab.id });
      } else {
        console.error('No active tab found');
      }
    } catch (error) {
      console.error('Error opening side panel:', error);
    }
    // 关闭弹出窗口
    window.close();
  });

  // 弹幕开关控制
  danmuButton.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      danmuEnabled = !danmuEnabled;
      try {
        await chrome.tabs.sendMessage(tab.id, { 
          action: 'toggleDanmu',
          enabled: danmuEnabled,
          color: danmuColor.value
        });
      } catch (error) {
        console.error('Error:', error);
      }
      danmuButton.textContent = danmuEnabled ? '关闭弹幕' : '打开弹幕';
    }
  });

  // 颜色改变时更新弹幕颜色
  danmuColor.addEventListener('change', async () => {
    if (danmuEnabled) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        try {
          await chrome.tabs.sendMessage(tab.id, { 
            action: 'updateDanmuColor',
            color: danmuColor.value
          });
        } catch (error) {
          console.error('Error:', error);
        }
      }
    }
  });
}); 