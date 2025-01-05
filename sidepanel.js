// 模拟成员数据
const members = [
  {
    id: 1,
    name: '用户1',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=1'
  },
  {
    id: 2,
    name: '用户2',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=2'
  },
  {
    id: 3,
    name: '用户3',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=3'
  },
  {
    id: 4,
    name: '用户4',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=4'
  },
  {
    id: 5,
    name: '用户5',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=5'
  }
];

// 渲染成员列表
function renderMemberList() {
  const memberList = document.getElementById('memberList');
  const onlineCount = document.getElementById('onlineCount');
  
  // 更新在线人数
  onlineCount.textContent = `在线: ${members.length}`;
  
  // 清空现有列表
  memberList.innerHTML = '';
  
  // 添加成员
  members.forEach(member => {
    const memberItem = document.createElement('div');
    memberItem.className = 'member-item';
    memberItem.innerHTML = `
      <img class="member-avatar" src="${member.avatar}" alt="${member.name}">
      <span class="member-name">${member.name}</span>
    `;
    
    // 点击成员时的处理
    memberItem.addEventListener('click', () => {
      console.log(`Clicked member: ${member.name}`);
      // 这里可以添加点击成员后的操作，比如打开私聊等
    });
    
    memberList.appendChild(memberItem);
  });
}

// 页面加载时渲染成员列表
document.addEventListener('DOMContentLoaded', () => {
  renderMemberList();
});

// 模拟新成员加入
setInterval(() => {
  if (members.length < 10) {  // 限制最大成员数
    const newId = members.length + 1;
    members.push({
      id: newId,
      name: `用户${newId}`,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newId}`
    });
    renderMemberList();
  }
}, 5000);  // 每5秒添加一个新成员 