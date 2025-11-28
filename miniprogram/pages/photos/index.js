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

  /**
   * 解析日期字符串，兼容 iOS
   * iOS 只支持特定格式：yyyy/MM/dd、yyyy-MM-dd、yyyy-MM-ddTHH:mm:ss 等
   * @param {string|Date} dateStr - 日期字符串或 Date 对象
   * @returns {Date} Date 对象
   */
  parseDate(dateStr) {
    if (!dateStr) return new Date();
    if (dateStr instanceof Date) return dateStr;
    
    // 如果是 ISO 格式或标准格式，直接解析
    if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(dateStr)) {
      return new Date(dateStr);
    }
    
    // 处理类似 "Fri Nov 07 10:05:23 CST 2025" 的格式
    // 这种格式在 iOS 上不支持，需要转换
    const match = dateStr.match(/(\w{3})\s+(\w{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+\w+\s+(\d{4})/);
    if (match) {
      const months = {
        Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
        Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
      };
      const [, , monthStr, day, hour, minute, second, year] = match;
      const month = months[monthStr];
      if (month !== undefined) {
        return new Date(year, month, day, hour, minute, second);
      }
    }
    
    // 兜底：尝试直接解析，如果失败返回当前时间
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? new Date() : date;
    } catch (e) {
      console.warn('[photos] 日期解析失败:', dateStr, e);
      return new Date();
    }
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
      this.applyThemeColor(bg);
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
      
      // 获取当前收藏项
      const item = this.data.favorites.find(x => x.id === id);
      
      if (!item) {
        wx.showToast({ title: '数据异常，请刷新后重试', icon: 'none' });
        wx.hideLoading();
        return;
      }
      
      // 使用收藏记录的 id 调用删除接口
      await post('/api/collection/remove', { id, userId });
      
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

  // 加载所有收藏（仅从服务器）
  async loadAllFavorites() {
    try {
      // 如果已登录，加载服务器收藏
      const { hasToken } = require('../../utils/storage')
      if (hasToken && hasToken()) {
        const serverFavorites = await this.fetchServerFavorites()
        
        // 规范化并按时间排序
        const normalized = this.normalizeFavorites(serverFavorites)
        normalized.sort((a, b) => {
          const timeA = this.parseDate(a.collectTime).getTime()
          const timeB = this.parseDate(b.collectTime).getTime()
          return timeB - timeA // 倒序
        })
        
        this.setData({ favorites: normalized }, this.computeFiltered)
        
        // 同步到本地存储，供个人中心统计使用
        try {
          wx.setStorageSync('app_favorites', normalized)
          console.log('[photos] 已同步收藏到本地存储，数量:', normalized.length)
        } catch (err) {
          console.error('[photos] 同步本地存储失败:', err)
        }
      } else {
        this.setData({ favorites: [], filtered: [] })
        // 未登录时清空本地存储
        try {
          wx.setStorageSync('app_favorites', [])
        } catch (err) {}
      }
    } catch (e) {
      console.error('[photos] loadAllFavorites failed', e)
      wx.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
      this.setData({ favorites: [], filtered: [] })
      // 加载失败时也清空本地存储
      try {
        wx.setStorageSync('app_favorites', [])
      } catch (err) {}
    }
  },

  // 从服务器拉取收藏列表
  async fetchServerFavorites() {
    try {
      const { hasToken, getAuth } = require('../../utils/storage');
      if (!hasToken()) {
        console.log('[photos] 未登录，无法加载收藏列表');
        return [];
      }
      
      const auth = (getAuth && getAuth()) || {};
      const uidNum = Number(auth.userId);
      const userId = Number.isFinite(uidNum) ? String(Math.trunc(uidNum)) : undefined;

      if (!userId) {
        console.warn('[photos] userId 无效');
        return [];
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
      
      // 规范化字段：区分 AI 生成图和参考图
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
        
        // 根据是否有 referenceImageId 判断类型
        const isReference = !!x.referenceImageId;
        
        // 智能选择 URL：优先使用对应类型的 URL，然后尝试其他字段
        let coverUrl = '';
        if (isReference) {
          // 参考图优先级：referenceImageUrl > url > imageUrl > cover > aiImageUrl
          coverUrl = x.referenceImageUrl || x.url || x.imageUrl || x.cover || x.aiImageUrl || '';
        } else {
          // AI 生成图优先级：aiImageUrl > url > imageUrl > cover > referenceImageUrl
          coverUrl = x.aiImageUrl || x.url || x.imageUrl || x.cover || x.referenceImageUrl || '';
        }
        
        const item = {
          id: x.id,  // 收藏记录的主键 ID
          aiImageId: x.aiImageId,  // AI 图片 ID（AI生成图）
          referenceImageId: x.referenceImageId,  // 参考图 ID（姿势厅图片）
          title: x.title || (isReference ? '参考姿势' : 'AI生成图'),
          cover: coverUrl,
          tags: tags,
          type: isReference ? 'Reference' : 'AI',
          collectTime: x.collectTime || x.createdAt || x.createTime || new Date().toISOString()
        };
        
        // 如果 cover 为空，记录警告
        if (!item.cover) {
          console.warn('[photos] 收藏项缺少图片 URL:', x);
        }
        
        console.log('[photos] 规范化数据:', { 
          原始数据: x,
          规范化后: item,
          判断依据: {
            referenceImageId: x.referenceImageId,
            aiImageId: x.aiImageId,
            判断为参考图: !!x.referenceImageId,
            最终类型: isReference ? '姿势厅(Reference)' : 'AI生图(AI)'
          },
          URL来源: isReference 
            ? (x.referenceImageUrl ? 'referenceImageUrl' : x.url ? 'url' : x.imageUrl ? 'imageUrl' : x.cover ? 'cover' : 'aiImageUrl')
            : (x.aiImageUrl ? 'aiImageUrl' : x.url ? 'url' : x.imageUrl ? 'imageUrl' : x.cover ? 'cover' : 'referenceImageUrl')
        });
        return item;
      }));
      
      // 过滤掉没有图片 URL 的收藏项
      const validItems = normalized.filter(item => {
        if (!item.cover) {
          console.warn('[photos] 过滤掉无效收藏项（缺少图片）:', item);
          return false;
        }
        return true;
      });
      
      console.log('[photos] 规范化后数量:', normalized.length, '有效数量:', validItems.length);
      
      return validItems
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