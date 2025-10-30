
/**
 * miniprogram/utils/request.js
 * 统一封装：
 * - 自动注入 Authorization: Bearer token
 * - 自动随请求传递 userId（GET/DELETE: query；其他方法与上传: body/formData）
 * - 处理 401
 */
const { getAuth, saveAuth } = require('./storage');

const BASE_URL = 'http://172.20.10.2:8080'; // 如需 HTTPS，请改为 https://你的域名

// 统一清理本地登录态（token/auth_token 以及持久化的 auth）
function clearAuthTokens() {
  try { wx.removeStorageSync('token'); } catch (e) {}
  try { wx.removeStorageSync('auth_token'); } catch (e) {}
  try { saveAuth({ token: '', userId: undefined }); } catch (e) {}
}

/**
 * 统一请求封装
 * @param {Object} options
 * @param {string} options.url - 以 / 开头的后端路径，如 /api/profile
 * @param {string} [options.method='GET'] - HTTP 方法
 * @param {Object} [options.data={}] - 请求体或查询参数
 * @param {Object} [options.headers={}] - 额外请求头（会与默认头合并）
 * @returns {Promise<WechatMiniprogram.RequestSuccessCallbackResult>}
 */
function request({ url, method = 'GET', data = {}, headers = {}, timeout }) {
  const auth = getAuth() || {};
  const token = auth.token || '';
  const userId = auth.userId;

  const finalHeaders = {
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : '',
    ...headers,
  };

  // 将 userId 注入到请求
  const m = String(method || 'GET').toUpperCase();
  let finalUrl = url;
  let finalData = data || {};
  if (m === 'GET' || m === 'DELETE') {
    // 拼到 query
    const query = new URLSearchParams(
      Object.entries({ ...finalData, userId }).reduce((acc, [k, v]) => {
        if (v !== undefined && v !== null && String(v) !== '') acc[k] = String(v);
        return acc;
      }, {})
    ).toString();
    finalUrl = query ? `${url}${url.includes('?') ? '&' : '?'}${query}` : url;
    finalData = undefined;
  } else {
    // 放到 body
    finalData = { userId, ...finalData };
  }

  const baseTimeout = typeof timeout === 'number' ? timeout : 60000;
  const timeoutScaled = Math.floor(baseTimeout * 1.5);

  return new Promise((resolve, reject) => {
    wx.request({
      url: (finalUrl.startsWith('http://') || finalUrl.startsWith('https://')) ? finalUrl : (BASE_URL + finalUrl),
      method: m,
      data: finalData,
      header: finalHeaders,
      timeout: timeoutScaled,
      success: (res) => {
        // 统一处理 401（token 过期/无效）
        if (res.statusCode === 401 || res.statusCode === 403) {
          clearAuthTokens();
          // 可在此触发登录重定向或事件通知
          // wx.navigateTo({ url: '/pages/profile/index' });
          reject(res);
          return;
        }

        // 成功时自动保存后端返回的 token（响应头或响应体）
        try {
          const headerAuth = (res.header && (res.header.Authorization || res.header.authorization)) || '';
          let newToken = '';
          if (headerAuth && headerAuth.startsWith('Bearer ')) {
            newToken = headerAuth.slice(7);
          } else if (res.data) {
            // res.data 可能是字符串
            let body = res.data;
            if (typeof body === 'string') {
              try { body = JSON.parse(body); } catch (e) {}
            }
            newToken = body && body.token || '';
          }
          if (typeof newToken === 'string' && newToken) {
            setToken(newToken);
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
function upload({ url, filePath, name = 'file', formData = {}, headers = {}, timeout }) {
  const auth = getAuth() || {};
  const token = auth.token || '';
  const userId = auth.userId;

  const finalHeaders = {
    Authorization: token ? `Bearer ${token}` : '',
    ...headers,
  };

  const finalForm = { userId, ...(formData || {}) };

  const baseTimeout = typeof timeout === 'number' ? timeout : 60000;
  const timeoutScaled = Math.floor(baseTimeout * 1.5);

  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: (url.startsWith('http://') || url.startsWith('https://')) ? url : (BASE_URL + url),
      filePath,
      name,
      formData: finalForm,
      header: finalHeaders,
      timeout: timeoutScaled,
      success: (res) => {
        // 统一处理 401（token 过期/无效）
        if (res.statusCode === 401 || res.statusCode === 403) {
          clearAuthTokens();
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
  try { wx.setStorageSync('token', token); } catch (e) {}
  try { wx.setStorageSync('auth_token', token); } catch (e) {}
  try { saveAuth({ token }); } catch (e) {}
}

/**
 * 清除 token
 */
function clearToken() {
  clearAuthTokens();
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