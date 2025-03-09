document.addEventListener('DOMContentLoaded', function() {
  const toggleButton = document.getElementById('toggleChat');
  const danmuButton = document.getElementById('toggleDanmu');
  const danmuColor = document.getElementById('danmuColor');
  let danmuEnabled = false;
  
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
  addRippleEffect(danmuButton);
  
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

  // 弹幕开关控制 - 优化响应速度
  danmuButton.addEventListener('click', () => {
    // 立即更新UI，提供即时反馈
    danmuEnabled = !danmuEnabled;
    const btnText = danmuButton.querySelector('.btn-text');
    btnText.textContent = danmuEnabled ? '关闭弹幕' : '打开弹幕';
    
    // 添加微交互效果
    danmuButton.classList.add('btn-clicked');
    setTimeout(() => {
      danmuButton.classList.remove('btn-clicked');
    }, 300);
    
    // 异步处理消息发送，不阻塞UI更新
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          await chrome.tabs.sendMessage(tab.id, { 
            action: 'toggleDanmu',
            enabled: danmuEnabled,
            color: danmuColor.value
          });
        }
      } catch (error) {
        console.error('Error:', error);
        // 如果发生错误，恢复UI状态
        danmuEnabled = !danmuEnabled;
        btnText.textContent = danmuEnabled ? '关闭弹幕' : '打开弹幕';
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
      (async () => {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab) {
            await chrome.tabs.sendMessage(tab.id, { 
              action: 'updateDanmuColor',
              color: danmuColor.value
            });
          }
        } catch (error) {
          console.error('Error:', error);
        }
      })();
    }
  });
});