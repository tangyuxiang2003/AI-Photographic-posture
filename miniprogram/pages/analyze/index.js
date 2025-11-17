const BASE_URL = 'http://62.234.12.214:8889'; // 开发环境：IP:端口；真机发布需换为 HTTPS 域名
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
    images: [], // string[]，保存后端 data[].imageUrl
    refinedPrompt: '',
    lastLocalPath: '',
    lastLocalPaths: [],
    lastUserId: undefined,
    lastDesc: '',
    refining: false,
    feedbackText: '',
    favMap: {},
    aiIdMap: {} // url -> aiImageId 映射
  },

  onLoad() {
    // 允许从上一页通过 eventChannel 传参并立即启动
    const channel = this.getOpenerEventChannel && this.getOpenerEventChannel();
    if (channel) {
      channel.on('startAnalyzePayload', ({ localPath, localPaths, desc, userId, token, textOnly } = {}) => {
        // 记录从首页携带的 token
        try { console.log('[analyze] eventChannel payload', { hasLocalPaths: Array.isArray(localPaths) && localPaths.length, hasLocalPath: !!localPath, userId, token, textOnly }); } catch (_) {}
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
        
        // 新增：处理纯文字描述模式
        if (textOnly && desc) {
          this.startAnalyzeTextOnly(desc, userId);
        } else if (Array.isArray(localPaths) && localPaths.length) {
          this.startAnalyzeMulti(localPaths, desc, userId);
        } else if (localPath) {
          this.startAnalyze(localPath, desc, userId);
        }
      });
    }
  },

  onShow() {
    // 同步本地收藏高亮
    try {
      const favs = wx.getStorageSync('favorites') || [];
      const map = {};
      (Array.isArray(favs) ? favs : []).forEach(u => { if (u) map[u] = true; });
      this.setData({ favMap: map });
    } catch(_) {}
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

  // 新增：纯文字描述生成姿势图片
  startAnalyzeTextOnly(desc, userId) {
    // CRITICAL: 禁止纯文字生成，必须上传图片
    wx.showToast({ 
      title: '请先上传背景照片或人景合照', 
      icon: 'none',
      duration: 2000
    });
    setTimeout(() => {
      wx.navigateBack();
    }, 2000);
    return;

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

    this.setData({ lastLocalPath: '', lastLocalPaths: [], lastUserId: uid, lastDesc: desc || '' });
    
    const { post } = require('../../utils/request');
    const body = { content: desc || '' };
    if (uid !== undefined) body.userId = uid;
    
    try { console.log('[analyze] text-only generation', { userId: uid, content: desc }); } catch (_) {}
    
    post('/api/image/generate-text', body)
      .then((res) => {
        try {
          if (res.statusCode === 401 || res.statusCode === 403) throw new Error('未授权或登录过期');
          try { console.log('[analyze] text-only resp', res.statusCode, res.data); } catch (e2) {}
          
          // 解析响应数据
          let responseData = res.data;
          if (typeof responseData === 'string') {
            try { responseData = JSON.parse(responseData); } catch(_) {}
          }
          
          const ok = !!responseData && (responseData.code === 0 || responseData.code === 200 || responseData.success === true || responseData.msg === '成功');
          if (!ok) throw new Error(responseData.msg || '服务错误');
          
          const items = Array.isArray(responseData.data) ? responseData.data : [];
          const images = items.map(i => i.aiImageUrl || i.imageUrl).filter(Boolean);
          const aiIdMap = {};
          items.forEach(i => {
            const url = i.aiImageUrl || i.imageUrl;
            const id = i.id || i.aiImageId;
            if (url && (id != null)) aiIdMap[url] = String(id);
          });
          try { console.log('[analyze] text-only images', images, aiIdMap); } catch (e3) {}
          this.setData({ images, aiIdMap, done: true, progress: 100, feedbackText: this._genFeedback(false) });
          // 保存生成的图片到本地存储供相机页面使用
          try { wx.setStorageSync('generated_images', images); } catch(_) {}
          // 保存aiIdMap到本地存储供preview页面使用
          try { wx.setStorageSync('aiIdMap', aiIdMap); } catch(_) {}
        } catch (e) {
          try { console.error('[analyze] text-only fail', e); } catch (e4) {}
          this._failout(e && e.message);
        }
      })
      .catch((err) => {
        try { console.error('[analyze] text-only request error', err); } catch (_) {}
        this._failout(err && err.message || '生成失败');
      })
      .finally(() => this._stopFakeProgress());
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

    this.setData({ lastLocalPath: localFilePath, lastLocalPaths: [], lastUserId: uid, lastDesc: desc || '' });
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
      formData: form,
      header: getAuthHeader()
    }).then((res) => {
      try {
        if (res.statusCode === 401 || res.statusCode === 403) throw new Error('未授权或登录过期');
        try { console.log('[analyze] upload resp(single)', res.statusCode, res.data); } catch (e2) {}
        const body = JSON.parse(res.data || '{}');
        const ok = !!body && (body.code === 0 || body.code === 200 || body.success === true || body.msg === '成功');
        if (!ok) throw new Error(body.msg || '服务错误');
        const items = Array.isArray(body.data) ? body.data : [];
        const images = items.map(i => i.aiImageUrl || i.imageUrl).filter(Boolean);
        const aiIdMap = {};
        items.forEach(i => {
          const url = i.aiImageUrl || i.imageUrl;
          const id = i.id || i.aiImageId;
          if (url && (id != null)) aiIdMap[url] = String(id);
        });
        try { console.log('[analyze] images(single)', images, aiIdMap); } catch (e3) {}
        this.setData({ images, aiIdMap, done: true, progress: 100, feedbackText: this._genFeedback(false) });
        // 保存生成的图片到本地存储供相机页面使用
        try { wx.setStorageSync('generated_images', images); } catch(_) {}
        // 保存aiIdMap到本地存储供preview页面使用
        try { wx.setStorageSync('aiIdMap', aiIdMap); } catch(_) {}
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
          formData: form,
          header: getAuthHeader()
        }).then((res) => {
          try {
            if (res.statusCode === 401 || res.statusCode === 403) return reject(new Error('未授权或登录过期'));
            try { console.log('[analyze] upload resp(multi item)', res.statusCode, res.data); } catch (e2) {}
            const body = JSON.parse(res.data || '{}');
            const ok = !!body && (body.code === 0 || body.code === 200 || body.success === true || body.msg === '成功');
            if (!ok) return reject(new Error(body.msg || '服务错误'));
            const items = Array.isArray(body.data) ? body.data : [];
            const arr = items.map(i => i.aiImageUrl || i.imageUrl).filter(Boolean);
            // 同步写入每项的 aiImageId 映射
            const map = Object.assign({}, this.data.aiIdMap || {});
            items.forEach(i => {
              const url = i.aiImageUrl || i.imageUrl;
              const id = i.id || i.aiImageId;
              if (url && (id != null)) map[url] = String(id);
            });
            this.setData({ aiIdMap: map });
            try { console.log('[analyze] images(multi item)', arr, map); } catch (e3) {}
            resolve(arr);
          } catch (e) { try { console.error('[analyze] fail(multi item)', e); } catch (e4) {} reject(e); }
        }).catch(reject);
      }));

      // 记录本次批量任务的上下文（保留以便后续"优化描述"复用）
      this.setData({ lastLocalPaths: Array.isArray(localPaths) ? localPaths : [], lastLocalPath: '', lastDesc: desc || '' });
      const results = await Promise.all(tasks);
      // results 是各项返回的 url 数组，但无法拿到 id；这里并行任务里已在每项中解析 body，
      // 因此改为在上面的单项解析时返回 {urls, map} 更复杂。为保持最小改动，我们在这里仅合并 url，
      // 并依赖单项解析处的日志无法带出 id。若后端需要批量 id，请后续在多传时返回 id。
      const images = Array.from(new Set(results.flat()));
      const aiIdMap = Object.assign({}, this.data.aiIdMap || {});
      // 如果后端在多文件返回中也包含 id，需要在每个 then 中构造 {arr, map}，此处合并 map。
      try { console.log('[analyze] images(multi merged)', images, aiIdMap); } catch (e6) {}
      this.setData({ images, aiIdMap, done: true, progress: 100, feedbackText: this._genFeedback(false) });
      // 保存生成的图片到本地存储供相机页面使用
      try { wx.setStorageSync('generated_images', images); } catch(_) {}
      // 保存aiIdMap到本地存储供preview页面使用
      try { wx.setStorageSync('aiIdMap', aiIdMap); } catch(_) {}
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

  // 切换收藏（后端接口 + 本地缓存；发送 userId 与 aiImageId）
  async onToggleFavorite(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;

    const aiImageId = this.data.aiIdMap && this.data.aiIdMap[url];
    if (!aiImageId) {
      wx.showToast({ title: '缺少图片ID，无法收藏', icon: 'none' });
      return;
    }

    // 取 userId
    let userId;
    try {
      const { getAuth } = require('../../utils/storage');
      const auth = (getAuth && getAuth()) || {};
      const n = Number(auth.userId);
      userId = Number.isFinite(n) ? String(Math.trunc(n)) : undefined;
    } catch(_) {}

    // 乐观更新本地状态
    const favMap = Object.assign({}, this.data.favMap || {});
    const willFav = !favMap[url];
    if (willFav) favMap[url] = true; else delete favMap[url];

    // 同步本地简单列表与收藏页对象列表（id 用 aiImageId，cover 用 url）
    const list = Object.keys(favMap);
    try { wx.setStorageSync('favorites', list); } catch(_) {}
    
    // 读取现有收藏数据，保留原有的标签
    const existingFavorites = wx.getStorageSync('app_favorites') || [];
    const existingMap = {};
    existingFavorites.forEach(item => {
      if (item && item.cover) {
        existingMap[item.cover] = item;
      }
    });
    
    const objList = list.map(u => {
      // 如果已存在该收藏，保留其标签和其他信息
      const existing = existingMap[u];
      return {
        id: this.data.aiIdMap[u], 
        title: existing?.title || 'AI生成图', 
        cover: u, 
        tags: existing?.tags || [],  // 保留原有标签
        type: existing?.type || 'AI',
        collectTime: existing?.collectTime || new Date().toISOString()
      };
    });
    try { wx.setStorageSync('app_favorites', objList); } catch(_) {}
    this.setData({ favMap });
    // 记录用户已进行过收藏行为，供收藏页判定"老用户"恢复历史
    try { if (list.length > 0) wx.setStorageSync('has_favorited_before', true); } catch(_) {}
    wx.showToast({ title: willFav ? '已收藏' : '已取消', icon: 'none', duration: 800 });

    // 调用后端接口
    try {
      const { post } = require('../../utils/request');
      if (willFav) {
        // 使用 addByAiImageId 接口，只需要传递 aiImageId
        // userId 会由 request.js 自动注入到请求体中
        await post('/api/collection/addByAiImageId', { 
          aiImageId: aiImageId
        });
      } else {
        await post('/api/collection/remove', { userId, aiImageId });
      }
    } catch (err) {
      // 回滚
      const rollback = Object.assign({}, this.data.favMap || {});
      if (willFav) { delete rollback[url]; } else { rollback[url] = true; }
      const rollList = Object.keys(rollback);
      try { wx.setStorageSync('favorites', rollList); } catch(_) {}
      
      // 回滚时也要保留原有标签
      const existingFavs = wx.getStorageSync('app_favorites') || [];
      const existingDataMap = {};
      existingFavs.forEach(item => {
        if (item && item.cover) {
          existingDataMap[item.cover] = item;
        }
      });
      
      const rollObj = rollList.map(u => {
        const existing = existingDataMap[u];
        return {
          id: this.data.aiIdMap[u], 
          title: existing?.title || 'AI生成图', 
          cover: u, 
          tags: existing?.tags || [],  // 保留原有标签
          type: existing?.type || 'AI',
          collectTime: existing?.collectTime || new Date().toISOString()
        };
      });
      try { wx.setStorageSync('app_favorites', rollObj); } catch(_) {}
      this.setData({ favMap: rollback });
      wx.showToast({ title: '操作失败，请稍后重试', icon: 'none' });
    }
  },

  // —— 继续优化 —— //
  onRefinedPromptInput(e) {
    this.setData({ refinedPrompt: (e.detail && e.detail.value) || '' });
  },
  async onGenerateWithRefinedPrompt() {
    if (!this.data.done || this.data.refining) {
      wx.showToast({ title: '当前仍在生成中，请稍后', icon: 'none' });
      return;
    }
    const prompt = (this.data.refinedPrompt || '').trim();
    if (!prompt) {
      wx.showToast({ title: '请输入优化描述', icon: 'none' });
      return;
    }
    const { hasToken, getAuth } = require('../../utils/storage');
    if (!hasToken()) {
      wx.showToast({ title: '请先登录获取Token', icon: 'none' });
      return;
    }

    const header = getAuthHeader();
    const auth = (getAuth && getAuth()) || {};
    const uidStore = normalizeUserId(auth.userId);
    const uid = uidStore !== undefined ? uidStore : normalizeUserId(this.data.lastUserId);

    const formBase = { content: prompt };
    if (uid !== undefined) formBase.userId = uid;

    const { upload, post } = require('../../utils/request');
    const lastPaths = Array.isArray(this.data.lastLocalPaths) ? this.data.lastLocalPaths : [];
    const lastPath = this.data.lastLocalPath;

    wx.showLoading({ title: '重新生成中...', mask: true });
    this.setData({ refining: true });
    try {
      let newImages = [];
      if (lastPaths.length > 0) {
        // 批量复用
        const tasks = lastPaths.map(fp =>
          upload({ url: '/api/image/upload', filePath: fp, name: 'file', formData: formBase, header: getAuthHeader() })
            .then((res) => {
              if (res.statusCode === 401 || res.statusCode === 403) throw new Error('未授权或登录过期');
              const body = JSON.parse(res.data || '{}');
              const ok = !!body && (body.code === 0 || body.code === 200 || body.success === true || body.msg === '成功');
              if (!ok) throw new Error(body.msg || '服务错误');
              const items = Array.isArray(body.data) ? body.data : [];
              const arr = items.map(i => i.aiImageUrl || i.imageUrl).filter(Boolean);
              // 为优化生成的图片同步写入 aiIdMap
              const map = Object.assign({}, this.data.aiIdMap || {});
              items.forEach(i => {
                const url = i.aiImageUrl || i.imageUrl;
                const id = i.id || i.aiImageId;
                if (url && (id != null)) map[url] = String(id);
              });
              this.setData({ aiIdMap: map });
              return arr;
            })
        );
        const results = await Promise.all(tasks);
        newImages = Array.from(new Set(results.flat()));
      } else if (lastPath) {
        // 单张复用
        const res = await upload({ url: '/api/image/upload', filePath: lastPath, name: 'file', formData: formBase, header: getAuthHeader() });
        if (res.statusCode === 401 || res.statusCode === 403) throw new Error('未授权或登录过期');
        let body = res.data;
        if (typeof body === 'string') { try { body = JSON.parse(body); } catch(_) {} }
        const ok = !!body && (body.code === 0 || body.code === 200 || body.success === true || body.msg === '成功');
        if (!ok) throw new Error(body.msg || '服务错误');
        const items = Array.isArray(body.data) ? body.data : [];
        newImages = items.map(i => i.aiImageUrl || i.imageUrl).filter(Boolean);
        const map = Object.assign({}, this.data.aiIdMap || {});
        items.forEach(i => {
          const url = i.aiImageUrl || i.imageUrl;
          const id = i.id || i.aiImageId;
          if (url && (id != null)) map[url] = String(id);
        });
        this.setData({ aiIdMap: map });
      } else {
        // 纯文字优化：调用纯文字生成接口
        const res = await post('/api/image/generate-text', formBase);
        if (res.statusCode === 401 || res.statusCode === 403) throw new Error('未授权或登录过期');
        
        let responseData = res.data;
        if (typeof responseData === 'string') {
          try { responseData = JSON.parse(responseData); } catch(_) {}
        }
        
        const ok = !!responseData && (responseData.code === 0 || responseData.code === 200 || responseData.success === true || responseData.msg === '成功');
        if (!ok) throw new Error(responseData.msg || '服务错误');
        
        const items = Array.isArray(responseData.data) ? responseData.data : [];
        newImages = items.map(i => i.aiImageUrl || i.imageUrl).filter(Boolean);
        const map = Object.assign({}, this.data.aiIdMap || {});
        items.forEach(i => {
          const url = i.aiImageUrl || i.imageUrl;
          const id = i.id || i.aiImageId;
          if (url && (id != null)) map[url] = String(id);
        });
        this.setData({ aiIdMap: map });
      }

      // 追加而非覆盖，保留原图
      const merged = Array.from(new Set([...(this.data.images || []), ...newImages]));
      const finalAiIdMap = this.data.aiIdMap || {};
      this.setData({
        images: merged,
        aiIdMap: finalAiIdMap,
        done: true,
        refinedPrompt: '',
        feedbackText: this._genFeedback(true)
      });
      // 保存生成的图片到本地存储供相机页面使用
      try { wx.setStorageSync('generated_images', merged); } catch(_) {}
      // 保存aiIdMap到本地存储供preview页面使用
      try { wx.setStorageSync('aiIdMap', finalAiIdMap); } catch(_) {}
      wx.showToast({ title: '已生成新图片', icon: 'success' });
    } catch (e) {
      try { console.error('[analyze] refine regenerate error', e); } catch(_) {}
      wx.showToast({ title: (e && e.message) || '重新生成失败', icon: 'none' });
    } finally {
      this.setData({ refining: false });
      wx.hideLoading();
    }
  },

  // 原生相机拍摄并开始分析
  onStartCamera() {
    const { hasToken } = require('../../utils/storage');
    if (!hasToken()) {
      wx.showToast({ title: '请先登录获取Token', icon: 'none' });
      return;
    }
    const desc = (this.data.refinedPrompt || '').trim();
    wx.navigateTo({
      url: '/pages/camera/index',
      events: {
        photoTaken: ({ tempFilePath }) => {
          if (tempFilePath) this.startAnalyze(tempFilePath, desc, undefined);
        }
      }
    });
  },

  _genFeedback(isRefine) {
    const listBase = [
      '太棒了！你的灵感很有感觉～',
      '风格拿捏住了，继续微调会更赞。',
      '这组很有氛围感，值得收藏！',
      '小提示：试着补充光线/色调/情绪词，效果会更稳定。'
    ];
    const listRefine = [
      '升级完成！新灵感已融入这组图。',
      '越调越好看，继续探索你的专属风格吧～',
      '这次优化很明显，试试再加一个色彩关键词？'
    ];
    const pool = isRefine ? listRefine.concat(listBase) : listBase;
    return pool[Math.floor(Math.random() * pool.length)];
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