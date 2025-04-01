// 检查是否已经初始化
if (window.danmuInitialized) {
  throw new Error('Danmu already initialized');
}
window.danmuInitialized = true;

let danmuContainer = null;
let danmuEnabled = false;
let danmuInterval = null;
let currentColor = 'white';
let danmuOpacity = 0.8; // 默认透明度为0.8
let commentDialog = null;
// 存储所有评论
const commentStore = new Map();

// 初始化时从storage加载设置
function loadSettings() {
  chrome.storage.local.get(['danmuEnabled', 'danmuColor', 'danmuOpacity'], (result) => {
    if (result.danmuEnabled !== undefined) {
      danmuEnabled = result.danmuEnabled;
    }
    if (result.danmuColor) {
      currentColor = result.danmuColor;
    }
    if (result.danmuOpacity !== undefined) {
      danmuOpacity = result.danmuOpacity;
    }
    
    // 如果弹幕已启用，则创建容器并开始显示弹幕
    if (danmuEnabled) {
      createDanmuContainer();
      // 开始定时发送测试弹幕
      if (!danmuInterval) {
        danmuInterval = setInterval(() => {
          createDanmu('这是弹幕');
        }, 2000);
      }
    }
  });
}

// 页面加载完成后加载设置
loadSettings();

// 创建弹幕容器
function createDanmuContainer() {
  danmuContainer = document.createElement('div');
  danmuContainer.className = 'danmu-container';
  document.body.appendChild(danmuContainer);
}

// 创建单条弹幕
function createDanmu(text) {
  if (!danmuEnabled || !danmuContainer) return;

  const danmu = document.createElement('div');
  
  // 根据颜色设置应用不同的样式
  if (currentColor === 'gradient') {
    danmu.className = 'danmu gradient';
    // 随机选择渐变方向
    const gradientDirections = ['90deg', '120deg', '45deg', '135deg'];
    const direction = gradientDirections[Math.floor(Math.random() * gradientDirections.length)];
    danmu.style.background = `linear-gradient(${direction}, #4776E6, #8E54E9)`;
    danmu.style.color = 'white';
    danmu.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.3)';
  } else {
    danmu.className = `danmu ${currentColor}`;
  }
  
  // 应用透明度设置
  danmu.style.opacity = danmuOpacity;
  danmu.textContent = text;
  
  // 随机垂直位置 - 使用窗口高度计算，让弹幕在整个页面五分之一范围内显示
  danmu.style.top = Math.random() * (window.innerHeight/5) + 'px';
  
  danmuContainer.appendChild(danmu);
  
  // 只在弹幕完全移出视野后才删除，避免过早消失
  // 使用animationName来区分是哪个动画结束
  danmu.addEventListener('animationend', (event) => {
    if (event.animationName === 'danmu-move') {
      danmu.remove();
    }
  });
}

// 创建评论对话框
function createCommentDialog(selectedText) {
  if (commentDialog) {
    commentDialog.remove();
  }

  commentDialog = document.createElement('div');
  commentDialog.className = 'comment-dialog';
  
  const content = `
    <div class="dialog-header">
      <h3>发布评论</h3>
      <button class="close-btn">&times;</button>
    </div>
    <div class="dialog-body">
      <div class="selected-text">${selectedText}</div>
      <textarea placeholder="请输入您的评论"></textarea>
    </div>
    <div class="dialog-footer">
      <button class="cancel-btn">取消</button>
      <button class="submit-btn">发布</button>
    </div>
  `;
  
  commentDialog.innerHTML = content;
  document.body.appendChild(commentDialog);
  
  const closeBtn = commentDialog.querySelector('.close-btn');
  const cancelBtn = commentDialog.querySelector('.cancel-btn');
  const submitBtn = commentDialog.querySelector('.submit-btn');
  const textarea = commentDialog.querySelector('textarea');
  
  const closeDialog = () => {
    commentDialog.remove();
    commentDialog = null;
  };
  
  closeBtn.addEventListener('click', closeDialog);
  cancelBtn.addEventListener('click', closeDialog);
  
  submitBtn.addEventListener('click', () => {
    const comment = textarea.value.trim();
    if (comment) {
      // 将评论作为弹幕发送
      createDanmu(comment);
      // 保存评论
      saveComment(selectedText, comment);
      // 高亮被评论的文本
      highlightCommentedText(selectedText);
    }
    closeDialog();
  });
}

// 保存评论
function saveComment(text, comment) {
  if (!commentStore.has(text)) {
    commentStore.set(text, []);
  }
  commentStore.get(text).push({
    comment,
    timestamp: new Date().toISOString(),
    color: currentColor
  });
}

// 高亮被评论的文本
function highlightCommentedText(text) {
  const range = window.getSelection().getRangeAt(0);
  const span = document.createElement('span');
  span.className = 'commented-text';
  span.textContent = text;
  range.deleteContents();
  range.insertNode(span);

  // 添加点击事件监听器
  span.addEventListener('click', () => showCommentList(text));
}

// 显示评论列表
function showCommentList(text) {
  const comments = commentStore.get(text) || [];
  
  const dialog = document.createElement('div');
  dialog.className = 'comment-list-dialog';
  
  const content = `
    <div class="dialog-header">
      <h3>评论列表</h3>
      <button class="close-btn">&times;</button>
    </div>
    <div class="dialog-body">
      <div class="original-text">${text}</div>
      <div class="comments-container">
        ${comments.map(c => `
          <div class="comment-item ${c.color}">
            <div class="comment-content">${c.comment}</div>
            <div class="comment-time">${new Date(c.timestamp).toLocaleString()}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  
  dialog.innerHTML = content;
  document.body.appendChild(dialog);
  
  const closeBtn = dialog.querySelector('.close-btn');
  closeBtn.addEventListener('click', () => dialog.remove());
}

// 监听来自popup和background的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getDanmuStatus') {
    // 返回当前弹幕状态
    sendResponse({
      enabled: danmuEnabled,
      color: currentColor,
      opacity: danmuOpacity
    });
    return true; // 确保异步响应正常工作
  }
  else if (message.action === 'toggleDanmu') {
    danmuEnabled = message.enabled;
    currentColor = message.color || currentColor;
    danmuOpacity = message.opacity || 0.8; // 默认透明度为0.8
    
    // 保存设置到storage
    chrome.storage.local.set({
      danmuEnabled: danmuEnabled,
      danmuColor: currentColor,
      danmuOpacity: danmuOpacity
    });
    
    if (danmuEnabled) {
      if (!danmuContainer) {
        createDanmuContainer();
      }
      // 开始定时发送测试弹幕
      if (!danmuInterval) {
        danmuInterval = setInterval(() => {
          createDanmu('这是弹幕');
        }, 2000);
      }
    } else {
      // 关闭弹幕时移除容器
      if (danmuContainer) {
        danmuContainer.remove();
        danmuContainer = null;
      }
      // 清除定时器
      if (danmuInterval) {
        clearInterval(danmuInterval);
        danmuInterval = null;
      }
    }
  }
  else if (message.action === 'updateDanmuSettings') {
    currentColor = message.color;
    danmuOpacity = message.opacity || 0.8;
    
    // 保存设置到storage
    chrome.storage.local.set({
      danmuColor: currentColor,
      danmuOpacity: danmuOpacity
    });
  }
  else if (message.action === 'openCommentDialog') {
    createCommentDialog(message.selectedText);
  }
  // 返回 true 表示异步处理消息
  return true;
});