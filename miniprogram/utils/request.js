
// miniprogram/utils/request.js
// 统一封装 wx.request，自动注入 Authorization: Bearer token，并处理 401

const BASE_URL = 'http://172.20.10.2:8080'; // 如需 HTTPS，请改为 https://172.20.10.2:8080

/**
 * 统一请求封装
 * @param {Object} options
 * @param {string} options.url - 以 / 开头的后端路径，如 /api/profile
 * @param {string} [options.method='GET'] - HTTP 方法
 * @param {Object} [options.data={}] - 请求体或查询参数
 * @param {Object} [options.headers={}] - 额外请求头（会与默认头合并）
 * @returns {Promise<WechatMiniprogram.RequestSuccessCallbackResult>}
 */
function request({ url, method = 'GET', data = {}, headers = {} }) {
  const token = wx.getStorageSync('token');
  const finalHeaders = {
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : '',
    ...headers,
  };

  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + url,
      method,
      data,
      header: finalHeaders,
      success: (res) => {
        // 统一处理 401（token 过期/无效）
        if (res.statusCode === 401) {
          try {
            wx.removeStorageSync('token');
          } catch (e) {}
          // 可在此触发登录重定向或事件通知
          // wx.navigateTo({ url: '/pages/login/index' });
          reject(res);
          return;
        }

        // 成功时自动保存后端返回的 token（响应头或响应体）
        try {
          const headerAuth = (res.header && (res.header.Authorization || res.header.authorization)) || '';
          if (headerAuth && headerAuth.startsWith('Bearer ')) {
            const newToken = headerAuth.slice(7);
            if (newToken) setToken(newToken);
          } else if (res.data) {
            // res.data 可能是字符串
            let body = res.data;
            if (typeof body === 'string') {
              try { body = JSON.parse(body); } catch (e) {}
            }
            const newToken = body && body.token;
            if (typeof newToken === 'string' && newToken) {
              setToken(newToken);
            }
          }
        } catch (e) {}

        resolve(res);
      },
      fail: (err) => {
        reject(err);
      },
    });
  });
}

/**
 * 便捷方法：GET
 */
function get(url, params = {}, headers = {}) {
  return request({ url, method: 'GET', data: params, headers });
}

/**
 * 便捷方法：POST（JSON）
 */
function post(url, body = {}, headers = {}) {
  return request({ url, method: 'POST', data: body, headers });
}

/**
 * 便捷方法：上传文件（自动携带 Authorization: Bearer）
 * @param {Object} options
 * @param {string} options.url - 以 / 开头的后端路径，如 /api/photos/upload
 * @param {string} options.filePath - 本地文件路径（如选择图片得到的 tempFilePath）
 * @param {string} [options.name='file'] - 后端接收的文件字段名
 * @param {Object} [options.formData={}] - 额外表单字段
 * @param {Object} [options.headers={}] - 额外请求头（会与默认头合并）
 * @returns {Promise<WechatMiniprogram.UploadFileSuccessCallbackResult>}
 */
function upload({ url, filePath, name = 'file', formData = {}, headers = {} }) {
  const token = wx.getStorageSync('token');
  const finalHeaders = {
    Authorization: token ? `Bearer ${token}` : '',
    ...headers,
  };

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: BASE_URL + url,
      filePath,
      name,
      formData,
      header: finalHeaders,
      success: (res) => {
        // 统一处理 401（token 过期/无效）
        if (res.statusCode === 401) {
          try {
            wx.removeStorageSync('token');
          } catch (e) {}
          reject(res);
          return;
        }

        // 成功时自动保存后端返回的 token（响应头或响应体）
        try {
          const headerAuth = (res.header && (res.header.Authorization || res.header.authorization)) || '';
          if (headerAuth && headerAuth.startsWith('Bearer ')) {
            const newToken = headerAuth.slice(7);
            if (newToken) setToken(newToken);
          } else if (res.data) {
            let body = res.data;
            if (typeof body === 'string') {
              try { body = JSON.parse(body); } catch (e) {}
            }
            const newToken = body && body.token;
            if (typeof newToken === 'string' && newToken) {
              setToken(newToken);
            }
          }
        } catch (e) {}

        resolve(res);
      },
      fail: (err) => {
        reject(err);
      },
    });
  });
}

/**
 * 设置/更新 token（可在登录成功后调用）
 * @param {string} token
 */
function setToken(token) {
  wx.setStorageSync('token', token);
}

/**
 * 清除 token
 */
function clearToken() {
  wx.removeStorageSync('token');
}

module.exports = {
  request,
  get,
  post,
  upload,
  setToken,
  clearToken,
  BASE_URL, // 如需在别处读取
};