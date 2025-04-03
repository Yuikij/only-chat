import API_CONFIG from '../config.js';

/**
 * 通用请求方法
 * @param {string} endpoint - API端点
 * @param {Object} options - 请求选项
 * @returns {Promise<any>} 响应数据
 */
async function request(endpoint, options = {}) {
  const url = `${API_CONFIG.BASE_URL}${endpoint}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: API_CONFIG.TIMEOUT,
  };
  
  const fetchOptions = { ...defaultOptions, ...options };
  
  try {
    const controller = new AbortController();
    const { signal } = controller;
    
    // 设置超时
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
    
    const response = await fetch(url, { ...fetchOptions, signal });
    clearTimeout(timeoutId);
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || '请求失败');
    }
    
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('请求超时');
    }
    throw error;
  }
}

/**
 * API服务类
 */
class ApiService {
  /**
   * 用户登录
   * @param {Object} credentials - 登录凭证
   * @returns {Promise<any>} 登录响应
   */
  static async login(credentials) {
    return request(API_CONFIG.ENDPOINTS.LOGIN, {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }
  
  /**
   * 用户注册
   * @param {Object} userData - 注册数据
   * @returns {Promise<any>} 注册响应
   */
  static async register(userData) {
    return request(API_CONFIG.ENDPOINTS.REGISTER, {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }
  
  /**
   * 发送验证码
   * @param {string} email - 邮箱地址
   * @returns {Promise<any>} 发送验证码响应
   */
  static async sendVerificationCode(email) {
    return request(API_CONFIG.ENDPOINTS.VERIFICATION_CODE, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }
}

export default ApiService; 