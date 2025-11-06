// 统一授权登录工具（HTTP接口版）
const getBaseUrl = () => {
  try {
    const v = wx.getStorageSync('api_base');
    if (v && typeof v === 'string') return v;
  } catch (e) {}
  return 'http://172.20.10.2:8080';
};

// axios 适配器（微信小程序环境），若依赖存在则使用 axios，否则回退到 wx.request
function getAxios() {
  try {
    const axios = require('axios');
    const mpAdapter = require('axios-miniprogram-adapter');
    if (axios && mpAdapter) {
      axios.defaults.adapter = mpAdapter.default || mpAdapter;
      return axios;
    }
  } catch (e) {}
  return null;
}

function requestLogin({ loginCode, userInfoCode, userInfo }) {
  const base = getBaseUrl();
  console.log('login payload:', { loginCode, userInfoCode, hasUserInfo: !!userInfo, base });
  const axios = getAxios(); // 仅兜底使用
  const url = base + '/api/user/login';
  const payload = {
    loginCode: String(loginCode || ''),
    userInfoCode: String(userInfoCode || ''),
    userInfo: userInfo ? JSON.stringify(userInfo) : ''
  };
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'accept': 'application/json'
  };

  // 优先使用 wx.request，并将数据以字符串提交
  const baseTimeout = 60000;
  const timeoutScaled = Math.floor(baseTimeout * 1.5);
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: 'POST',
      header: headers,
      timeout: timeoutScaled,
      data: payload, // 直接传 JSON 对象，字段已统一为字符串
      success: (r) => {
        const status = r?.statusCode || 0;
        const body = r?.data || {};
        if (status < 200 || status >= 300) {
          const msg = (typeof body === 'string' ? body : body.message) || `HTTP ${status}`;
          wx.showModal({
            title: '登录接口错误',
            content: `状态码: ${status}
信息: ${msg}`,
            showCancel: false
          });
          return reject(new Error(`LOGIN_HTTP_ERROR_${status}`));
        }
        resolve(body);
      },
      fail: (e) => {
        // 若 wx.request 网络失败且 axios 可用，尝试 axios 兜底
        if (axios) {
          axios.post(url, payload, { headers, timeout: timeoutScaled })
            .then((r2) => {
              const status2 = r2?.status || 0;
              const body2 = r2?.data || {};
              if (status2 < 200 || status2 >= 300) {
                const msg2 = (typeof body2 === 'string' ? body2 : body2.message) || `HTTP ${status2}`;
                wx.showModal({
                  title: '登录接口错误',
                  content: `状态码: ${status2}
信息: ${msg2}`,
                  showCancel: false
                });
                reject(new Error(`LOGIN_HTTP_ERROR_${status2}`));
              } else {
                resolve(body2);
              }
            })
            .catch((err2) => {
              wx.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
              reject(err2 || new Error('LOGIN_NETWORK_ERROR'));
            });
        } else {
          wx.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
          reject(e || new Error('LOGIN_NETWORK_ERROR'));
        }
      }
    });
  });
}

function showAuthExplainModal() {
  return new Promise((resolve, reject) => {
    wx.showModal({
      title: '授权提示',
      content: '需要获取头像昵称用于完善资料与个性化服务，请点击“去授权”。',
      confirmText: '去授权',
      cancelText: '稍后',
      success: (res) => {
        if (res.confirm) resolve(true);
        else reject(new Error('USER_CANCEL_EXPLAIN'));
      },
      fail: () => reject(new Error('MODAL_FAIL'))
    });
  });
}

function getLoginCode(timeout = 5000) {
  return new Promise((resolve, reject) => {
    wx.login({
      timeout,
      success: (res) => res && res.code ? resolve(res.code) : reject(new Error('NO_LOGIN_CODE')),
      fail: () => reject(new Error('LOGIN_FAIL'))
    });
  });
}

// 重试获取登录 code（最多 retries 次）
async function getLoginCodeWithRetry(retries = 3, timeout = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      const code = await getLoginCode(timeout);
      if (code) return code;
    } catch (e) {
      // 第 i 次失败，继续重试
    }
  }
  return '';
}

function getUserInfoWithConfirm(desc = '用于完善个人资料') {
  return new Promise((resolve) => {
    if (!wx.getUserProfile) return resolve({ userInfo: undefined, supported: false });
    wx.getUserProfile({
      desc,
      success: (u) => resolve({ userInfo: (u && u.userInfo) || undefined, supported: true }),
      fail: () => resolve({ userInfo: undefined, supported: true })
    });
  });
}

const { saveAuth } = require('./storage');

function persistAndSync(dataUser, fallbackUser) {
  // 规范化取值，优先非空有效值，避免服务端空字符串覆盖本地选择的头像/昵称
  const pickNonEmpty = (...vals) => {
    for (const v of vals) {
      const s = typeof v === 'string' ? v.trim() : v;
      if (s !== undefined && s !== null && String(s) !== '') return String(s);
    }
    return '';
  };

  const nick = pickNonEmpty(
    dataUser && dataUser.nickName,
    fallbackUser && fallbackUser.nickName,
    '微信昵称'
  );
  const avatar = pickNonEmpty(
    dataUser && dataUser.avatarUrl,
    fallbackUser && fallbackUser.avatarUrl,
    ''
  );

  const mergedUser = { nickName: nick, avatarUrl: avatar };

  // 兼容旧键，同时写入统一的 authData
  const t = (dataUser && dataUser.token) || '';
  try {
    if (t) {
      wx.setStorageSync('auth_token', t);
      wx.setStorageSync('token', t);
    }
  } catch (e) {}

  // 持久化到 profile_basic，确保 hasAuth: true
  try {
    const profilePersist = { ...mergedUser, hasAuth: true };
    wx.setStorageSync('profile_basic', profilePersist);
    try { console.log('[auth] persist profile_basic', profilePersist); } catch (_) {}
  } catch (e) {}

  // 同步到全局（如存在）
  const app = getApp && getApp();
  if (app && app.globalData) app.globalData.userInfo = { ...mergedUser, hasAuth: true };

  // 尝试写入 userId（若后端返回）
  const uid = (dataUser && (dataUser.id || dataUser.userId)) || undefined;
  try { saveAuth({ token: t, userId: uid }); } catch (e) {}

  return mergedUser;
}

 // 统一入口：先弹说明，再授权并登录（支持外部传入 userInfo；否则回退 wx.getUserProfile）
async function authorizeLogin(externalUserInfo) {
  await showAuthExplainModal(); // 用户点击“去授权”才继续
  // 若页面已收集头像/昵称，则直接使用；否则调用 wx.getUserProfile
  let userInfo = undefined;
  if (externalUserInfo && (externalUserInfo.nickName || externalUserInfo.avatarUrl)) {
    userInfo = {
      nickName: String(externalUserInfo.nickName || '微信昵称'),
      avatarUrl: String(externalUserInfo.avatarUrl || '')
    };
  } else {
    const r = await getUserInfoWithConfirm('用于完善个人资料');
    userInfo = r.userInfo || undefined;
  }

  // 分别获取两次登录 code，分别用于登录及用户信息关联
  const loginCode = await getLoginCodeWithRetry(3, 5000);
  if (!loginCode) {
    wx.showToast({ title: '获取登录凭证失败，请稍后重试', icon: 'none' });
    throw new Error('NO_LOGIN_CODE_AFTER_RETRY');
  }
  const userInfoCode = await getLoginCodeWithRetry(3, 5000);
  if (!userInfoCode) {
    wx.showToast({ title: '获取用户信息凭证失败，请稍后重试', icon: 'none' });
    throw new Error('NO_USERINFO_CODE_AFTER_RETRY');
  }
  console.log('authorizeLogin got:', { loginCode, userInfoCode, hasUserInfo: !!userInfo });
  let resp;
  try {
    resp = await requestLogin({ loginCode, userInfoCode, userInfo });

    console.log(111111, resp)
  } catch (e) {
    // 403 时刷新 code 重试一次
    const msg = String((e && e.message) || e || '');
    if (msg.includes('LOGIN_HTTP_ERROR_403')) {
      const freshLoginCode = await getLoginCodeWithRetry(3, 5000);
      const freshUserInfoCode = await getLoginCodeWithRetry(3, 5000);
      if (freshLoginCode && freshUserInfoCode) {
        resp = await requestLogin({ loginCode: freshLoginCode, userInfoCode: freshUserInfoCode, userInfo });
      } else {
        throw e;
      }
    } else {
      throw e;
    }
  }
  const mergedUser = persistAndSync(resp.user, userInfo);
  // 统一抽取 token 与 userId 并保存
  try {
    const tokenFrom =
      (resp && resp.data && resp.data.token) ||
      (resp && resp.user && resp.user.token) ||
      resp.token || '';
    const userIdFrom =
      (resp && resp.user && (resp.user.id || resp.user.userId)) ||
      (resp && resp.data && resp.data.userId) ||
      resp.userId || undefined;
    if (tokenFrom) {
      wx.setStorageSync('auth_token', tokenFrom);
      wx.setStorageSync('token', tokenFrom);
    }
    if (tokenFrom || userIdFrom) {
      try { saveAuth({ token: tokenFrom, userId: userIdFrom }); } catch (e) {}
    }
  } catch (e) {}
  
  // 登录成功后同步用户数据
  try {
    const { syncAll } = require('./sync');
    syncAll().then(summary => {
      console.log('[auth] 登录后数据同步完成:', summary);
    }).catch(err => {
      console.warn('[auth] 登录后数据同步失败:', err);
    });
  } catch (e) {
    console.warn('[auth] 数据同步模块加载失败:', e);
  }
  
  return { mergedUser, token: (resp && (resp.token || (resp.data && resp.data.token))) || '' };
}

module.exports = { authorizeLogin };