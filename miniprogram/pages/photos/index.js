Page({
  data: {
    // 全局主题背景色
    themeBg: '#FFF7FA',
    query: '',
    activeTab: '全部',
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
      this.applyThemeColor(bg);
    } catch (e) {}

    // 先读本地缓存回显（仅对“使用过且收藏过”的用户），再请求后端刷新
    try {
      const used = !!wx.getStorageSync('has_favorited_before');
      if (used) {
        const cached = wx.getStorageSync('app_favorites');
        const base = Array.isArray(cached) && cached.length ? cached : [];
        const normalized = this.normalizeFavorites(base);
        this.setData({ favorites: normalized }, () => {
          this.computeFiltered();
          wx.showShareMenu({ withShareTicket: true });
        });
      } else {
        // 新用户：不显示任何项目缓存的照片
        this.setData({ favorites: [] }, () => {
          this.computeFiltered();
          wx.showShareMenu({ withShareTicket: true });
        });
      }
    } catch(_) {
      this.computeFiltered();
      wx.showShareMenu({ withShareTicket: true });
    }

    // 使用新的数据同步工具异步拉取后端收藏
    this.syncFavoritesFromServer();
  },

  // 使用统一的数据同步工具
  async syncFavoritesFromServer() {
    try {
      const { hasToken } = require('../../utils/storage');
      if (!hasToken()) {
        console.log('[photos] 未登录，跳过收藏同步');
        return;
      }
      
      const { syncFavorites } = require('../../utils/sync');
      const favorites = await syncFavorites();
      
      if (favorites && favorites.length > 0) {
        const normalized = this.normalizeFavorites(favorites);
        this.setData({ favorites: normalized }, this.computeFiltered);
        // 标记用户已收藏过
        try { wx.setStorageSync('has_favorited_before', true); } catch(_) {}
      }
    } catch (err) {
      console.warn('[photos] 同步收藏失败，使用本地缓存', err);
      // 失败时保持使用本地缓存
    }
  },

  onShow(){
    // 同步主题背景
    try {
      const bg = wx.getStorageSync('theme_bg') || '#FFF7FA';
      if (bg !== this.data.themeBg) this.setData({ themeBg: bg });
      this.applyThemeColor(bg);
    } catch (e) {}

    // 若有 token，进入页面时刷新一次收藏列表；否则延迟重试
    try {
      const { hasToken } = require('../../utils/storage');
      if (hasToken()) {
        this.syncFavoritesFromServer();
      } else {
        // 最多重试 3 次：300ms / 1000ms / 2000ms
        const retry = (ms, left) => {
          if (left <= 0) return;
          setTimeout(() => {
            try {
              const { hasToken } = require('../../utils/storage');
              if (hasToken()) {
                this.syncFavoritesFromServer();
              } else {
                retry(ms * 2, left - 1);
              }
            } catch(_) {}
          }, ms);
        };
        retry(300, 3);
      }
    } catch(_) {}
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

  onSetTab(e){
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab }, this.computeFiltered)
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

  // 保存标签到本地
  onSaveTags(){
    const id = this.data.editingId;
    if (!id) return this.onCloseTagEditor();

    const raw = (this.data.editingTags || '');
    const tags = raw
      .split(/[,，\s]+/)
      .map(s => s.trim())
      .filter(Boolean);

    try {
      const fav = require('../../utils/favorites');
      fav.setPhotoTags(id, tags);
      // 读取本地并规范化后刷新（包含 searchText）
      const list = fav.getAll();
      const normalized = this.normalizeFavorites(list);
      this.setData({ favorites: normalized }, this.computeFiltered);
    } catch(_) {
      // 回退到内存更新
      const prev = this.data.favorites.slice();
      const next = prev.map(it => it.id === id ? { ...it, tags } : it);
      try { wx.setStorageSync('app_favorites', next) } catch(_) {}
      this.setData({ favorites: this.normalizeFavorites(next) }, this.computeFiltered);
    }

    this.onCloseTagEditor();
    wx.showToast({ title: '已保存风格标签', icon: 'none' });
  },

  onCloseTagEditor(){
    this.setData({ showTagEditor: false, editingId: null, editingTags: '' });
  },

  computeFiltered(){
    const { favorites, activeTab, query } = this.data
    const q = (query || '').trim().toLowerCase()
    const list = (favorites || []).filter(it => {
      const tags = Array.isArray(it?.tags) ? it.tags : []
      const okTab = activeTab === '全部' ? true : (it?.type === activeTab || tags.includes(activeTab))
      const text = it?.searchText || (((it?.title || '') + ' ' + tags.join(' ')).toLowerCase())
      const okQuery = q ? text.includes(q) : true
      return okTab && okQuery
    })
    this.setData({ filtered: list })
  },

  // 取消收藏（优先本地；有登录再调用后端）
  async onToggleFavorite(e){
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    const prev = this.data.favorites.slice();
    const next = prev.filter(it => it.id !== id);

    // 本地更新 UI 和缓存
    try { wx.setStorageSync('app_favorites', next) } catch(_) {}
    this.setData({ favorites: next }, this.computeFiltered);

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
      wx.showToast({ title: '已取消收藏', icon: 'none' });
      return;
    }

    // 有 token 才调用后端
    try {
      const { post } = require('../../utils/request');
      await post('/api/collection/remove', { aiImageId: id, userId });
      wx.showToast({ title: '已取消收藏', icon: 'none' });
    } catch (err) {
      // 回滚
      try { wx.setStorageSync('app_favorites', prev) } catch(_) {}
      this.setData({ favorites: prev }, this.computeFiltered);
      wx.showToast({ title: '取消失败，请稍后重试', icon: 'none' });
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

  // 后端拉取收藏列表（按你的接口：/api/collection/list）
  async fetchFavorites() {
    try {
      const { hasToken, getAuth } = require('../../utils/storage');
      if (!hasToken()) return;
      const auth = (getAuth && getAuth()) || {};
      const uidNum = Number(auth.userId);
      const userId = Number.isFinite(uidNum) ? String(Math.trunc(uidNum)) : undefined;

      const { get } = require('../../utils/request');
      // 后端为 GET /api/collection/list，这里改为 GET 并通过 query 传参
      const resp = await get('/api/collection/list', { userId });
      const items = resp?.data?.items || resp?.data || [];
      const base = Array.isArray(items) ? items : [];
      // 规范化字段：id 用 aiImageId；cover 用 imageUrl
      const normalized = this.normalizeFavorites(base.map(x => ({
        id: x.aiImageId || x.id,
        title: x.title || 'AI生成图',
        cover: x.imageUrl || x.cover || x.url,
        tags: Array.isArray(x.tags) ? x.tags : [],
        type: x.type || 'AI'
      })));
      try { wx.setStorageSync('app_favorites', normalized) } catch(_) {}
      // 老用户：若后端返回存在收藏，标记为已收藏过
      if (normalized.length > 0) { try { wx.setStorageSync('has_favorited_before', true) } catch(_) {} }
      this.setData({ favorites: normalized }, this.computeFiltered);
    } catch (e) {
      try { console.warn('[photos] fetchFavorites failed', e) } catch(_) {}
    }
  },

  // 微信分享给好友/群聊
  onShareAppMessage(options){
    // 来自页面内“分享”按钮
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