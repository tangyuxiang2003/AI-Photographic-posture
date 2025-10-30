
const BASE_URL = 'http://172.20.10.2:8080'; // 开发环境：IP:端口；真机发布需换为 HTTPS 域名
// 统一读取两个可能的存储键：'auth_token' 与 'token'

function getAuthHeader() {
  let t1 = '', t2 = '', token = '';
  try { t1 = wx.getStorageSync('auth_token') || ''; } catch (e) {}
  try { t2 = wx.getStorageSync('token') || ''; } catch (e) {}
  token = t1 || t2;
  const header = token ? { Authorization: `Bearer ${token}` } : {};
  try { console.log('[analyze] getAuthHeader', { auth_token: t1, token: t2, using: token, header }); } catch (e) {}
  return header;
}

function normalizeUserId(userId) {
  if (userId === null || userId === undefined) return undefined;
  const n = Number(userId);
  if (Number.isFinite(n)) return String(Math.trunc(n));
  return undefined;
}

Page({
  data: {
    progress: 0,
    done: false,
    failed: false,
    images: [] // string[]，保存后端 data[].imageUrl
  },

  onLoad() {
    // 允许从上一页通过 eventChannel 传参并立即启动
    const channel = this.getOpenerEventChannel && this.getOpenerEventChannel();
    if (channel) {
      channel.on('startAnalyzePayload', ({ localPath, localPaths, desc, userId, token } = {}) => {
        // 记录从首页携带的 token
        try { console.log('[analyze] eventChannel payload', { hasLocalPaths: Array.isArray(localPaths) && localPaths.length, hasLocalPath: !!localPath, userId, token }); } catch (_) {}
        // 若上页携带了 token，则兜底写入两个 key，避免时序导致本地为空
        try {
          if (typeof token === 'string' && token) {
            wx.setStorageSync('auth_token', token);
            wx.setStorageSync('token', token);
            try { console.log('[analyze] wrote token from channel'); } catch (_) {}
            // 写入后立刻验证
            const headerNow = getAuthHeader();
            try { console.log('[analyze] header after channel write', headerNow); } catch (_) {}
          }
        } catch (e) { try { console.error('[analyze] write token error', e); } catch(_) {} }
        if (Array.isArray(localPaths) && localPaths.length) {
          this.startAnalyzeMulti(localPaths, desc, userId);
        } else if (localPath) {
          this.startAnalyze(localPath, desc, userId);
        }
      });
    }
  },

  onShow() {
    // 实时校验 token，避免因跳转过快或缓存导致误判；并加入延迟重试读取
    const header = getAuthHeader();
    const hasAuth = !!header.Authorization;
    try { console.log('[analyze] onShow header', header); } catch (e) {}
    if (!hasAuth) {
      wx.showToast({ title: '请先登录获取Token', icon: 'none' });
      // 兜底：延迟 300ms 后重读
      setTimeout(() => {
        const h2 = getAuthHeader();
        try { console.log('[analyze] delayed header 300ms', h2); } catch (_) {}
        if (!h2.Authorization) {
          // 再次兜底：延迟 1000ms 后重读
          setTimeout(() => {
            const h3 = getAuthHeader();
            try { console.log('[analyze] delayed header 1000ms', h3); } catch (_) {}
            if (!h3.Authorization) {
              try { console.warn('[analyze] still no token after retries'); } catch(_) {}
            }
          }, 1000);
        }
      }, 300);
    }
  },

  // 单文件上传分析
  startAnalyze(localFilePath, desc, userId) {
    const { hasToken } = require('../../utils/storage');
    if (!hasToken()) {
      wx.showToast({ title: '请先登录获取Token', icon: 'none' });
      return;
    }

    this._resetStatus();
    this._startFakeProgress();

    // 统一从 storage 获取 userId，若函数参数传入则作为兜底
    const { getAuth } = require('../../utils/storage');
    const auth = (getAuth && getAuth()) || {};
    const uidStore = normalizeUserId(auth.userId);
    const uidParam = normalizeUserId(userId);
    const uid = uidStore !== undefined ? uidStore : uidParam;

    const hdr1 = getAuthHeader();
    const form = { content: desc || '' };
    if (uid !== undefined) form.userId = uid;
    try { console.log('[analyze] sending userId(single)', uid, 'form.userId=', form.userId); } catch (_) {}
    try { console.log('[analyze] startAnalyze headers', hdr1, { userId: uid, content: desc || '' }); } catch (e) {}
    const { upload } = require('../../utils/request');
    upload({
      url: '/api/image/upload',
      filePath: localFilePath,
      name: 'file',
      formData: form
    }).then((res) => {
      try {
        if (res.statusCode === 401 || res.statusCode === 403) throw new Error('未授权或登录过期');
        try { console.log('[analyze] upload resp(single)', res.statusCode, res.data); } catch (e2) {}
        const body = JSON.parse(res.data || '{}');
        const ok = !!body && (body.code === 0 || body.code === 200 || body.success === true || body.msg === '成功');
        if (!ok) throw new Error(body.msg || '服务错误');
        const images = (Array.isArray(body.data) ? body.data : []).map(i => i.aiImageUrl || i.imageUrl).filter(Boolean);
        try { console.log('[analyze] images(single)', images); } catch (e3) {}
        this.setData({ images, done: true, progress: 100 });
      } catch (e) {
        try { console.error('[analyze] fail(single)', e); } catch (e4) {}
        this._failout(e && e.message);
      }
    }).catch(() => this._failout())
      .finally(() => this._stopFakeProgress());
  },

  // 多文件：全部上传完后一次性合并展示
  async startAnalyzeMulti(localPaths = [], desc, userId) {
    const { hasToken } = require('../../utils/storage');
    if (!hasToken()) {
      wx.showToast({ title: '请先登录获取Token', icon: 'none' });
      return;
    }

    this._resetStatus();
    this._startFakeProgress();

    try {
      const tasks = localPaths.map(fp => new Promise((resolve, reject) => {
        const hdr2 = getAuthHeader();

        // 统一从 storage 获取 userId，若函数参数传入则作为兜底
        const { getAuth } = require('../../utils/storage');
        const auth = (getAuth && getAuth()) || {};
        const uidStore = normalizeUserId(auth.userId);
        const uidParam = normalizeUserId(userId);
        const uid = uidStore !== undefined ? uidStore : uidParam;

        const form = { content: desc || '' };
        if (uid !== undefined) form.userId = uid;
        try { console.log('[analyze] sending userId(multi)', uid, 'form.userId=', form.userId); } catch (_) {}
        try { console.log('[analyze] startAnalyzeMulti headers', hdr2, { userId: uid, content: desc || '' }); } catch (e0) {}
        const { upload } = require('../../utils/request');
        upload({
          url: '/api/image/upload',
          filePath: fp,
          name: 'file',
          formData: form
        }).then((res) => {
          try {
            if (res.statusCode === 401 || res.statusCode === 403) return reject(new Error('未授权或登录过期'));
            try { console.log('[analyze] upload resp(multi item)', res.statusCode, res.data); } catch (e2) {}
            const body = JSON.parse(res.data || '{}');
            const ok = !!body && (body.code === 0 || body.code === 200 || body.success === true || body.msg === '成功');
            if (!ok) return reject(new Error(body.msg || '服务错误'));
            const arr = (Array.isArray(body.data) ? body.data : []).map(i => i.aiImageUrl || i.imageUrl).filter(Boolean);
            try { console.log('[analyze] images(multi item)', arr); } catch (e3) {}
            resolve(arr);
          } catch (e) { try { console.error('[analyze] fail(multi item)', e); } catch (e4) {} reject(e); }
        }).catch(reject);
      }));

      const results = await Promise.all(tasks);
      const images = Array.from(new Set(results.flat()));
      try { console.log('[analyze] images(multi merged)', images); } catch (e6) {}
      this.setData({ images, done: true, progress: 100 });
    } catch (e) {
      console.error(e);
      this._failout(e && e.message);
    } finally {
      this._stopFakeProgress();
    }
  },

  onPreview(e) {
    const current = e.currentTarget.dataset.url;
    wx.previewImage({ current, urls: this.data.images });
  },

  /* 内部：状态与伪进度 */
  _resetStatus() {
    this.setData({ progress: 0, done: false, failed: false, images: [] });
  },

  _startFakeProgress() {
    this._stopFakeProgress();
    this._timer = setInterval(() => {
      const p = this.data.progress;
      if (!this.data.done && p < 90) this.setData({ progress: Math.min(90, p + Math.random() * 8) });
    }, 400);
  },

  _stopFakeProgress() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  },

  _failout(msg) {
    this.setData({ failed: true });
    wx.showToast({ title: msg || '生成失败', icon: 'none' });
  }
});