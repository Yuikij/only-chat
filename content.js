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
  // 返回 true 表示异步处理消息
  return true;
});