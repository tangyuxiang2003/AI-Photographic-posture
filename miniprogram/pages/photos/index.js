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

    // 显示加载提示
    wx.showLoading({ title: '加载中...', mask: true });
    
    // 直接从后端加载收藏列表
    this.fetchFavorites().finally(() => {
      wx.hideLoading();
      wx.showShareMenu({ withShareTicket: true });
    });
  },

  onShow(){
    // 同步主题背景
    try {
      const bg = wx.getStorageSync('theme_bg') || '#FFF7FA';
      if (bg !== this.data.themeBg) this.setData({ themeBg: bg });
      this.applyThemeColor(bg);
    } catch (e) {}

    // 每次显示页面时从后端刷新收藏列表
    this.fetchFavorites();
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

  // 保存标签（仅更新本地显示，不调用后端）
  onSaveTags(){
    const id = this.data.editingId;
    if (!id) return this.onCloseTagEditor();

    const raw = (this.data.editingTags || '');
    const tags = raw
      .split(/[,，\s]+/)
      .map(s => s.trim())
      .filter(Boolean);

    // 更新内存中的数据
    const prev = this.data.favorites.slice();
    const next = prev.map(it => it.id === id ? { ...it, tags } : it);
    const normalized = this.normalizeFavorites(next);
    this.setData({ favorites: normalized }, this.computeFiltered);

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
      await post('/api/collection/remove', { aiImageId: id, userId });
      
      // 删除成功后重新从后端加载列表
      await this.fetchFavorites();
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

  // 后端拉取收藏列表（按你的接口：/api/collection/list）
  async fetchFavorites() {
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
      const items = resp?.data || [];
      const base = Array.isArray(items) ? items : [];
      
      console.log('[photos] 从后端加载收藏列表，数量:', base.length);
      
      // 规范化字段：id 用 aiImageId；cover 用 aiImageUrl；保留 collectTime
      const normalized = this.normalizeFavorites(base.map(x => ({
        id: x.aiImageId || x.id,
        title: x.title || 'AI生成图',
        cover: x.aiImageUrl || x.imageUrl || x.cover || x.url,
        tags: Array.isArray(x.tags) ? x.tags : [],
        type: x.type || 'AI',
        collectTime: x.collectTime || new Date().toISOString()
      })));
      
      // 按收藏时间倒序排序（最新的在最上方）
      normalized.sort((a, b) => {
        const timeA = new Date(a.collectTime).getTime();
        const timeB = new Date(b.collectTime).getTime();
        return timeB - timeA; // 倒序
      });
      
      this.setData({ favorites: normalized }, this.computeFiltered);
    } catch (e) {
      console.error('[photos] fetchFavorites failed', e);
      wx.showToast({ title: '加载失败，请稍后重试', icon: 'none' });
      this.setData({ favorites: [], filtered: [] });
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