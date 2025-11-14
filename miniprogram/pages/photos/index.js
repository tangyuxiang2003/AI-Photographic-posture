Page({
  data: {
    // 全局主题背景色
    themeBg: '#FFF7FA',
    query: '',
    favorites: [],
    filtered: [],
    // 标签编辑
    showTagEditor: false,
    editingId: null,
    editingTags: ''
  },

  // 预处理：为每条收藏预计算 searchText，减少筛选时字符串拼接与大小写转换
  normalizeFavorites(arr = []){
    return (arr || []).map(it => ({
      ...it,
      searchText: ((it.title ? it.title : '') + ' ' + (Array.isArray(it.tags) ? it.tags.join(' ') : '')).toLowerCase()
    }))
  },

  onLoad(){
    // 同步主题背景
    try {
      const bg = wx.getStorageSync('theme_bg') || '#FFF7FA';
      if (bg !== this.data.themeBg) this.setData({ themeBg: bg });
    } catch (e) {}

    // 显示加载提示
    wx.showLoading({ title: '加载中...', mask: true });
    
    // 加载收藏列表（本地+服务器）
    this.loadAllFavorites().finally(() => {
      wx.hideLoading();
      wx.showShareMenu({ withShareTicket: true });
    });
  },

  onShow(){
    // 同步主题背景
    try {
      const bg = wx.getStorageSync('theme_bg') || '#FFF7FA';
      if (bg !== this.data.themeBg) this.setData({ themeBg: bg });
    } catch (e) {}

    // 每次显示页面时刷新收藏列表（本地+服务器）
    this.loadAllFavorites();
  },

  // 应用主题背景到导航栏、页面与底部tabBar
  applyThemeColor(backgroundColor) {
    const frontColor = this.getContrastingText(backgroundColor);
    try {
      wx.setNavigationBarColor({
        frontColor,
        backgroundColor,
        animation: { duration: 200, timingFunc: 'easeIn' }
      });
    } catch (e) {}
    // 同步 tabBar 背景
    try {
      wx.setTabBarStyle({
        backgroundColor,
        borderStyle: frontColor === '#ffffff' ? 'white' : 'black',
        color: frontColor === '#ffffff' ? '#e6e6e6' : '#666666',
        selectedColor: '#07C160'
      });
    } catch (e) {}
    try {
      wx.setBackgroundColor({
        backgroundColor,
        backgroundColorTop: backgroundColor,
        backgroundColorBottom: backgroundColor
      });
    } catch (e) {}
  },

  // 根据背景色自动选择黑/白前景色
  getContrastingText(hex) {
    const norm = (h) => {
      if (!h) return '#000000';
      let s = h.toString().trim();
      if (s[0] !== '#') s = '#' + s;
      if (s.length === 4) {
        const r = s[1], g = s[2], b = s[3];
        s = '#' + r + r + g + g + b + b;
      }
      return s.slice(0, 7);
    };
    const c = norm(hex);
    const r = parseInt(c.substr(1, 2), 16);
    const g = parseInt(c.substr(3, 2), 16);
    const b = parseInt(c.substr(5, 2), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 160 ? '#000000' : '#ffffff';
  },

  onPreviewImage(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    
    // 获取所有收藏图片的 URL 列表
    const urls = this.data.filtered.map(item => item.cover).filter(Boolean);
    
    wx.previewImage({
      current: url,
      urls: urls
    });
  },

  onSearchInput(e){
    const val = e.detail.value
    this.setData({ query: val })
    if (this._debTimer) clearTimeout(this._debTimer)
    this._debTimer = setTimeout(() => {
      this.computeFiltered()
    }, 250)
  },

  onClearSearch(){
    this.setData({ query: '' }, this.computeFiltered)
  },

  // 打开标签编辑面板
  onOpenTagEditor(e){
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const item = (this.data.favorites || []).find(x => x.id === id);
    const preset = (item && Array.isArray(item.tags) ? item.tags : []).join(', ');
    this.setData({
      showTagEditor: true,
      editingId: id,
      editingTags: preset
    });
  },

  onEditTagsInput(e){
    this.setData({ editingTags: e.detail.value || '' });
  },

  // 保存标签（调用后端接口）
  async onSaveTags(){
    const id = this.data.editingId;
    if (!id) return this.onCloseTagEditor();

    const raw = (this.data.editingTags || '');
    const tag = raw.trim();

    if (!tag) {
      wx.showToast({ title: '请输入标签内容', icon: 'none' });
      return;
    }

    // 检查登录状态
    try {
      const { hasToken } = require('../../utils/storage');
      if (!hasToken || !hasToken()) {
        wx.showToast({ title: '请先登录', icon: 'none' });
        return;
      }
    } catch (e) {
      console.error('检查登录状态失败', e);
    }

    try {
      wx.showLoading({ title: '保存中...', mask: true });
      
      const { post } = require('../../utils/request');
      // 调用后端接口更新标签（request.js 会自动携带 token 和 userId）
      const response = await post('/api/collection/updateTag', { 
        id: String(id), 
        tag: tag 
      });

      console.log('[photos] 更新标签响应:', response);

      // 更新成功后，更新本地数据
      const tags = tag
        .split(/[,，\s]+/)
        .map(s => s.trim())
        .filter(Boolean);

      const prev = this.data.favorites.slice();
      const next = prev.map(it => it.id === id ? { ...it, tags } : it);
      const normalized = this.normalizeFavorites(next);
      this.setData({ favorites: normalized }, this.computeFiltered);

      this.onCloseTagEditor();
      wx.showToast({ title: '标签保存成功', icon: 'success' });
    } catch (err) {
      console.error('保存标签失败', err);
      
      // 处理 401/403 错误
      if (err.statusCode === 401 || err.statusCode === 403) {
        wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
      } else {
        wx.showToast({ title: '保存失败，请稍后重试', icon: 'none' });
      }
    } finally {
      wx.hideLoading();
    }
  },

  onCloseTagEditor(){
    this.setData({ showTagEditor: false, editingId: null, editingTags: '' });
  },

  computeFiltered(){
    const { favorites, query } = this.data
    const q = (query || '').trim().toLowerCase()
    const list = (favorites || []).filter(it => {
      if (!q) return true;
      const text = it?.searchText || (((it?.title || '') + ' ' + (Array.isArray(it?.tags) ? it.tags.join(' ') : '')).toLowerCase())
      return text.includes(q)
    })
    this.setData({ filtered: list })
  },

  // 取消收藏（调用后端接口）
  async onToggleFavorite(e){
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    // 判断是否需要调用后端
    let userId;
    let canCallServer = false;
    try {
      const { hasToken, getAuth } = require('../../utils/storage');
      canCallServer = !!(hasToken && hasToken());
      if (canCallServer) {
        const auth = (getAuth && getAuth()) || {};
        const n = Number(auth.userId);
        userId = Number.isFinite(n) ? String(Math.trunc(n)) : undefined;
      }
    } catch(_) {}

    if (!canCallServer) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    // 调用后端删除收藏
    try {
      wx.showLoading({ title: '删除中...', mask: true });
      const { post } = require('../../utils/request');
      
      // 获取当前收藏项的 aiImageId
      const item = this.data.favorites.find(x => x.id === id);
      const aiImageId = item?.aiImageId;
      
      if (!aiImageId) {
        wx.showToast({ title: '数据异常，请刷新后重试', icon: 'none' });
        return;
      }
      
      // 使用 aiImageId 调用删除接口
      await post('/api/collection/remove', { aiImageId, userId });
      
      // 删除成功后重新加载列表
      await this.loadAllFavorites();
      wx.showToast({ title: '已取消收藏', icon: 'none' });
    } catch (err) {
      console.error('取消收藏失败', err);
      wx.showToast({ title: '取消失败，请稍后重试', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onShare(e){
    const id = e.currentTarget.dataset.id
    const item = this.data.favorites.find(x => x.id === id)
    wx.showToast({ title: '已分享：' + (item?.title || ''), icon: 'none' })
    // 可在此接入转发/生成海报等
  },

  onShuffle(){
    const arr = [...this.data.favorites]
    arr.sort(() => 0.5 - Math.random())
    this.setData({ favorites: arr }, this.computeFiltered)
    wx.showToast({ title: '已为你推荐新顺序', icon: 'none' })
  },

  // 加载所有收藏（本地+服务器）
  async loadAllFavorites() {
    try {
      // 1. 加载本地收藏
      const localFavorites = wx.getStorageSync('local_favorites') || []
      
      // 2. 如果已登录，加载服务器收藏
      let serverFavorites = []
      const { hasToken } = require('../../utils/storage')
      if (hasToken && hasToken()) {
        serverFavorites = await this.fetchServerFavorites()
      }
      
      // 3. 合并本地和服务器收藏（去重）
      const allFavorites = [...localFavorites]
      const localUrls = new Set(localFavorites.map(item => item.cover))
      
      serverFavorites.forEach(item => {
        if (!localUrls.has(item.cover)) {
          allFavorites.push(item)
        }
      })
      
      // 4. 规范化并按时间排序
      const normalized = this.normalizeFavorites(allFavorites)
      normalized.sort((a, b) => {
        const timeA = new Date(a.collectTime).getTime()
        const timeB = new Date(b.collectTime).getTime()
        return timeB - timeA // 倒序
      })
      
      this.setData({ favorites: normalized }, this.computeFiltered)
    } catch (e) {
      console.error('[photos] loadAllFavorites failed', e)
      wx.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
      this.setData({ favorites: [], filtered: [] })
    }
  },

  // 从服务器拉取收藏列表
  async fetchServerFavorites() {
    try {
      const { hasToken, getAuth } = require('../../utils/storage');
      if (!hasToken()) {
        console.log('[photos] 未登录，无法加载收藏列表');
        this.setData({ favorites: [], filtered: [] });
        return;
      }
      
      const auth = (getAuth && getAuth()) || {};
      const uidNum = Number(auth.userId);
      const userId = Number.isFinite(uidNum) ? String(Math.trunc(uidNum)) : undefined;

      if (!userId) {
        console.warn('[photos] userId 无效');
        this.setData({ favorites: [], filtered: [] });
        return;
      }

      const { get } = require('../../utils/request');
      // 后端为 GET /api/collection/list，通过 query 传参
      const resp = await get('/api/collection/list', { userId });
      
      // 解析后端响应格式
      let responseData = resp?.data;
      if (typeof responseData === 'string') {
        try { responseData = JSON.parse(responseData); } catch(e) {
          console.error('[photos] 解析响应失败:', e);
          responseData = {};
        }
      }
      
      console.log('[photos] 后端响应:', responseData);
      
      // 提取数据数组
      const items = responseData?.data || [];
      const base = Array.isArray(items) ? items : [];
      
      console.log('[photos] 从后端加载收藏列表，数量:', base.length);
      if (base.length > 0) {
        console.log('[photos] 第一条数据示例:', base[0]);
      }
      
      // 规范化字段：保留收藏记录的 id（collection 表主键）和 aiImageId
      const normalized = this.normalizeFavorites(base.map(x => {
        // 处理标签：后端可能返回字符串或数组
        let tags = [];
        if (Array.isArray(x.tags)) {
          tags = x.tags;
        } else if (typeof x.tags === 'string' && x.tags.trim()) {
          // 如果是字符串，按逗号、空格等分割
          tags = x.tags.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
        } else if (x.tag && typeof x.tag === 'string' && x.tag.trim()) {
          // 兼容后端可能使用 tag 字段（单数）
          tags = x.tag.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
        }
        
        const item = {
          id: x.id,  // 收藏记录的主键 ID
          aiImageId: x.aiImageId,  // AI 图片 ID
          title: x.title || 'AI生成图',
          cover: x.aiImageUrl || x.imageUrl || x.cover || x.url,
          tags: tags,
          type: x.type || 'AI',
          collectTime: x.collectTime || x.createdAt || x.createTime || new Date().toISOString()
        };
        console.log('[photos] 规范化数据:', { 原始: x, 规范化: item });
        return item;
      }));
      
      console.log('[photos] 规范化后数量:', normalized.length)
      
      return normalized
    } catch (e) {
      console.error('[photos] fetchServerFavorites failed', e)
      return []
    }
  },

  // 微信分享给好友/群聊
  onShareAppMessage(options){
    // 来自页面内"分享"按钮
    if (options && options.from === 'button' && options.target && options.target.dataset) {
      const id = options.target.dataset.id
      const item = (this.data.favorites || []).find(x => x.id === id) || {}
      return {
        title: item.title || 'AI 摄影姿势收藏',
        path: '/pages/photos/index?shareId=' + (id || ''),
        imageUrl: item.cover || ''
      }
    }
    // 右上角菜单分享的默认内容
    return {
      title: '我的摄影姿势收藏',
      path: '/pages/photos/index',
      imageUrl: ''
    }
  }
})