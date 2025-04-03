import ApiService from './api.js';

/**
 * 用户认证服务
 */
class AuthService {
  /**
   * 保存用户信息到本地存储
   * @param {Object} userData - 用户数据
   */
  static saveUserToStorage(userData) {
    localStorage.setItem('user', JSON.stringify(userData));
  }

  /**
   * 从本地存储获取用户信息
   * @returns {Object|null} 用户数据或null
   */
  static getUserFromStorage() {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  }

  /**
   * 从本地存储清除用户信息
   */
  static clearUserFromStorage() {
    localStorage.removeItem('user');
  }

  /**
   * 用户登录
   * @param {Object} credentials - 登录凭证 {email, password}
   * @returns {Promise<Object>} 登录结果
   */
  static async login(credentials) {
    try {
      const response = await ApiService.login(credentials);
      
      if (response.success && response.data) {
        this.saveUserToStorage(response.data);
      }
      
      return response;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * 用户注册
   * @param {Object} userData - 注册数据 {email, password, code}
   * @returns {Promise<Object>} 注册结果
   */
  static async register(userData) {
    try {
      const response = await ApiService.register(userData);
      
      if (response.success && response.data) {
        this.saveUserToStorage(response.data);
      }
      
      return response;
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  }

  /**
   * 发送验证码
   * @param {string} email - 邮箱地址
   * @returns {Promise<Object>} 发送结果
   */
  static async sendVerificationCode(email) {
    try {
      return await ApiService.sendVerificationCode(email);
    } catch (error) {
      console.error('Send verification code error:', error);
      throw error;
    }
  }

  /**
   * 用户登出
   */
  static logout() {
    this.clearUserFromStorage();
  }

  /**
   * 检查用户是否已登录
   * @returns {boolean} 是否已登录
   */
  static isLoggedIn() {
    return !!this.getUserFromStorage();
  }
}

export default AuthService; 