Page({
  data: {
    // 全局主题背景色
    themeBg: '#FFF7FA',
    query: '',
    activeTab: '全部',
    favorites: [
      {
        id: 'p1',
        title: '韩系咖啡店回眸',
        cover: '../../images/ai_example1.png',
        tags: ['韩系','咖啡店','回眸'],
        type: '场景'
      },
      {
        id: 'p2',
        title: '法式花墙托腮',
        cover: '../../images/ai_example2.png',
        tags: ['法式','花墙','托腮'],
        type: '风格'
      },
      {
        id: 'p3',
        title: '公园坐姿显腿长',
        cover: '../../images/default-goods-image.png',
        tags: ['公园','坐姿','显腿长'],
        type: '姿势'
      },
      {
        id: 'p4',
        title: '通勤极简抱臂',
        cover: '../../images/create_env.png',
        tags: ['通勤','极简','抱臂'],
        type: '风格'
      },
      {
        id: 'p5',
        title: '海边逆光拨发',
        cover: '../../images/scf-enter.png',
        tags: ['海边','逆光','拨发'],
        type: '场景'
      },
      {
        id: 'p6',
        title: '书店通道回眸',
        cover: '../../images/database.png',
        tags: ['书店','回眸','抓拍'],
        type: '场景'
      }
    ],
    filtered: []
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
    try{
      const cached = wx.getStorageSync('app_favorites')
      const base = Array.isArray(cached) && cached.length ? cached : this.data.favorites
      const normalized = this.normalizeFavorites(base)
      this.setData({ favorites: normalized }, () => {
        this.computeFiltered()
        wx.showShareMenu({ withShareTicket: true })
      })
    }catch(_){
      this.computeFiltered()
      wx.showShareMenu({ withShareTicket: true })
    }
  },

  onShow(){
    // 同步主题背景
    try {
      const bg = wx.getStorageSync('theme_bg') || '#FFF7FA';
      if (bg !== this.data.themeBg) this.setData({ themeBg: bg });
      this.applyThemeColor(bg);
    } catch (e) {}
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

  onToggleFavorite(e){
    const id = e.currentTarget.dataset.id
    const next = this.data.favorites.filter(it => it.id !== id)
    try { wx.setStorageSync('app_favorites', next) } catch(_) {}
    this.setData({ favorites: next }, this.computeFiltered)
    wx.showToast({ title: '已取消收藏', icon: 'none' })
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