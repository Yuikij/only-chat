import AuthService from '../services/auth.js';
import Toast from '../utils/toast.js';

/**
 * 更新用户界面
 */
export function updateUserUI() {
  const isLoggedIn = AuthService.isLoggedIn();
  const user = AuthService.getUserFromStorage();
  
  const userSection = document.querySelector('.user-section');
  
  if (userSection) {
    if (isLoggedIn && user) {
      console.log("user",user)
      // 已登录状态
      userSection.innerHTML = `
        <div class="user-info">
          <div class="user-avatar">${user.username ? user.username.charAt(0).toUpperCase() : 'U'}</div>
          <div class="user-details">
            <div class="username">${user.username || '用户'}</div>
            <div class="user-email">${user.username}</div>
          </div>
        </div>
        <button class="logout-btn">退出登录</button>
      `;
      
      // 添加登出事件
      document.querySelector('.logout-btn').addEventListener('click', handleLogout);
    } else {
      // 未登录状态
      userSection.innerHTML = `
        <div class="guest-view">
          <button class="auth-btn">
            <i class="fas fa-user-circle"></i>
            登录 / 注册
          </button>
        </div>
      `;
      
      // 添加登录对话框事件
      document.querySelector('.auth-btn').addEventListener('click', openAuthDialog);
    }
  }
}

/**
 * 处理登出
 */
export function handleLogout() {
  AuthService.logout();
  updateUserUI();
  Toast.info('已成功登出');
}

/**
 * 验证邮箱格式
 * @param {string} email - 邮箱地址
 * @returns {boolean} 是否合法
 */
export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * 打开认证对话框
 */
export function openAuthDialog() {
  const authDialog = document.querySelector('.auth-dialog');
  if (authDialog) {
    authDialog.style.display = 'flex';
    
    // 默认显示登录表单
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.auth-tab[data-tab="login"]').classList.add('active');
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
    
    // 清空表单
    document.getElementById('login-form').reset();
    document.getElementById('register-form').reset();
    
    // 清除错误信息
    document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
  }
}

/**
 * 关闭认证对话框
 */
export function closeAuthDialog() {
  const authDialog = document.querySelector('.auth-dialog');
  if (authDialog) {
    authDialog.style.display = 'none';
  }
}

/**
 * 处理登录表单提交
 * @param {Event} e - 表单提交事件
 */
export async function handleLoginSubmit(e) {
  e.preventDefault();
  
  // 获取表单数据
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  
  // 简单验证
  if (!validateEmail(email)) {
    document.getElementById('login-email-error').textContent = '请输入有效的邮箱地址';
    return;
  }
  
  if (!password) {
    document.getElementById('login-password-error').textContent = '请输入密码';
    return;
  }
  
  // 清除错误提示
  document.querySelectorAll('#login-form .error-message').forEach(el => el.textContent = '');
  
  try {
    // 显示加载状态
    const submitBtn = e.target.querySelector('.auth-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = '登录中...';
    
    // 调用登录接口
    const response = await AuthService.login({ username:email, password });
    
    if (response.success) {
      // 登录成功
      Toast.success('登录成功');
      closeAuthDialog();
      updateUserUI();
    } else {
      // 登录失败
      Toast.error(response.message || '登录失败，请重试');
    }
  } catch (error) {
    Toast.error(error.message || '网络错误，请稍后重试');
  } finally {
    // 恢复按钮状态
    const submitBtn = e.target.querySelector('.auth-submit');
    submitBtn.disabled = false;
    submitBtn.textContent = '登录';
  }
}

/**
 * 处理注册表单提交
 * @param {Event} e - 表单提交事件
 */
export async function handleRegisterSubmit(e) {
  e.preventDefault();
  
  // 获取表单数据
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  const code = document.getElementById('verification-code').value;
  
  // 简单验证
  if (!validateEmail(email)) {
    document.getElementById('register-email-error').textContent = '请输入有效的邮箱地址';
    return;
  }
  
  if (!password || password.length < 6) {
    document.getElementById('register-password-error').textContent = '密码至少需要6个字符';
    return;
  }
  
  if (!code) {
    document.getElementById('verification-code-error').textContent = '请输入验证码';
    return;
  }
  
  // 清除错误提示
  document.querySelectorAll('#register-form .error-message').forEach(el => el.textContent = '');
  
  try {
    // 显示加载状态
    const submitBtn = e.target.querySelector('.auth-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = '注册中...';
    
    // 调用注册接口
    const response = await AuthService.register({ username:email, password, code });
    
    if (response.success) {
      // 注册成功
      Toast.success('注册成功');
      closeAuthDialog();
      updateUserUI();
    } else {
      // 注册失败
      Toast.error(response.message || '注册失败，请重试');
    }
  } catch (error) {
    Toast.error(error.message || '网络错误，请稍后重试');
  } finally {
    // 恢复按钮状态
    const submitBtn = e.target.querySelector('.auth-submit');
    submitBtn.disabled = false;
    submitBtn.textContent = '注册';
  }
}

/**
 * 发送验证码
 */
export async function sendVerificationCode() {
  debugger;
  console.log("sendVerificationCode");
  const email = document.getElementById('register-email').value;
  
  if (!validateEmail(email)) {
    document.getElementById('register-email-error').textContent = '请输入有效的邮箱地址';
    return;
  }
  
  const sendCodeBtn = document.getElementById('send-code-btn');
  
  // 禁用按钮并倒计时
  sendCodeBtn.disabled = true;
  let countDown = 60;
  sendCodeBtn.textContent = `${countDown}秒后重试`;
  
  const timer = setInterval(() => {
    countDown--;
    if (countDown <= 0) {
      clearInterval(timer);
      sendCodeBtn.disabled = false;
      sendCodeBtn.textContent = '发送验证码';
    } else {
      sendCodeBtn.textContent = `${countDown}秒后重试`;
    }
  }, 1000);
  
  try {
    // 调用发送验证码接口
    const response = await AuthService.sendVerificationCode(email);
    
    if (response.success) {
      Toast.success('验证码已发送到您的邮箱');
    } else {
      Toast.error(response.message || '发送验证码失败，请重试');
      clearInterval(timer);
      sendCodeBtn.disabled = false;
      sendCodeBtn.textContent = '发送验证码';
    }
  } catch (error) {
    Toast.error(error.message || '网络错误，请稍后重试');
    clearInterval(timer);
    sendCodeBtn.disabled = false;
    sendCodeBtn.textContent = '发送验证码';
  }
}

/**
 * 初始化认证相关功能
 */
export function initAuth() {
  // 初始化时更新用户界面
  updateUserUI();
  
  // 登录表单事件处理
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }
  
  // 注册表单事件处理
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegisterSubmit);
  }
  
  // 发送验证码按钮事件处理
  const sendCodeBtn = document.getElementById('send-code-btn');
  if (sendCodeBtn) {
    sendCodeBtn.addEventListener('click', sendVerificationCode);
  }
  
  // 标签切换事件处理
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', function() {
      // 移除所有标签的active类
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      
      // 添加当前标签的active类
      this.classList.add('active');
      
      // 切换表单显示
      const tabName = this.getAttribute('data-tab');
      if (tabName === 'login') {
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('register-form').style.display = 'none';
      } else {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'block';
      }
    });
  });
  
  // 关闭对话框按钮事件处理
  const closeAuthBtn = document.querySelector('.close-auth-btn');
  if (closeAuthBtn) {
    closeAuthBtn.addEventListener('click', closeAuthDialog);
  }
  
  // 登录按钮事件处理
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', openAuthDialog);
  }
  
  // 退出登录按钮事件处理
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
}

// 获取用户状态
export function getUserState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['userState'], (result) => {
      if (result.userState) {
        try {
          const userState = JSON.parse(result.userState);
          resolve(userState);
        } catch (error) {
          console.error('Error parsing user state:', error);
          resolve({ isLoggedIn: false, username: '', email: '', avatar: '' });
        }
      } else {
        resolve({ isLoggedIn: false, username: '', email: '', avatar: '' });
      }
    });
  });
}

// 保存用户状态
export function saveUserState(userState) {
  return new Promise((resolve) => {
    chrome.storage.local.set({
      userState: JSON.stringify(userState)
    }, () => {
      console.log('User state saved:', userState);
      resolve(true);
    });
  });
} 