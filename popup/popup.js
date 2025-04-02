document.addEventListener('DOMContentLoaded', function() {
  const toggleButton = document.getElementById('toggleChat');
  const danmuToggle = document.getElementById('toggleDanmu');
  const danmuColor = document.getElementById('danmuColor');
  const opacitySlider = document.getElementById('opacitySlider');
  const opacityValue = document.getElementById('opacityValue');
  
  // 用户认证相关元素
  const loginBtn = document.getElementById('loginBtn');
  const guestView = document.getElementById('guestView');
  const userView = document.getElementById('userView');
  const logoutBtn = document.getElementById('logoutBtn');
  const authDialog = document.getElementById('authDialog');
  const closeAuthBtn = document.getElementById('closeAuthBtn');
  const authTabs = document.querySelectorAll('.auth-tab');
  const loginForm = document.querySelector('.login-form');
  const registerForm = document.querySelector('.register-form');
  
  let danmuEnabled = false;
  let userState = {
    isLoggedIn: false,
    username: '',
    email: '',
    avatar: ''
  };
  
  // 在弹出面板打开时获取当前弹幕状态和用户状态
  async function getCurrentState() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        // 获取弹幕状态
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
        
        // 获取用户状态
        chrome.storage.local.get(['userState'], (result) => {
          if (result.userState) {
            try {
              userState = JSON.parse(result.userState);
              updateUserUI();
            } catch (error) {
              console.error('Error parsing user state:', error);
              userState = { isLoggedIn: false, username: '', email: '', avatar: '' };
            }
          }
        });
      }
    } catch (error) {
      console.error('Error getting state:', error);
    }
  }
  
  getCurrentState();
  
  // 更新用户界面
  function updateUserUI() {
    if (userState.isLoggedIn) {
      guestView.style.display = 'none';
      userView.style.display = 'block';
      
      // 更新用户头像和信息
      const userAvatar = document.getElementById('userAvatar');
      const username = document.getElementById('username');
      const userEmail = document.getElementById('userEmail');
      
      if (userState.avatar) {
        userAvatar.innerHTML = `<img src="${userState.avatar}" style="width: 100%; height: 100%; border-radius: 50%;">`;
      } else {
        const initial = userState.username ? userState.username.charAt(0).toUpperCase() : 'U';
        userAvatar.textContent = initial;
      }
      
      username.textContent = userState.username || '用户';
      userEmail.textContent = userState.email || '';
    } else {
      guestView.style.display = 'block';
      userView.style.display = 'none';
    }
  }
  
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
  addRippleEffect(loginBtn);
  addRippleEffect(logoutBtn);
  
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
  
  // ===== 用户认证相关 =====
  
  // 登录按钮点击显示登录/注册对话框
  loginBtn.addEventListener('click', () => {
    authDialog.style.display = 'flex';
  });
  
  // 关闭认证对话框
  closeAuthBtn.addEventListener('click', () => {
    authDialog.style.display = 'none';
  });
  
  // 注册标签页切换
  authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // 移除所有标签页的活动状态
      authTabs.forEach(t => t.classList.remove('active'));
      
      // 添加当前标签页的活动状态
      tab.classList.add('active');
      
      // 显示对应的表单
      const tabName = tab.dataset.tab;
      if (tabName === 'login') {
        loginForm.style.display = 'flex';
        registerForm.style.display = 'none';
      } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'flex';
      }
    });
  });
  
  // 登录按钮点击处理
  document.getElementById('login-btn').addEventListener('click', handleLogin);
  
  // 注册按钮点击处理
  document.getElementById('register-btn').addEventListener('click', handleRegister);
  
  // 发送验证码按钮点击处理
  document.getElementById('send-code-btn').addEventListener('click', handleSendVerificationCode);
  
  // 退出登录按钮点击处理
  logoutBtn.addEventListener('click', handleLogout);
  
  // 处理登录
  function handleLogin() {
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const emailError = document.getElementById('login-email-error');
    const passwordError = document.getElementById('login-password-error');
    
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
          authDialog.style.display = 'none';
          
          // 更新UI
          updateUserUI();
          
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
    const usernameInput = document.getElementById('register-username');
    const emailInput = document.getElementById('register-email');
    const codeInput = document.getElementById('register-code');
    const passwordInput = document.getElementById('register-password');
    const confirmInput = document.getElementById('register-confirm');
    
    const usernameError = document.getElementById('register-username-error');
    const emailError = document.getElementById('register-email-error');
    const codeError = document.getElementById('register-code-error');
    const passwordError = document.getElementById('register-password-error');
    const confirmError = document.getElementById('register-confirm-error');
    
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
          authDialog.style.display = 'none';
          
          // 更新UI
          updateUserUI();
          
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
    const emailInput = document.getElementById('register-email');
    const emailError = document.getElementById('register-email-error');
    const sendCodeBtn = document.getElementById('send-code-btn');
    
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
          showToast('验证码已发送到您的邮箱（演示用验证码：123456）');
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

  // 处理退出登录
  function handleLogout() {
    userState = {
      isLoggedIn: false,
      username: '',
      email: '',
      avatar: ''
    };
    
    // 保存状态
    saveUserState();
    
    // 更新UI
    updateUserUI();
    
    // 提示用户
    showToast('已成功退出登录');
  }
  
  // 保存用户状态
  function saveUserState() {
    chrome.storage.local.set({
      userState: JSON.stringify(userState)
    }, () => {
      console.log('User state saved:', userState);
      
      // 发消息通知content script更新用户状态
      (async () => {
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab) {
            chrome.tabs.sendMessage(tab.id, { 
              action: 'updateUserState',
              userState: userState
            });
          }
        } catch (error) {
          console.error('Error notifying content script:', error);
        }
      })();
    });
  }
  
  // 显示Toast提示
  function showToast(message, duration = 3000) {
    // 移除可能已存在的toast
    const existingToast = document.querySelector('.toast-message');
    if (existingToast) {
      existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.75);
      color: white;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      z-index: 10002;
      animation: fadeInUp 0.3s ease;
      max-width: 280px;
      text-align: center;
      box-shadow: 0 3px 8px rgba(0,0,0,0.15);
    `;
    
    document.body.appendChild(toast);
    
    // 添加淡入淡出动画样式
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
  
  // 模拟API调用 - 登录
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
            message: '邮箱或密码不正确（演示账号：用户名@example.com）'
          });
        }
      }, 800);
    });
  }
  
  // 模拟API调用 - 注册
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
  
  // 模拟API调用 - 发送验证码
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
});