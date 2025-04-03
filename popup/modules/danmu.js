// 弹幕状态
let danmuEnabled = false;

/**
 * 获取弹幕状态
 * @param {number} tabId - 标签页ID
 * @returns {Promise<Object>} 弹幕状态
 */
export function getDanmuStatus(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'getDanmuStatus' }, (response) => {
      if (response && chrome.runtime.lastError === undefined) {
        resolve(response);
      } else {
        resolve({ enabled: false, color: 'white', opacity: 0.8 });
      }
    });
  });
}

/**
 * 更新弹幕UI
 * @param {Object} status - 弹幕状态
 */
export function updateDanmuUI(status) {
  const danmuToggle = document.getElementById('toggleDanmu');
  const danmuColor = document.getElementById('danmuColor');
  const opacitySlider = document.getElementById('opacitySlider');
  const opacityValue = document.getElementById('opacityValue');
  
  // 更新状态
  danmuEnabled = status.enabled;
  
  // 更新开关
  if (danmuToggle) {
    danmuToggle.checked = danmuEnabled;
  }
  
  // 更新颜色选择
  if (danmuColor && status.color) {
    danmuColor.value = status.color;
  }
  
  // 更新透明度滑块
  if (opacitySlider && opacityValue && status.opacity !== undefined) {
    const opacityPercentage = Math.round(status.opacity * 100);
    opacitySlider.value = opacityPercentage;
    opacityValue.textContent = `${opacityPercentage}%`;
  }
}

/**
 * 切换弹幕状态
 * @param {boolean} enabled - 是否启用弹幕
 * @param {Object} settings - 弹幕设置
 * @param {number} tabId - 标签页ID
 */
export async function toggleDanmu(enabled, settings, tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { 
      action: 'toggleDanmu',
      enabled: enabled,
      color: settings.color,
      opacity: settings.opacity / 100
    });
    
    danmuEnabled = enabled;
  } catch (error) {
    console.error('Error toggling danmu:', error);
    throw error;
  }
}

/**
 * 更新弹幕设置
 * @param {Object} settings - 弹幕设置
 * @param {number} tabId - 标签页ID
 */
export async function updateDanmuSettings(settings, tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { 
      action: 'updateDanmuSettings',
      color: settings.color,
      opacity: settings.opacity / 100
    });
  } catch (error) {
    console.error('Error updating danmu settings:', error);
    throw error;
  }
}

/**
 * 初始化弹幕控制
 */
export function initDanmuControls() {
  const danmuToggle = document.getElementById('toggleDanmu');
  const danmuColor = document.getElementById('danmuColor');
  const opacitySlider = document.getElementById('opacitySlider');
  const opacityValue = document.getElementById('opacityValue');
  
  // 初始化时获取当前弹幕状态
  (async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        const status = await getDanmuStatus(tab.id);
        updateDanmuUI(status);
      }
    } catch (error) {
      console.error('Error getting danmu status:', error);
    }
  })();
  
  // 弹幕开关控制
  if (danmuToggle) {
    danmuToggle.addEventListener('change', async () => {
      // 获取开关状态
      const enabled = danmuToggle.checked;
      
      // 添加微交互效果
      const switchParent = danmuToggle.parentElement;
      switchParent.classList.add('switch-clicked');
      setTimeout(() => {
        switchParent.classList.remove('switch-clicked');
      }, 300);
      
      // 处理状态变化
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          await toggleDanmu(enabled, {
            color: danmuColor.value,
            opacity: opacitySlider.value
          }, tab.id);
        }
      } catch (error) {
        console.error('Error toggling danmu:', error);
        // 恢复UI状态
        danmuToggle.checked = !enabled;
      }
    });
  }
  
  // 颜色改变事件
  if (danmuColor) {
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
              await updateDanmuSettings({
                color: danmuColor.value,
                opacity: opacitySlider.value
              }, tab.id);
            }
          } catch (error) {
            console.error('Error updating danmu color:', error);
          }
        })();
      }
    });
  }
  
  // 透明度滑块控制
  if (opacitySlider && opacityValue) {
    opacitySlider.addEventListener('input', () => {
      // 更新显示的值
      opacityValue.textContent = `${opacitySlider.value}%`;
      
      // 如果弹幕已启用，实时更新设置
      if (danmuEnabled) {
        (async () => {
          try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
              await updateDanmuSettings({
                color: danmuColor.value,
                opacity: opacitySlider.value
              }, tab.id);
            }
          } catch (error) {
            console.error('Error updating danmu opacity:', error);
          }
        })();
      }
    });
  }
} 