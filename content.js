// 检查是否已经初始化
if (window.danmuInitialized) {
  throw new Error('Danmu already initialized');
}
window.danmuInitialized = true;

let danmuContainer = null;
let danmuEnabled = false;
let danmuInterval = null;
let currentColor = 'white';
let commentDialog = null;
// 存储所有评论
const commentStore = new Map();

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
  danmu.className = `danmu ${currentColor}`;
  danmu.textContent = text;
  
  // 随机垂直位置
  danmu.style.top = Math.random() * 160 + 'px';
  
  danmuContainer.appendChild(danmu);
  
  // 动画结束后删除弹幕
  danmu.addEventListener('animationend', () => {
    danmu.remove();
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
  if (message.action === 'toggleDanmu') {
    danmuEnabled = message.enabled;
    currentColor = message.color || currentColor;
    
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
  else if (message.action === 'updateDanmuColor') {
    currentColor = message.color;
  }
  else if (message.action === 'openCommentDialog') {
    createCommentDialog(message.selectedText);
  }
  // 返回 true 表示异步处理消息
  return true;
}); 