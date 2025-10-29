// 统一认证存储工具：将 token 和 userId 放在同一处：authData
// 结构：{ token: string, userId: string }

function saveAuth({ token, userId }) {
  try {
    const existing = wx.getStorageSync('authData') || {};
    const next = {
      token: typeof token === 'string' && token ? token : existing.token,
      userId: userId != null && String(userId) !== '' ? String(userId) : existing.userId,
    };
    wx.setStorageSync('authData', next);
    // 向后兼容旧键，避免老代码读取失败
    if (next.token) {
      wx.setStorageSync('token', next.token);
      wx.setStorageSync('auth_token', next.token);
    }
    return next;
  } catch (e) {
    return null;
  }
}

function getAuth() {
  try {
    const data = wx.getStorageSync('authData');
    if (data && typeof data === 'object') return data;
  } catch (e) {}
  // 兼容旧存储，自动回填到新结构
  try {
    const t = wx.getStorageSync('auth_token') || wx.getStorageSync('token') || '';
    const u = wx.getStorageSync('userId') || '';
    if (t || u) {
      const merged = { token: t || '', userId: u ? String(u) : undefined };
      wx.setStorageSync('authData', merged);
      return merged;
    }
  } catch (e) {}
  return null;
}

function hasToken() {
  const a = getAuth();
  return !!(a && a.token);
}

module.exports = { saveAuth, getAuth, hasToken };