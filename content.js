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
// 确保只有一个评论列表弹窗存在
let commentListDialog = null;
// 存储文本重叠信息的映射表
const textOverlapMap = new Map();
// 用户状态
let userState = {
  isLoggedIn: false,
  username: '',
  email: '',
  avatar: '' // 用户头像的URL或默认图标
};
// 登录弹窗实例
let authDialog = null;
// 当前页面URL - 注意：每次使用时重新获取，以确保准确性
function getCurrentPageUrl() {
  return window.location.href;
}

// 创建一个用于生成评论唯一键的函数
function getCommentKey(url, domPath, text) {
  return `${url}|${domPath}|${text}`;
}

// 检查两段文本是否重叠
function areTextsOverlapping(text1, text2) {
  // 如果任一文本包含另一个，或者有部分重叠，则认为重叠
  return text1.includes(text2) || text2.includes(text1) || 
         text1.indexOf(text2) !== -1 || text2.indexOf(text1) !== -1;
}

// 合并重叠的文本片段
function mergeOverlappingTexts(text1, text2) {
  if (text1.includes(text2)) {
    return text1; // text2完全包含于text1
  }
  if (text2.includes(text1)) {
    return text2; // text1完全包含于text2
  }
  
  // 寻找部分重叠
  // 例如 "在2.0平台作为" 与 "平台作为展示发布" 合并为 "在2.0平台作为展示发布"
  
  // 计算最大公共子串
  let overlap = '';
  for (let i = 1; i <= Math.min(text1.length, text2.length); i++) {
    if (text1.endsWith(text2.substring(0, i))) {
      overlap = text2.substring(0, i);
    }
  }
  
  if (overlap) {
    // 有重叠部分，合并
    return text1 + text2.substring(overlap.length);
  }
  
  // 没找到重叠，按照相对位置拼接（这里假设text1在前text2在后）
  return text1 + " " + text2;
}

// 查找与新文本重叠的已有评论文本
function findOverlappingCommentedTexts(newText) {
  const overlappingTexts = [];
  
  for (const [existingText, data] of commentStore.entries()) {
    if (areTextsOverlapping(newText, existingText)) {
      overlappingTexts.push(existingText);
    }
  }
  
  return overlappingTexts;
}

// 管理文本重叠关系
function manageTextOverlap(newText, overlappingTexts) {
  if (overlappingTexts.length === 0) {
    return newText; // 没有重叠
  }
  
  // 创建一个"超级文本"，包含所有重叠内容
  let mergedText = newText;
  
  for (const existingText of overlappingTexts) {
    mergedText = mergeOverlappingTexts(mergedText, existingText);
    
    // 记录重叠关系
    if (!textOverlapMap.has(mergedText)) {
      textOverlapMap.set(mergedText, new Set());
    }
    textOverlapMap.get(mergedText).add(existingText);
    
    // 如果已有评论重叠了，也添加到重叠映射表
    if (textOverlapMap.has(existingText)) {
      const subTexts = textOverlapMap.get(existingText);
      for (const subText of subTexts) {
        textOverlapMap.get(mergedText).add(subText);
      }
    }
  }
  
  return mergedText;
}

// 获取与文本相关的所有评论，包括重叠评论
function getAllRelatedComments(text) {
  // 使用Map来确保每条评论只添加一次，使用时间戳作为唯一键
  const commentMap = new Map();
  
  // 先获取文本自身的评论
  if (commentStore.has(text)) {
    const commentData = commentStore.get(text);
    if (commentData && commentData.comments) {
      for (const comment of commentData.comments) {
        commentMap.set(comment.timestamp, comment);
      }
    }
  }
  
  // 再获取重叠文本的评论
  if (textOverlapMap.has(text)) {
    for (const relatedText of textOverlapMap.get(text)) {
      if (commentStore.has(relatedText)) {
        const commentData = commentStore.get(relatedText);
        if (commentData && commentData.comments) {
          for (const comment of commentData.comments) {
            commentMap.set(comment.timestamp, comment);
          }
        }
      }
    }
  }
  
  // 对于非"超级文本"，检查它是否是某个超级文本的一部分
  for (const [superText, subTexts] of textOverlapMap.entries()) {
    if (subTexts.has(text) && commentStore.has(superText)) {
      const commentData = commentStore.get(superText);
      if (commentData && commentData.comments) {
        for (const comment of commentData.comments) {
          commentMap.set(comment.timestamp, comment);
        }
      }
    }
  }
  
  // 将Map转换为数组并按时间排序
  const allComments = Array.from(commentMap.values()).sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  console.log(`获取到 ${allComments.length} 条不重复评论，关联文本: "${text}"`);
  return allComments;
}

// 添加必要的CSS样式
function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .commented-text {
      border-bottom: 2px solid #ffcc00;
      background-color: rgba(255, 204, 0, 0.1);
      cursor: pointer;
      position: relative;
    }
    
    .commented-text:hover {
      background-color: rgba(255, 204, 0, 0.2);
    }
    
    .commented-text::after {
      content: "💬";
      font-size: 12px;
      position: absolute;
      top: -10px;
      right: -5px;
    }
    
    .comment-list-dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      padding: 15px;
      z-index: 10000;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }
    
    .comment-dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      padding: 15px;
      z-index: 10000;
      max-width: 500px;
      width: 90%;
    }
    
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      border-bottom: 1px solid #eee;
      padding-bottom: 10px;
    }
    
    .dialog-header h3 {
      margin: 0;
      font-size: 18px;
    }
    
    .close-btn {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #888;
    }
    
    .dialog-body {
      margin-bottom: 15px;
    }
    
    .selected-text, .original-text {
      background: #f5f5f5;
      padding: 10px;
      border-radius: 4px;
      margin-bottom: 10px;
      font-weight: bold;
    }
    
    .original-selection {
      font-size: 12px;
      color: #666;
      margin-top: 5px;
      padding: 4px 8px;
      background: #f9f9f9;
      border-left: 2px solid #ddd;
      font-style: italic;
    }
    
    textarea {
      width: 100%;
      min-height: 100px;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      resize: vertical;
    }
    
    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    
    .cancel-btn, .submit-btn {
      padding: 8px 15px;
      border-radius: 4px;
      cursor: pointer;
    }
    
    .cancel-btn {
      background: #f5f5f5;
      border: 1px solid #ddd;
    }
    
    .submit-btn {
      background: #4776E6;
      border: none;
      color: white;
    }
    
    .comments-container {
      max-height: 300px;
      overflow-y: auto;
      margin-bottom: 20px;
    }
    
    .comment-item {
      padding: 10px;
      border-radius: 4px;
      margin-bottom: 10px;
      background: #f9f9f9;
      border-left: 3px solid;
    }
    
    .comment-item.white {
      border-left-color: #666;
    }
    
    .comment-item.red {
      border-left-color: #ff4d4d;
    }
    
    .comment-item.blue {
      border-left-color: #4da6ff;
    }
    
    .comment-item.green {
      border-left-color: #4dff4d;
    }
    
    .comment-item.yellow {
      border-left-color: #ffcc00;
    }
    
    .comment-item.purple {
      border-left-color: #cc66ff;
    }
    
    .comment-item.orange {
      border-left-color: #ff9933;
    }
    
    .comment-item.gradient {
      border-left: 3px solid #4776E6;
    }
    
    .comment-content {
      margin-bottom: 5px;
    }
    
    .comment-time {
      font-size: 12px;
      color: #888;
      text-align: right;
    }
    
    .overlap-notice {
      margin: 10px 0;
      padding: 8px 12px;
      background-color: #fffde7;
      border-left: 3px solid #ffc107;
      font-size: 13px;
    }
    
    .no-comments {
      text-align: center;
      color: #888;
      padding: 15px;
    }

    /* 追加评论样式 */
    .reply-section {
      margin-top: 20px;
      border-top: 1px solid #eee;
      padding-top: 15px;
    }

    .reply-header {
      font-size: 16px;
      margin: 0 0 10px 0;
      color: #333;
    }

    .color-selection {
      margin-bottom: 10px;
      display: flex;
      align-items: center;
    }

    .color-label {
      margin-right: 10px;
      font-size: 14px;
      color: #555;
    }

    .color-options {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .color-option {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      cursor: pointer;
      border: 2px solid transparent;
      transition: transform 0.2s;
    }

    .color-option:hover {
      transform: scale(1.1);
    }

    .color-option.selected {
      border-color: #333;
      transform: scale(1.1);
    }

    .color-option.white { background-color: #f5f5f5; border: 2px solid #ddd; }
    .color-option.red { background-color: #ff4d4d; }
    .color-option.blue { background-color: #4da6ff; }
    .color-option.green { background-color: #4dff4d; }
    .color-option.yellow { background-color: #ffcc00; }
    .color-option.purple { background-color: #cc66ff; }
    .color-option.orange { background-color: #ff9933; }
    .color-option.gradient { 
      background: linear-gradient(135deg, #4776E6, #8E54E9);
    }

    .reply-textarea {
      min-height: 80px;
      margin-bottom: 10px;
      font-size: 14px;
    }

    .reply-submit-btn {
      padding: 8px 16px;
      background: #4776E6;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      float: right;
      font-size: 14px;
      transition: background-color 0.2s;
    }

    .reply-submit-btn:hover {
      background-color: #3365d6;
    }

    .danmu-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
      overflow: hidden;
    }
    
    .danmu {
      position: absolute;
      white-space: nowrap;
      font-size: 20px;
      font-weight: bold;
      padding: 3px 8px;
      border-radius: 4px;
      animation: danmu-move 15s linear forwards;
      right: -100%;
      background: none !important;
      box-shadow: none !important;
    }
    
    @keyframes danmu-move {
      from { transform: translateX(0); }
      to { transform: translateX(-200vw); }
    }
    
    .danmu.white { 
      color: #ffffff !important;
      text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.8), 
                  -1px -1px 1px rgba(0, 0, 0, 0.8), 
                  1px -1px 1px rgba(0, 0, 0, 0.8), 
                  -1px 1px 1px rgba(0, 0, 0, 0.8);
      background: none !important;
    }
    .danmu.red { 
      color: #ff4d4d;
      text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.8);
      background: none !important;
    }
    .danmu.blue { 
      color: #4da6ff;
      text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.8);
      background: none !important;
    }
    .danmu.green { 
      color: #4dff4d;
      text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.8);
      background: none !important;
    }
    .danmu.yellow { 
      color: #ffcc00;
      text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.8);
      background: none !important;
    }
    .danmu.purple { 
      color: #cc66ff;
      text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.8);
      background: none !important;
    }
    .danmu.orange { 
      color: #ff9933;
      text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.8);
      background: none !important;
    }
    .danmu.gradient { 
      background: none !important;
      background-image: linear-gradient(135deg, #4776E6, #8E54E9);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-shadow: none;
    }
    
    /* 认证相关样式 */
    .auth-dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
      border-radius: 12px;
      padding: 0;
      z-index: 10001;
      max-width: 400px;
      width: 90%;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    .auth-header {
      background: linear-gradient(135deg, #4776E6, #8E54E9);
      color: white;
      padding: 15px 20px;
      border-radius: 12px 12px 0 0;
      position: relative;
    }
    
    .auth-title {
      margin: 0;
      font-size: 20px;
      font-weight: 500;
      text-align: center;
    }
    
    .auth-tabs {
      display: flex;
      border-bottom: 1px solid #eee;
    }
    
    .auth-tab {
      flex: 1;
      text-align: center;
      padding: 15px 0;
      cursor: pointer;
      font-weight: 500;
      color: #888;
      transition: all 0.3s ease;
      position: relative;
    }
    
    .auth-tab.active {
      color: #4776E6;
    }
    
    .auth-tab.active::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      width: 100%;
      height: 2px;
      background: linear-gradient(135deg, #4776E6, #8E54E9);
    }
    
    .auth-content {
      padding: 20px;
    }
    
    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    
    .form-group {
      position: relative;
    }
    
    .form-input {
      width: 100%;
      padding: 12px 15px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 14px;
      transition: all 0.3s ease;
      box-sizing: border-box;
    }
    
    .form-input:focus {
      border-color: #4776E6;
      box-shadow: 0 0 0 2px rgba(71, 118, 230, 0.1);
      outline: none;
    }
    
    .form-input.error {
      border-color: #ff4d4d;
    }
    
    .input-icon {
      position: absolute;
      top: 50%;
      right: 15px;
      transform: translateY(-50%);
      color: #aaa;
      font-size: 16px;
    }
    
    .error-message {
      font-size: 12px;
      color: #ff4d4d;
      margin-top: 5px;
    }
    
    .auth-submit {
      background: linear-gradient(135deg, #4776E6, #8E54E9);
      color: white;
      border: none;
      border-radius: 8px;
      padding: 12px 20px;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
      margin-top: 10px;
    }
    
    .auth-submit:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(71, 118, 230, 0.2);
    }
    
    .auth-footer {
      text-align: center;
      margin-top: 15px;
      font-size: 13px;
      color: #888;
    }
    
    .auth-link {
      color: #4776E6;
      cursor: pointer;
      text-decoration: none;
    }
    
    .auth-divider {
      display: flex;
      align-items: center;
      margin: 15px 0;
      color: #888;
      font-size: 13px;
    }
    
    .auth-divider::before,
    .auth-divider::after {
      content: "";
      flex: 1;
      height: 1px;
      background: #eee;
    }
    
    .auth-divider::before {
      margin-right: 10px;
    }
    
    .auth-divider::after {
      margin-left: 10px;
    }
    
    .social-login {
      display: flex;
      justify-content: center;
      gap: 15px;
      margin-top: 15px;
    }
    
    .social-btn {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    }
    
    .social-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 10px rgba(0, 0, 0, 0.1);
    }
    
    .verification-code {
      display: flex;
      gap: 10px;
    }
    
    .send-code-btn {
      white-space: nowrap;
      background: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 0 15px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    
    .send-code-btn:hover:not(:disabled) {
      background: #eee;
    }
    
    .send-code-btn:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
    
    .user-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999;
      transition: all 0.3s ease;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      color: #4776E6;
      border: 2px solid transparent;
    }
    
    .user-avatar.logged-in {
      border-color: #4776E6;
    }
    
    .user-avatar:hover {
      transform: scale(1.1);
      box-shadow: 0 5px 10px rgba(0, 0, 0, 0.1);
    }
    
    .user-menu {
      position: fixed;
      top: 65px;
      right: 20px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
      width: 200px;
      z-index: 999;
      overflow: hidden;
      animation: slideDown 0.3s ease;
    }
    
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .user-menu-header {
      padding: 15px;
      background: linear-gradient(135deg, #4776E6, #8E54E9);
      color: white;
    }
    
    .user-name {
      font-weight: 500;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .user-email {
      font-size: 12px;
      margin: 3px 0 0 0;
      opacity: 0.8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .user-menu-items {
      padding: 8px 0;
    }
    
    .user-menu-item {
      padding: 10px 15px;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      transition: background 0.2s ease;
    }
    
    .user-menu-item:hover {
      background: #f5f5f5;
    }
    
    .user-menu-item.logout {
      color: #ff4d4d;
    }
  `;
  document.head.appendChild(style);
}

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

// 加载保存的评论并高亮它们
function loadSavedComments() {
  // 获取当前页面URL
  const currentPageUrl = getCurrentPageUrl();
  console.log(`Loading comments for URL: ${currentPageUrl}`);
  
  // 从localStorage加载评论
  // 注意：后面接入后台API时，这里需要替换为API请求
  // 例如: fetch('/api/comments?url=' + encodeURIComponent(currentPageUrl))
  //       .then(response => response.json())
  //       .then(data => { 处理数据 });
  chrome.storage.local.get(['comments'], (result) => {
    if (result.comments) {
      try {
        const comments = JSON.parse(result.comments);
        console.log(`Total comments loaded: ${comments.length}`);
        
        // 筛选当前页面的评论
        const pageComments = comments.filter(comment => {
          // 使用URL精确匹配
          const urlMatches = comment.url === currentPageUrl;
          return urlMatches;
        });
        
        console.log(`Filtered comments for current page: ${pageComments.length}`);
        
        // 清空内存中的commentStore
        commentStore.clear();
        
        // 将保存的评论加载到内存中的commentStore
        pageComments.forEach(commentData => {
          // 使用组合键来存储评论，确保区分度
          const key = getCommentKey(commentData.url, commentData.domPath, commentData.text);
          
          if (!commentStore.has(commentData.text)) {
            commentStore.set(commentData.text, {
              domPath: commentData.domPath,
              comments: []
            });
          }
          
          commentStore.get(commentData.text).comments.push(...commentData.comments);
          console.log(`Loaded comment for text: "${commentData.text}" with path: ${commentData.domPath}`);
          
          // 查找并高亮文本
          highlightSavedComment(commentData.domPath, commentData.text);
        });

        console.log(`Loaded ${pageComments.length} commented text items for current page`);
      } catch (error) {
        console.error('Error parsing saved comments:', error);
      }
    }
  });
}

// 获取元素的DOM路径
function getDomPath(element) {
  if (!element) return '';
  
  // 创建一个更稳健的DOM路径
  let path = [];
  let currentElement = element;
  
  while (currentElement && currentElement !== document.body && currentElement.parentNode) {
    let selector = currentElement.tagName.toLowerCase();
    
    // 优先使用ID，因为它通常是唯一的
    if (currentElement.id) {
      selector += `#${currentElement.id}`;
      // ID应该是唯一的，所以我们可以直接返回
      path.unshift(selector);
      break;
    } 
    
    // 如果没有ID，尝试使用类名（如果它们看起来是唯一的或很具体）
    if (currentElement.className && typeof currentElement.className === 'string') {
      const classes = currentElement.className.split(/\s+/).filter(c => c && !c.includes(':')); 
      if (classes.length > 0) {
        selector += `.${classes.join('.')}`;
      }
    }
    
    // 添加nth-child作为后备选择器，以确保唯一性
    const index = Array.from(currentElement.parentNode.children)
      .filter(node => node.tagName === currentElement.tagName)
      .indexOf(currentElement) + 1;
    
    if (index > 1) {
      selector += `:nth-child(${index})`;
    }
    
    path.unshift(selector);
    currentElement = currentElement.parentNode;
  }
  
  // 添加body作为起点
  if (path.length > 0 && path[0] !== 'body') {
    path.unshift('body');
  }
  
  return path.join(' > ');
}

// 根据DOM路径查找元素
function findElementByDomPath(domPath) {
  if (!domPath) return null;
  
  // 处理带有ID的特殊情况 - 可以直接查找
  if (domPath.includes('#')) {
    const idMatch = domPath.match(/#([^.:\s>]+)/);
    if (idMatch && idMatch[1]) {
      const element = document.getElementById(idMatch[1]);
      if (element) {
        return element;
      }
    }
  }
  
  try {
    // 尝试使用querySelector，这通常更可靠
    return document.querySelector(domPath);
  } catch (e) {
    console.warn(`Failed to query selector with path: ${domPath}. Error: ${e.message}`);
    
    // 如果querySelector失败，回退到手动解析
    const parts = domPath.split(' > ');
    let currentElement = document.body;
    
    for (const part of parts) {
      if (part === 'body') continue;
      
      let selector = '';
      let tagName = part.split(/[.:#]/)[0];
      
      // 处理ID选择器
      if (part.includes('#')) {
        const id = part.split('#')[1].split(/[.:\s]/)[0];
        selector = `#${id}`;
      } 
      // 处理类选择器
      else if (part.includes('.')) {
        const className = part.split('.').slice(1).join('.');
        selector = tagName + (className ? `.${className}` : '');
      }
      // 处理nth-child
      else if (part.includes(':nth-child(')) {
        const nthMatch = part.match(/:nth-child\((\d+)\)/);
        if (nthMatch) {
          const index = parseInt(nthMatch[1]) - 1;
          const elements = Array.from(currentElement.children).filter(el => 
            el.tagName.toLowerCase() === tagName
          );
          if (index < elements.length) {
            currentElement = elements[index];
            continue;
          } else {
            return null;
          }
        }
      } else {
        selector = tagName;
      }
      
      try {
        // 尝试在当前元素范围内查找
        const nextElement = currentElement.querySelector(selector);
        if (nextElement) {
          currentElement = nextElement;
        } else {
          return null;
        }
      } catch (innerError) {
        console.error(`Error finding element with selector "${selector}" in path ${domPath}:`, innerError);
        return null;
      }
    }
    
    return currentElement;
  }
}

// 使用保存的DOM路径和文本来高亮评论
function highlightSavedComment(domPath, text) {
  console.log(`Trying to highlight text: "${text}" in path: ${domPath}`);
  const container = findElementByDomPath(domPath);
  
  if (!container) {
    console.warn(`Cannot find element with DOM path: ${domPath}`);
    // 尝试fallback到document.body
    searchAndHighlightInBody(text);
    return;
  }
  
  // 在容器中查找文本
  searchAndHighlightText(container, text);
}

// 当无法找到特定容器时，在整个文档中搜索文本
function searchAndHighlightInBody(text) {
  console.log(`Fallback: searching for text "${text}" in entire document`);
  searchAndHighlightText(document.body, text);
}

// 递归搜索元素中的文本并高亮
function searchAndHighlightText(element, text) {
  // 先检查此元素的直接文本节点
  let found = false;
  
  // 使用TreeWalker寻找文本节点
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // 忽略空文本节点和脚本/样式内容
        if (node.nodeValue.trim() === '' || 
            ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.parentNode.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        // 接受包含目标文本的节点
        if (node.nodeValue.includes(text)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      }
    },
    false
  );
  
  while (walker.nextNode()) {
    const textNode = walker.currentNode;
    const nodeContent = textNode.nodeValue;
    
    // 检查父元素是否已经是高亮元素
    if (textNode.parentNode.classList && 
        textNode.parentNode.classList.contains('commented-text')) {
      // 已经高亮过，更新事件监听器
      // 先移除所有旧的事件监听器
      const oldSpan = textNode.parentNode;
      const newSpan = oldSpan.cloneNode(true);
      
      // 添加新的事件监听器
      newSpan.addEventListener('click', (event) => {
        // 阻止事件冒泡
        event.stopPropagation();
        showCommentList(text);
      });
      
      // 替换旧元素
      if (oldSpan.parentNode) {
        oldSpan.parentNode.replaceChild(newSpan, oldSpan);
      }
      
      console.log(`Text "${text}" already highlighted, updated event listener`);
      found = true;
      continue;
    }
    
    const index = nodeContent.indexOf(text);
    if (index !== -1) {
      try {
        const range = document.createRange();
        range.setStart(textNode, index);
        range.setEnd(textNode, index + text.length);
        
        const span = document.createElement('span');
        span.className = 'commented-text';
        span.dataset.text = text;
        
        range.surroundContents(span);
        
        // 添加点击事件
        span.addEventListener('click', (event) => {
          // 阻止事件冒泡
          event.stopPropagation();
          showCommentList(text);
        });
        
        console.log(`Successfully highlighted text: "${text}"`);
        found = true;
        break;
      } catch (error) {
        console.error(`Error highlighting text "${text}":`, error);
      }
    }
  }
  
  if (!found) {
    console.warn(`Text "${text}" not found or could not be highlighted`);
  }
  
  return found;
}

// 页面加载完成后初始化
function initialize() {
  injectStyles();
loadSettings();
  
  // 加载用户状态
  loadUserState();
  
  // 使用MutationObserver确保在DOM变化后仍能找到并高亮评论文本
  // 这对于动态加载内容的网站特别有用
  setTimeout(() => {
    loadSavedComments();
    
    // 创建一个观察器来监视DOM变化
    const observer = new MutationObserver((mutations) => {
      // 如果DOM发生重大变化，尝试重新加载评论
      let shouldReload = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0 && 
            Array.from(mutation.addedNodes).some(node => 
              node.nodeType === Node.ELEMENT_NODE && 
              (node.tagName === 'DIV' || node.tagName === 'ARTICLE' || node.tagName === 'SECTION'))) {
          shouldReload = true;
          break;
        }
      }
      
      if (shouldReload) {
        // 只尝试重新高亮已知的评论，不重新加载所有评论
        commentStore.forEach((data, text) => {
          highlightSavedComment(data.domPath, text);
        });
      }
    });
    
    // 开始观察document.body的所有子树变化
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
  }, 1000); // 延迟1秒，确保页面内容已加载
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

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

  const selection = window.getSelection();
  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer.nodeType === Node.TEXT_NODE 
    ? range.commonAncestorContainer.parentNode 
    : range.commonAncestorContainer;
  
  // 保存选中文本的DOM路径
  const domPath = getDomPath(container);
  
  // 检查是否与已有评论有重叠
  const overlappingTexts = findOverlappingCommentedTexts(selectedText);
  const hasOverlap = overlappingTexts.length > 0;

  commentDialog = document.createElement('div');
  commentDialog.className = 'comment-dialog';
  
  // 构建对话框内容，增加重叠提示
  const content = `
    <div class="dialog-header">
      <h3>发布评论</h3>
      <button class="close-btn">&times;</button>
    </div>
    <div class="dialog-body">
      <div class="selected-text">${selectedText}</div>
      ${hasOverlap ? `
        <div class="overlap-notice" style="margin: 10px 0; padding: 8px; background-color: #fffde7; border-left: 3px solid #ffc107; color: #795548;">
          <p style="margin: 0 0 5px 0; font-weight: bold;">检测到重叠的评论文本：</p>
          <ul style="margin: 0; padding-left: 20px;">
            ${overlappingTexts.map(text => `<li>"${text}"</li>`).join('')}
          </ul>
          <p style="margin: 5px 0 0 0; font-size: 12px;">您的评论将与这些内容关联显示</p>
        </div>
      ` : ''}
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
      // 保存评论 - 使用当前URL，不是初始化时的URL
      const currentUrl = getCurrentPageUrl();
      // 保存评论并获取可能合并后的文本
      const finalText = saveComment(selectedText, comment, domPath, currentUrl);
      
      // 如果文本被合并了，使用合并后的文本进行高亮
      highlightCommentedText(finalText, range, domPath);
    }
    closeDialog();
  });
}

// 保存评论到内存和localStorage
function saveComment(text, comment, domPath, url) {
  // 检查是否与现有评论有重叠
  const overlappingTexts = findOverlappingCommentedTexts(text);
  const mergedText = manageTextOverlap(text, overlappingTexts);
  
  // 生成唯一ID
  const commentId = generateUniqueId();
  const timestamp = new Date().toISOString();
  
  // 创建新评论
  const newComment = {
    id: commentId,
    comment,
    timestamp: timestamp,
    color: currentColor,
    originalText: text // 保存原始选中的文本
  };
  
  // 保存到内存
  if (!commentStore.has(mergedText)) {
    commentStore.set(mergedText, {
      domPath: domPath,
      comments: []
    });
  }
  
  // 检查是否已存在相同内容和时间的评论（防止重复添加）
  const existingCommentIndex = commentStore.get(mergedText).comments.findIndex(
    c => c.comment === comment && c.timestamp === timestamp
  );
  
  if (existingCommentIndex === -1) {
    // 如果不存在相同评论，才添加
    commentStore.get(mergedText).comments.push(newComment);
  }
  
  // 保存到localStorage
  chrome.storage.local.get(['comments'], (result) => {
    let comments = result.comments ? JSON.parse(result.comments) : [];
    
    // 查找是否已有该文本的评论
    const existingCommentIndex = comments.findIndex(
      c => c.url === url && c.text === mergedText && c.domPath === domPath
    );
    
    if (existingCommentIndex !== -1) {
      // 已存在该文本的评论列表，检查是否已有相同内容的评论
      const sameCommentExists = comments[existingCommentIndex].comments.some(
        c => c.id === commentId || (c.comment === comment && c.timestamp === timestamp)
      );
      
      if (!sameCommentExists) {
        // 如果没有相同评论，才添加新评论
        comments[existingCommentIndex].comments.push(newComment);
      }
    } else {
      // 不存在，创建新条目
      comments.push({
        url: url,
        domPath: domPath,
        text: mergedText,
        comments: [newComment]
      });
    }
    
    // 保存更新后的评论
    chrome.storage.local.set({
      comments: JSON.stringify(comments)
    }, () => {
      // 保存成功后打印确认信息
      console.log(`Saved comment for text: "${text}" (merged as: "${mergedText}") at URL: ${url}`);
      if (chrome.runtime.lastError) {
        console.error('Error saving comment:', chrome.runtime.lastError);
      }
    });
  });
  
  return mergedText; // 返回合并后的文本，用于高亮显示
}

// 生成唯一ID
function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// 高亮被评论的文本
function highlightCommentedText(text, range, domPath) {
  try {
  const span = document.createElement('span');
  span.className = 'commented-text';
    span.dataset.text = text;
    span.dataset.domPath = domPath; // 存储DOM路径便于调试
  span.textContent = text;
    
  range.deleteContents();
  range.insertNode(span);

    // 添加点击事件监听器，使用事件委托避免重复添加
    span.addEventListener('click', (event) => {
      // 阻止事件冒泡
      event.stopPropagation();
      showCommentList(text);
    }, { once: false }); // 允许多次触发，但在showCommentList中控制
    
    console.log(`Text highlighted successfully: "${text}"`);
  } catch (error) {
    console.error('Error highlighting text:', error);
  }
}

// 显示评论列表，包括重叠文本的评论
function showCommentList(text) {
  // 如果已有弹窗，则先关闭它
  if (commentListDialog) {
    commentListDialog.remove();
    commentListDialog = null;
    return; // 如果点击同一个元素，只是关闭弹窗不重新打开
  }
  
  // 获取所有相关评论，包括重叠文本的评论（已去重）
  const allComments = getAllRelatedComments(text);
  
  if (allComments.length === 0) {
    console.warn(`No comments found for text: "${text}"`);
    return;
  }
  
  commentListDialog = document.createElement('div');
  commentListDialog.className = 'comment-list-dialog';
  
  const content = `
    <div class="dialog-header">
      <h3>评论列表 (${allComments.length}条)</h3>
      <button class="close-btn">&times;</button>
    </div>
    <div class="dialog-body">
      <div class="original-text">${text}</div>
      <div class="comments-container">
        ${renderCommentItems(allComments, text)}
          </div>
      
      <div class="reply-section">
        <h4 class="reply-header">追加评论</h4>
        <div class="color-selection">
          <span class="color-label">选择颜色：</span>
          <div class="color-options">
            <span class="color-option white" data-color="white"></span>
            <span class="color-option red" data-color="red"></span>
            <span class="color-option blue" data-color="blue"></span>
            <span class="color-option green" data-color="green"></span>
            <span class="color-option yellow" data-color="yellow"></span>
            <span class="color-option purple" data-color="purple"></span>
            <span class="color-option orange" data-color="orange"></span>
            <span class="color-option gradient" data-color="gradient"></span>
          </div>
        </div>
        <textarea class="reply-textarea" placeholder="添加新评论..."></textarea>
        <button class="reply-submit-btn">发布评论</button>
      </div>
    </div>
  `;
  
  commentListDialog.innerHTML = content;
  document.body.appendChild(commentListDialog);
  
  const closeBtn = commentListDialog.querySelector('.close-btn');
  const replyTextarea = commentListDialog.querySelector('.reply-textarea');
  const replySubmitBtn = commentListDialog.querySelector('.reply-submit-btn');
  const colorOptions = commentListDialog.querySelectorAll('.color-option');
  
  // 设置初始选中颜色
  let selectedColor = currentColor;
  commentListDialog.querySelector(`.color-option[data-color="${selectedColor}"]`).classList.add('selected');
  
  // 添加颜色选择事件
  colorOptions.forEach(option => {
    option.addEventListener('click', () => {
      // 移除之前的选中状态
      colorOptions.forEach(opt => opt.classList.remove('selected'));
      // 添加新的选中状态
      option.classList.add('selected');
      // 更新选中的颜色
      selectedColor = option.dataset.color;
    });
  });
  
  // 添加回复提交事件
  replySubmitBtn.addEventListener('click', () => {
    const replyContent = replyTextarea.value.trim();
    if (replyContent) {
      // 临时保存当前颜色
      const previousColor = currentColor;
      // 设置新选择的颜色
      currentColor = selectedColor;
      
      // 保存评论
      const domPath = commentStore.get(text)?.domPath || '';
      const currentUrl = getCurrentPageUrl();
      
      // 保存评论
      saveComment(text, replyContent, domPath, currentUrl);
      
      // 发送弹幕
      createDanmu(replyContent);
      
      // 恢复之前的颜色设置
      currentColor = previousColor;
      
      // 更新评论列表
      const updatedComments = getAllRelatedComments(text);
      const commentsContainer = commentListDialog.querySelector('.comments-container');
      commentsContainer.innerHTML = renderCommentItems(updatedComments, text);
      
      // 更新评论数量显示
      const headerTitle = commentListDialog.querySelector('.dialog-header h3');
      headerTitle.textContent = `评论列表 (${updatedComments.length}条)`;
      
      // 清空输入框
      replyTextarea.value = '';
    }
  });
  
  // 添加关闭事件
  closeBtn.addEventListener('click', () => {
    commentListDialog.remove();
    commentListDialog = null;
  });
  
  // 点击弹窗外部关闭弹窗
  document.addEventListener('click', function closeDialogOutside(event) {
    if (commentListDialog && !commentListDialog.contains(event.target)) {
      commentListDialog.remove();
      commentListDialog = null;
      document.removeEventListener('click', closeDialogOutside);
    }
  });
  
  // 阻止在弹窗内的点击事件冒泡到document
  commentListDialog.addEventListener('click', (event) => {
    event.stopPropagation();
  });
}

// 渲染评论项目
function renderCommentItems(comments, currentText) {
  if (!comments || comments.length === 0) {
    return '<div class="no-comments">暂无评论</div>';
  }
  
  // 确保每个评论只渲染一次（使用ID去重）
  const uniqueCommentIds = new Set();
  const uniqueComments = [];
  
  for (const comment of comments) {
    const commentId = comment.id || `${comment.comment}_${comment.timestamp}`;
    if (!uniqueCommentIds.has(commentId)) {
      uniqueCommentIds.add(commentId);
      uniqueComments.push(comment);
    }
  }
  
  return uniqueComments.map(c => `
    <div class="comment-item ${c.color}">
      <div class="comment-content">${c.comment}</div>
      ${c.originalText && c.originalText !== currentText ? 
        `<div class="original-selection">原始选中: "${c.originalText}"</div>` : ''}
      <div class="comment-time">${new Date(c.timestamp).toLocaleString()}</div>
    </div>
  `).join('');
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
  else if (message.action === 'updateUserState') {
    // 更新用户状态
    if (message.userState) {
      userState = message.userState;
      console.log('User state updated from popup:', userState);
    }
  }
  // 返回 true 表示异步处理消息
  return true;
});

// 从storage加载用户状态
function loadUserState() {
  chrome.storage.local.get(['userState'], (result) => {
    if (result.userState) {
      try {
        userState = JSON.parse(result.userState);
        console.log('User state loaded:', userState);
        
        // 更新用户头像状态
        updateUserAvatarState();
      } catch (error) {
        console.error('Error parsing user state:', error);
        // 设置为默认未登录状态
        userState = { isLoggedIn: false, username: '', email: '', avatar: '' };
      }
    }
  });
}

// 保存用户状态到storage
function saveUserState() {
  chrome.storage.local.set({
    userState: JSON.stringify(userState)
  }, () => {
    console.log('User state saved:', userState);
    if (chrome.runtime.lastError) {
      console.error('Error saving user state:', chrome.runtime.lastError);
    }
  });
}

// 创建用户头像
function createUserAvatar() {
  const avatar = document.createElement('div');
  avatar.className = 'user-avatar';
  avatar.innerHTML = '<i>👤</i>';
  avatar.title = userState.isLoggedIn ? '查看用户菜单' : '登录/注册';
  
  // 更新状态
  updateUserAvatarState(avatar);
  
  // 添加点击事件
  avatar.addEventListener('click', handleAvatarClick);
  
  document.body.appendChild(avatar);
}

// 更新用户头像状态
function updateUserAvatarState(avatarElement = null) {
  const avatar = avatarElement || document.querySelector('.user-avatar');
  if (!avatar) return;
  
  if (userState.isLoggedIn) {
    avatar.classList.add('logged-in');
    avatar.title = '查看用户菜单';
    
    // 更新显示
    if (userState.avatar) {
      avatar.innerHTML = `<img src="${userState.avatar}" alt="${userState.username}" style="width: 100%; height: 100%; border-radius: 50%;">`;
    } else {
      // 使用用户名首字母作为头像
      const initial = userState.username ? userState.username.charAt(0).toUpperCase() : '👤';
      avatar.innerHTML = initial;
    }
  } else {
    avatar.classList.remove('logged-in');
    avatar.title = '登录/注册';
    avatar.innerHTML = '<i>👤</i>';
  }
}

// 头像点击处理
function handleAvatarClick() {
  // 已登录时，显示用户菜单
  if (userState.isLoggedIn) {
    showUserMenu();
  } else {
    // 未登录时，显示登录/注册对话框
    showAuthDialog();
  }
}

// 显示用户菜单
function showUserMenu() {
  // 如果已存在菜单，则移除
  const existingMenu = document.querySelector('.user-menu');
  if (existingMenu) {
    existingMenu.remove();
    return;
  }
  
  const menu = document.createElement('div');
  menu.className = 'user-menu';
  
  menu.innerHTML = `
    <div class="user-menu-header">
      <p class="user-name">${userState.username}</p>
      <p class="user-email">${userState.email}</p>
    </div>
    <div class="user-menu-items">
      <div class="user-menu-item">
        <i>⚙️</i> 设置
      </div>
      <div class="user-menu-item">
        <i>📋</i> 我的评论
      </div>
      <div class="user-menu-item logout">
        <i>🚪</i> 退出登录
      </div>
    </div>
  `;
  
  document.body.appendChild(menu);
  
  // 添加退出登录点击事件
  menu.querySelector('.user-menu-item.logout').addEventListener('click', () => {
    logout();
    menu.remove();
  });
  
  // 点击页面其他地方关闭菜单
  document.addEventListener('click', function closeMenuOutside(event) {
    const avatar = document.querySelector('.user-avatar');
    if (menu && !menu.contains(event.target) && 
        avatar && !avatar.contains(event.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenuOutside);
    }
  });
  
  // 禁止事件冒泡
  menu.addEventListener('click', (event) => {
    event.stopPropagation();
  });
}

// 登出处理
function logout() {
  userState = {
    isLoggedIn: false,
    username: '',
    email: '',
    avatar: ''
  };
  
  // 保存状态
  saveUserState();
  
  // 更新头像状态
  updateUserAvatarState();
  
  // 提示用户
  showToast('已成功退出登录');
}

// 显示认证对话框
function showAuthDialog(initialTab = 'login') {
  // 如果已存在弹窗，则关闭
  if (authDialog) {
    authDialog.remove();
    authDialog = null;
  }
  
  authDialog = document.createElement('div');
  authDialog.className = 'auth-dialog';
  
  authDialog.innerHTML = `
    <div class="auth-header">
      <h3 class="auth-title">欢迎使用评论系统</h3>
    </div>
    <div class="auth-tabs">
      <div class="auth-tab ${initialTab === 'login' ? 'active' : ''}" data-tab="login">登录</div>
      <div class="auth-tab ${initialTab === 'register' ? 'active' : ''}" data-tab="register">注册</div>
    </div>
    <div class="auth-content">
      <div class="auth-form login-form" style="${initialTab === 'login' ? '' : 'display: none;'}">
        <div class="form-group">
          <input type="text" class="form-input" placeholder="邮箱地址" id="login-email">
          <div class="input-icon">✉️</div>
          <div class="error-message" id="login-email-error"></div>
        </div>
        <div class="form-group">
          <input type="password" class="form-input" placeholder="密码" id="login-password">
          <div class="input-icon">🔒</div>
          <div class="error-message" id="login-password-error"></div>
        </div>
        <button class="auth-submit" id="login-btn">登录</button>
        <div class="auth-footer">
          <a href="#" class="auth-link forgot-password">忘记密码?</a>
        </div>
        <div class="auth-divider">或者</div>
        <div class="social-login">
          <div class="social-btn" title="Google登录">G</div>
          <div class="social-btn" title="GitHub登录">🐱</div>
          <div class="social-btn" title="微信登录">💬</div>
        </div>
      </div>
      <div class="auth-form register-form" style="${initialTab === 'register' ? '' : 'display: none;'}">
        <div class="form-group">
          <input type="text" class="form-input" placeholder="用户名" id="register-username">
          <div class="input-icon">👤</div>
          <div class="error-message" id="register-username-error"></div>
        </div>
        <div class="form-group">
          <input type="text" class="form-input" placeholder="邮箱地址" id="register-email">
          <div class="input-icon">✉️</div>
          <div class="error-message" id="register-email-error"></div>
        </div>
        <div class="form-group verification-code">
          <input type="text" class="form-input" placeholder="验证码" id="register-code">
          <button class="send-code-btn" id="send-code-btn">发送验证码</button>
          <div class="error-message" id="register-code-error"></div>
        </div>
        <div class="form-group">
          <input type="password" class="form-input" placeholder="密码" id="register-password">
          <div class="input-icon">🔒</div>
          <div class="error-message" id="register-password-error"></div>
        </div>
        <div class="form-group">
          <input type="password" class="form-input" placeholder="确认密码" id="register-confirm">
          <div class="input-icon">🔒</div>
          <div class="error-message" id="register-confirm-error"></div>
        </div>
        <button class="auth-submit" id="register-btn">注册</button>
        <div class="auth-footer">
          注册即表示您同意我们的<a href="#" class="auth-link">服务条款</a>和<a href="#" class="auth-link">隐私政策</a>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(authDialog);
  
  // 切换标签页事件
  const tabs = authDialog.querySelectorAll('.auth-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const tabName = tab.dataset.tab;
      authDialog.querySelector('.login-form').style.display = tabName === 'login' ? 'flex' : 'none';
      authDialog.querySelector('.register-form').style.display = tabName === 'register' ? 'flex' : 'none';
    });
  });
  
  // 登录按钮事件
  const loginBtn = authDialog.querySelector('#login-btn');
  loginBtn.addEventListener('click', handleLogin);
  
  // 注册按钮事件
  const registerBtn = authDialog.querySelector('#register-btn');
  registerBtn.addEventListener('click', handleRegister);
  
  // 发送验证码按钮事件
  const sendCodeBtn = authDialog.querySelector('#send-code-btn');
  sendCodeBtn.addEventListener('click', handleSendVerificationCode);
  
  // 关闭弹窗的点击事件
  document.addEventListener('click', function closeAuthDialogOutside(event) {
    if (authDialog && !authDialog.contains(event.target)) {
      authDialog.remove();
      authDialog = null;
      document.removeEventListener('click', closeAuthDialogOutside);
    }
  });
  
  // 阻止弹窗内点击事件冒泡
  authDialog.addEventListener('click', (event) => {
    event.stopPropagation();
  });
}

// 处理登录
function handleLogin() {
  const emailInput = document.querySelector('#login-email');
  const passwordInput = document.querySelector('#login-password');
  const emailError = document.querySelector('#login-email-error');
  const passwordError = document.querySelector('#login-password-error');
  
  // 重置错误信息
  emailError.textContent = '';
  passwordError.textContent = '';
  
  // 获取输入值
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  
  // 基本验证
  let hasError = false;
  
  if (!email) {
    emailError.textContent = '请输入邮箱地址';
    emailInput.classList.add('error');
    hasError = true;
  } else if (!isValidEmail(email)) {
    emailError.textContent = '请输入有效的邮箱地址';
    emailInput.classList.add('error');
    hasError = true;
  } else {
    emailInput.classList.remove('error');
  }
  
  if (!password) {
    passwordError.textContent = '请输入密码';
    passwordInput.classList.add('error');
    hasError = true;
  } else {
    passwordInput.classList.remove('error');
  }
  
  if (hasError) return;
  
  // 模拟登录API调用
  // 在实际项目中,应该改为调用实际的认证API
  simulateLoginApi(email, password)
    .then(response => {
      if (response.success) {
        // 更新用户状态
        userState = {
          isLoggedIn: true,
          username: response.data.username,
          email: email,
          avatar: response.data.avatar || ''
        };
        
        // 保存状态
        saveUserState();
        
        // 关闭弹窗
        if (authDialog) {
          authDialog.remove();
          authDialog = null;
        }
        
        // 更新头像状态
        updateUserAvatarState();
        
        // 提示用户
        showToast('登录成功，欢迎回来！');
      } else {
        // 显示错误信息
        if (response.error === 'invalid_credentials') {
          passwordError.textContent = '邮箱或密码不正确';
          passwordInput.classList.add('error');
        } else {
          passwordError.textContent = response.message || '登录失败，请重试';
          passwordInput.classList.add('error');
        }
      }
    })
    .catch(error => {
      console.error('Login error:', error);
      passwordError.textContent = '登录失败，请检查网络连接并重试';
      passwordInput.classList.add('error');
    });
}

// 处理注册
function handleRegister() {
  const usernameInput = document.querySelector('#register-username');
  const emailInput = document.querySelector('#register-email');
  const codeInput = document.querySelector('#register-code');
  const passwordInput = document.querySelector('#register-password');
  const confirmInput = document.querySelector('#register-confirm');
  
  const usernameError = document.querySelector('#register-username-error');
  const emailError = document.querySelector('#register-email-error');
  const codeError = document.querySelector('#register-code-error');
  const passwordError = document.querySelector('#register-password-error');
  const confirmError = document.querySelector('#register-confirm-error');
  
  // 重置错误信息
  usernameError.textContent = '';
  emailError.textContent = '';
  codeError.textContent = '';
  passwordError.textContent = '';
  confirmError.textContent = '';
  
  // 获取输入值
  const username = usernameInput.value.trim();
  const email = emailInput.value.trim();
  const code = codeInput.value.trim();
  const password = passwordInput.value.trim();
  const confirm = confirmInput.value.trim();
  
  // 验证
  let hasError = false;
  
  if (!username) {
    usernameError.textContent = '请输入用户名';
    usernameInput.classList.add('error');
    hasError = true;
  } else if (username.length < 3) {
    usernameError.textContent = '用户名至少需要3个字符';
    usernameInput.classList.add('error');
    hasError = true;
  } else {
    usernameInput.classList.remove('error');
  }
  
  if (!email) {
    emailError.textContent = '请输入邮箱地址';
    emailInput.classList.add('error');
    hasError = true;
  } else if (!isValidEmail(email)) {
    emailError.textContent = '请输入有效的邮箱地址';
    emailInput.classList.add('error');
    hasError = true;
  } else {
    emailInput.classList.remove('error');
  }
  
  if (!code) {
    codeError.textContent = '请输入验证码';
    codeInput.classList.add('error');
    hasError = true;
  } else if (code.length !== 6 || !/^\d+$/.test(code)) {
    codeError.textContent = '请输入正确的验证码';
    codeInput.classList.add('error');
    hasError = true;
  } else {
    codeInput.classList.remove('error');
  }
  
  if (!password) {
    passwordError.textContent = '请输入密码';
    passwordInput.classList.add('error');
    hasError = true;
  } else if (password.length < 6) {
    passwordError.textContent = '密码长度至少为6个字符';
    passwordInput.classList.add('error');
    hasError = true;
  } else {
    passwordInput.classList.remove('error');
  }
  
  if (!confirm) {
    confirmError.textContent = '请确认密码';
    confirmInput.classList.add('error');
    hasError = true;
  } else if (confirm !== password) {
    confirmError.textContent = '两次输入的密码不一致';
    confirmInput.classList.add('error');
    hasError = true;
  } else {
    confirmInput.classList.remove('error');
  }
  
  if (hasError) return;
  
  // 模拟注册API调用
  simulateRegisterApi(username, email, code, password)
    .then(response => {
      if (response.success) {
        // 更新用户状态
        userState = {
          isLoggedIn: true,
          username: username,
          email: email,
          avatar: response.data?.avatar || ''
        };
        
        // 保存状态
        saveUserState();
        
        // 关闭弹窗
        if (authDialog) {
          authDialog.remove();
          authDialog = null;
        }
        
        // 更新头像状态
        updateUserAvatarState();
        
        // 提示用户
        showToast('注册成功，欢迎加入！');
      } else {
        // 显示错误信息
        if (response.error === 'invalid_code') {
          codeError.textContent = '验证码不正确或已过期';
          codeInput.classList.add('error');
        } else if (response.error === 'email_exists') {
          emailError.textContent = '该邮箱已被注册';
          emailInput.classList.add('error');
        } else if (response.error === 'username_exists') {
          usernameError.textContent = '该用户名已被使用';
          usernameInput.classList.add('error');
        } else {
          confirmError.textContent = response.message || '注册失败，请重试';
        }
      }
    })
    .catch(error => {
      console.error('Register error:', error);
      confirmError.textContent = '注册失败，请检查网络连接并重试';
    });
}

// 处理发送验证码
function handleSendVerificationCode() {
  const emailInput = document.querySelector('#register-email');
  const emailError = document.querySelector('#register-email-error');
  const sendCodeBtn = document.querySelector('#send-code-btn');
  
  // 重置错误信息
  emailError.textContent = '';
  
  // 获取输入值
  const email = emailInput.value.trim();
  
  // 验证
  if (!email) {
    emailError.textContent = '请输入邮箱地址';
    emailInput.classList.add('error');
    return;
  } else if (!isValidEmail(email)) {
    emailError.textContent = '请输入有效的邮箱地址';
    emailInput.classList.add('error');
    return;
  } else {
    emailInput.classList.remove('error');
  }
  
  // 禁用按钮，显示倒计时
  sendCodeBtn.disabled = true;
  let countdown = 60;
  sendCodeBtn.textContent = `${countdown}秒后重新发送`;
  
  const timer = setInterval(() => {
    countdown--;
    if (countdown <= 0) {
      clearInterval(timer);
      sendCodeBtn.disabled = false;
      sendCodeBtn.textContent = '发送验证码';
    } else {
      sendCodeBtn.textContent = `${countdown}秒后重新发送`;
    }
  }, 1000);
  
  // 模拟发送验证码API调用
  simulateSendCodeApi(email)
    .then(response => {
      if (response.success) {
        showToast('验证码已发送到您的邮箱');
      } else {
        emailError.textContent = response.message || '发送验证码失败';
        emailInput.classList.add('error');
        
        // 重置按钮状态
        clearInterval(timer);
        sendCodeBtn.disabled = false;
        sendCodeBtn.textContent = '重新发送';
      }
    })
    .catch(error => {
      console.error('Send code error:', error);
      emailError.textContent = '发送验证码失败，请重试';
      emailInput.classList.add('error');
      
      // 重置按钮状态
      clearInterval(timer);
      sendCodeBtn.disabled = false;
      sendCodeBtn.textContent = '重新发送';
    });
}

// 显示Toast提示
function showToast(message, duration = 3000) {
  // 移除已存在的toast
  const existingToast = document.querySelector('.toast-message');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement('div');
  toast.className = 'toast-message';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 10002;
    animation: fadeInUp 0.3s ease;
  `;
  
  document.body.appendChild(toast);
  
  // 添加淡入淡出动画
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeInUp {
      from { opacity: 0; transform: translate(-50%, 20px); }
      to { opacity: 1; transform: translate(-50%, 0); }
    }
    
    @keyframes fadeOut {
      from { opacity: 1; transform: translate(-50%, 0); }
      to { opacity: 0; transform: translate(-50%, -20px); }
    }
  `;
  document.head.appendChild(style);
  
  // 设置自动消失
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration);
}

// 验证邮箱格式
function isValidEmail(email) {
  const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
}

// 模拟API调用
function simulateLoginApi(email, password) {
  return new Promise((resolve, reject) => {
    // 模拟网络延迟
    setTimeout(() => {
      // 演示用途，接受任何以@example.com结尾的邮箱
      if (email.endsWith('@example.com') && password.length >= 6) {
        resolve({
          success: true,
          data: {
            username: email.split('@')[0],
            email: email,
            avatar: ''
          }
        });
      } else {
        resolve({
          success: false,
          error: 'invalid_credentials',
          message: '邮箱或密码不正确'
        });
      }
    }, 800);
  });
}

function simulateRegisterApi(username, email, code, password) {
  return new Promise((resolve, reject) => {
    // 模拟网络延迟
    setTimeout(() => {
      // 演示用途，验证码123456总是有效
      if (code === '123456') {
        resolve({
          success: true,
          data: {
            username: username,
            email: email,
            avatar: ''
          }
        });
      } else {
        resolve({
          success: false,
          error: 'invalid_code',
          message: '验证码不正确或已过期'
        });
      }
    }, 800);
  });
}

function simulateSendCodeApi(email) {
  return new Promise((resolve, reject) => {
    // 模拟网络延迟
    setTimeout(() => {
      resolve({
        success: true,
        message: '验证码已发送，演示用验证码为123456'
      });
    }, 800);
  });
}