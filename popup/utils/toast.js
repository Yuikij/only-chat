/**
 * Toast消息工具类
 */
class Toast {
  /**
   * 显示成功消息
   * @param {string} message - 消息内容
   * @param {number} duration - 显示时长(毫秒)
   */
  static success(message, duration = 2000) {
    this.show(message, 'success', duration);
  }

  /**
   * 显示错误消息
   * @param {string} message - 消息内容
   * @param {number} duration - 显示时长(毫秒)
   */
  static error(message, duration = 3000) {
    this.show(message, 'error', duration);
  }

  /**
   * 显示提示消息
   * @param {string} message - 消息内容
   * @param {number} duration - 显示时长(毫秒)
   */
  static info(message, duration = 2000) {
    this.show(message, 'info', duration);
  }

  /**
   * 显示Toast消息
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型 (success/error/info)
   * @param {number} duration - 显示时长(毫秒)
   */
  static show(message, type = 'info', duration = 2000) {
    // 移除已存在的toast
    const existingToast = document.querySelector('.toast-container');
    if (existingToast) {
      existingToast.remove();
    }

    // 创建新的toast
    const toast = document.createElement('div');
    toast.className = 'toast-container';
    
    // 根据类型设置样式
    let backgroundColor, icon;
    switch (type) {
      case 'success':
        backgroundColor = 'linear-gradient(to right, #4CAF50, #45a049)';
        icon = '<i class="fas fa-check-circle"></i>';
        break;
      case 'error':
        backgroundColor = 'linear-gradient(to right, #f44336, #e53935)';
        icon = '<i class="fas fa-exclamation-circle"></i>';
        break;
      default:
        backgroundColor = 'linear-gradient(to right, #4776E6, #8E54E9)';
        icon = '<i class="fas fa-info-circle"></i>';
    }

    toast.innerHTML = `
      <div class="toast-message" style="
        background: ${backgroundColor};
        color: white;
        padding: 10px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        max-width: 90%;
        word-break: break-word;
      ">
        ${icon} ${message}
      </div>
    `;

    toast.style.cssText = `
      position: fixed;
      top: 60px;
      left: 0;
      right: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    // 添加到DOM并显示
    document.body.appendChild(toast);
    
    // 强制回流以启用过渡效果
    toast.offsetHeight;
    toast.style.opacity = '1';

    // 定时移除
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

export default Toast; 