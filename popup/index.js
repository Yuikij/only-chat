import { initAuth } from './modules/auth.js';
import { initDanmuControls } from './modules/danmu.js';
import { addRippleEffectToButtons } from './modules/ripple.js';

// 在DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup initialize');
  
  // 获取UI元素
  const toggleButton = document.getElementById('toggleChat');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  
  // 为按钮添加波纹效果
  addRippleEffectToButtons([toggleButton, loginBtn, logoutBtn]);
  
  // 初始化认证功能
  initAuth();
  
  // 初始化弹幕控制
  initDanmuControls();
  
  // 聊天按钮点击事件
  if (toggleButton) {
    toggleButton.addEventListener('click', async () => {
      console.log('尝试打开侧边栏');
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
  }
}); 