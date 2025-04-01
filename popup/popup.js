document.addEventListener('DOMContentLoaded', function() {
  const toggleButton = document.getElementById('toggleChat');
  const danmuToggle = document.getElementById('toggleDanmu');
  const danmuColor = document.getElementById('danmuColor');
  const opacitySlider = document.getElementById('opacitySlider');
  const opacityValue = document.getElementById('opacityValue');
  let danmuEnabled = false;
  
  // 在弹出面板打开时获取当前弹幕状态
  async function getCurrentDanmuStatus() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        // 向content脚本发送获取当前状态的请求
        chrome.tabs.sendMessage(tab.id, { action: 'getDanmuStatus' }, (response) => {
          if (response && chrome.runtime.lastError === undefined) {
            // 更新UI以反映当前状态
            danmuEnabled = response.enabled;
            danmuToggle.checked = danmuEnabled;
            
            // 更新颜色选择
            if (response.color) {
              danmuColor.value = response.color;
            }
            
            // 更新透明度滑块
            if (response.opacity !== undefined) {
              const opacityPercentage = Math.round(response.opacity * 100);
              opacitySlider.value = opacityPercentage;
              opacityValue.textContent = `${opacityPercentage}%`;
            }
          }
        });
      }
    } catch (error) {
      console.error('Error getting danmu status:', error);
    }
  }
  
  getCurrentDanmuStatus();
  
  // 添加按钮点击波纹效果
  const addRippleEffect = (button) => {
    button.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      ripple.classList.add('ripple');
      this.appendChild(ripple);
      
      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size/2}px`;
      ripple.style.top = `${e.clientY - rect.top - size/2}px`;
      
      ripple.classList.add('active');
      
      setTimeout(() => {
        ripple.remove();
      }, 600);
    });
  };
  
  // 为按钮添加波纹效果
  addRippleEffect(toggleButton);
  
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

  // 弹幕开关控制 - 使用新的开关控件
  danmuToggle.addEventListener('change', () => {
    // 获取开关状态
    danmuEnabled = danmuToggle.checked;
    
    // 添加微交互效果
    const switchParent = danmuToggle.parentElement;
    switchParent.classList.add('switch-clicked');
    setTimeout(() => {
      switchParent.classList.remove('switch-clicked');
    }, 300);
    
    // 异步处理消息发送，不阻塞UI更新
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          await chrome.tabs.sendMessage(tab.id, { 
            action: 'toggleDanmu',
            enabled: danmuEnabled,
            color: danmuColor.value,
            opacity: opacitySlider.value / 100
          });
        }
      } catch (error) {
        console.error('Error:', error);
        // 如果发生错误，恢复UI状态
        danmuEnabled = !danmuEnabled;
        danmuToggle.checked = danmuEnabled;
      }
    })();
  });

  // 颜色改变时更新弹幕颜色 - 优化响应速度
  danmuColor.addEventListener('change', () => {
    // 立即提供视觉反馈
    const selectWrapper = document.querySelector('.select-wrapper');
    selectWrapper.classList.add('select-changed');
    setTimeout(() => {
      selectWrapper.classList.remove('select-changed');
    }, 300);
    
    // 异步处理消息发送
    if (danmuEnabled) {
      updateDanmuSettings();
    }
  });
  
  // 透明度滑块控制
  opacitySlider.addEventListener('input', () => {
    // 更新显示的值
    opacityValue.textContent = `${opacitySlider.value}%`;
    
    // 如果弹幕已启用，实时更新设置
    if (danmuEnabled) {
      updateDanmuSettings();
    }
  });
  
  // 统一更新弹幕设置的函数
  async function updateDanmuSettings() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await chrome.tabs.sendMessage(tab.id, { 
          action: 'updateDanmuSettings',
          color: danmuColor.value,
          opacity: opacitySlider.value / 100
        });
      }
    } catch (error) {
      console.error('Error updating danmu settings:', error);
    }
  }
});