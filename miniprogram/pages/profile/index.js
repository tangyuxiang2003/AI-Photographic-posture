Page({
  data: {
    profile: {
      avatarUrl: '',
      nickName: '未登录',
      hasAuth: false
    },
    // 临时收集的用户资料（chooseAvatar + nickname）
    tempAvatarUrl: '',
    tempNickName: '',
    themeBg: '#FFF7FA',
    palette: ['#FFF7FA', '#FFEFEF', '#FFF6E5', '#E8F7FF', '#F3F0FF', '#EFFFF3', '#FDEEEF', '#F5F5F5'],
    themeEnabled: true,
    switchOnColor: '#07C160',
    tipsEnabled: true,
    tips: [
      '利用自然光，避免正午强光直射，选择清晨或傍晚逆光更柔和',
      '三分法构图：主体靠近九宫格交点更耐看',
      '尽量稳住手机，按快门前呼吸停顿可减少抖动',
      '拍人像时背景尽量简洁，避免杂物干扰主体',
      '适度留白，给画面“呼吸感”'
    ]
  },

  onLoad() {
    this.loadProfile();
    this.initThemeColor();
  },
  onShow() {
    this.loadProfile();
    // 确保返回页面时主题一致
    try {
      const bg = wx.getStorageSync('theme_bg') || '#FFF7FA';
      const en = wx.getStorageSync('theme_bg_enabled');
      const enabled = typeof en === 'boolean' ? en : true;
      const tipsEn = wx.getStorageSync('tips_enabled');
      const tipsEnabled = typeof tipsEn === 'boolean' ? tipsEn : true;
      const next = {};
      if (bg !== this.data.themeBg) next.themeBg = bg;
      if (enabled !== this.data.themeEnabled) next.themeEnabled = enabled;
      if (tipsEnabled !== this.data.tipsEnabled) next.tipsEnabled = tipsEnabled;
      if (Object.keys(next).length) this.setData(next);
      this.applyThemeColor(bg);
    } catch (e) {}
  },

  loadProfile() {
    try {
      const cached = wx.getStorageSync('profile_basic');
      if (cached && typeof cached === 'object') {
        this.setData({
          profile: {
            avatarUrl: cached.avatarUrl || '',
            nickName: cached.nickName || '未登录',
            hasAuth: !!cached.hasAuth
          }
        });
      }
    } catch (e) {}
  },

  // 主题背景初始化
  initThemeColor() {
    let bg = '#FFF7FA';
    let enabled = true;
    let tipsEnabled = true;
    try {
      const cached = wx.getStorageSync('theme_bg');
      if (cached) bg = cached;
      const en = wx.getStorageSync('theme_bg_enabled');
      if (typeof en === 'boolean') enabled = en;
      const tipsEn = wx.getStorageSync('tips_enabled');
      if (typeof tipsEn === 'boolean') tipsEnabled = tipsEn;
    } catch (e) {}
    this.setData({ themeBg: bg, themeEnabled: enabled, tipsEnabled });
    this.applyThemeColor(bg);
  },

  // 选择主题背景色（来自调色盘）
  onPickTheme(e) {
    const color = e?.currentTarget?.dataset?.color || '#FFF7FA';
    this.setData({ themeBg: color });
    try { wx.setStorageSync('theme_bg', color); } catch (e2) {}
    this.applyThemeColor(color);
  },

  // 开关：是否启用背景主题色选择（仅控制调色盘显示）
  onToggleThemeEnable(e) {
    const enabled = !!(e && e.detail && e.detail.value);
    this.setData({ themeEnabled: enabled });
    try { wx.setStorageSync('theme_bg_enabled', enabled); } catch (e2) {}
  },

  // 开关：展示拍照小技巧
  onToggleTipsEnable(e) {
    const enabled = !!(e && e.detail && e.detail.value);
    this.setData({ tipsEnabled: enabled });
    try { wx.setStorageSync('tips_enabled', enabled); } catch (e2) {}
  },

  // 常用功能：我的收藏
  onTapMyFavorites() {
    wx.switchTab({ url: '/pages/photos/index' });
  },

  // 常用功能：用户建议
  onTapSuggestions() {
    wx.navigateTo({ url: '/pages/profile/suggestions/index' });
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
    // 页面背景
    try {
      wx.setBackgroundColor({
        backgroundColor,
        backgroundColorTop: backgroundColor,
        backgroundColorBottom: backgroundColor
      });
    } catch (e) {}
  },

  // 根据背景色自动选择黑/白前景色，保证可读性
  getContrastingText(hex) {
    // 允许 #RGB/#RRGGBB
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
    // 相对亮度近似，阈值可调
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 160 ? '#000000' : '#ffffff';
  },

  // 用户选择头像
  onChooseAvatar(e) {
    const url = e?.detail?.avatarUrl || '';
    if (!url) return;
    // 已登录：直接更新正式头像并持久化
    if (this.data.profile && this.data.profile.hasAuth) {
      const merged = { ...this.data.profile, avatarUrl: url, hasAuth: true };
      this.setData({ profile: merged });
      try { wx.setStorageSync('profile_basic', merged); } catch (err) {}
      try { console.log('[profile] avatar updated after auth', merged.avatarUrl); } catch (_) {}
      wx.showToast({ title: '头像已更新', icon: 'success' });
      return;
    }
    // 未登录：先作为临时头像，后续点“点击登录”再走授权与落库
    this.setData({ tempAvatarUrl: url });
  },

  // 用户输入昵称
  onNicknameInput(e) {
    const name = e?.detail?.value || '';
    this.setData({ tempNickName: name });
  },

  // 个人中心按钮：使用收集的头像昵称进行登录
  onTapProfileLogin() {
    if (this.data.profile.hasAuth) {
      wx.showToast({ title: '已登录', icon: 'none' });
      return;
    }
    const externalUser = {
      avatarUrl: this.data.tempAvatarUrl || '',
      nickName: this.data.tempNickName || ''
    };
    const { authorizeLogin } = require('../../utils/auth.js');
    authorizeLogin(externalUser)
      .then(({ mergedUser }) => {
        this.setData({ profile: { ...mergedUser, hasAuth: true } });
        try { wx.setStorageSync('profile_basic', { ...mergedUser, hasAuth: true }); } catch (e) {}
        wx.showToast({ title: '登录成功', icon: 'success' });
      })
      .catch((err) => {
        const msg = String(err && err.message || '');
        if (msg.includes('USER_CANCEL_EXPLAIN')) {
          wx.showToast({ title: '已取消授权说明', icon: 'none' });
        } else {
          wx.showToast({ title: '登录失败，请稍后重试', icon: 'none' });
        }
      });
  },

  onGetUserProfile() {
    if (this.data.profile.hasAuth) {
      wx.showToast({ title: '已登录', icon: 'none' });
      return;
    }
    if (!wx.getUserProfile) {
      wx.showToast({ title: '基础库过低，无法获取头像昵称', icon: 'none' });
      return;
    }
    wx.getUserProfile({
      desc: '用于展示头像与昵称',
      success: (res) => {
        const { userInfo } = res || {};
        const next = {
          avatarUrl: userInfo?.avatarUrl || '',
          nickName: userInfo?.nickName || '微信昵称',
          hasAuth: true
        };
        this.setData({ profile: next });
        try {
          wx.setStorageSync('profile_basic', next);
        } catch (e) {}
        wx.showToast({ title: '登录成功', icon: 'success' });
      },
      fail: () => {
        wx.showToast({ title: '已取消授权', icon: 'none' });
      }
    });
  },

  // 已登录后修改昵称
  onEditNickname() {
    if (!this.data.profile || !this.data.profile.hasAuth) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    const current = this.data.profile.nickName || '';
    wx.showModal({
      title: '修改昵称',
      editable: true,
      placeholderText: '输入新昵称',
      content: current,
      confirmText: '保存',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          const name = String(res.content || '').trim();
          if (!name) {
            wx.showToast({ title: '昵称不能为空', icon: 'none' });
            return;
          }
          const merged = { ...this.data.profile, nickName: name, hasAuth: true };
          this.setData({ profile: merged });
          try { wx.setStorageSync('profile_basic', merged); } catch (e) {}
          try {
            const app = getApp && getApp();
            if (app && app.globalData) app.globalData.userInfo = { ...merged };
          } catch (e) {}
          wx.showToast({ title: '已保存', icon: 'success' });
        }
      }
    });
  }
});