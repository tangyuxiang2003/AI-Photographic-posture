Page({
  data: {
    profile: {
      avatarUrl: '',
      nickName: '未登录',
      hasAuth: false
    },
    // 统计数据
    stats: {
      photos: 0,
      favorites: 0,
      following: 0
    },
    // 临时收集的用户资料（chooseAvatar + nickname）
    tempAvatarUrl: '',
    tempNickName: '',
    themeBg: '#FFF7FA',
    palette: [
      '#FFF7FA', // 浅粉红
      '#E8F7FF', // 浅蓝色
      '#F3F0FF', // 淡紫色
      '#EFFFF3', // 薄荷绿
      '#F5F5F5', // 浅灰色
      '#FFFACD', // 柠檬黄
      '#E0F2F7', // 天蓝色
      '#FCE4EC', // 樱花粉
      '#E8EAF6', // 靛蓝浅
      '#FFF9E6' , // 象牙白
      '#FFF0F5', // 淡粉色
      '#F0F8FF', // 爱丽丝蓝
      '#E6E6FA', // 薰衣草紫
      '#F5FFFA', // 蜜丝佛陀绿
      '#F8F8FF', // 雪白色
      '#FFF5EE', // 古董白
      '#F0FFF0', // 蜂蜜 dew
      '#FFFAF0', // 象牙色
      '#FAF0E6', // 亚麻色
      '#DCDCDC', // gainsboro 灰
    ],
    themeEnabled: true,
    switchOnColor: '#07C160',
    tipsEnabled: true,
    tips: [
      '利用自然光，避免正午强光直射，选择清晨或傍晚逆光更柔和',
      '三分法构图：主体靠近九宫格交点更耐看',
      '尽量稳住手机，按快门前呼吸停顿可减少抖动',
      '拍人像时背景尽量简洁，避免杂物干扰主体',
      '适度留白，给画面"呼吸感"'
    ]
  },

  onLoad() {
    this.loadProfile();
    this.loadStats();
    this.initThemeColor();
  },
  
  onShow() {
    this.loadProfile();
    this.loadStats();
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
      // 只在个人中心页面应用主题色
      if (this.data.themeEnabled) {
        this.applyThemeColor(bg);
      }
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

  // 加载统计数据
  loadStats() {
    try {
      // 从本地存储读取收藏数量
      const favorites = wx.getStorageSync('app_favorites') || [];
      const favCount = Array.isArray(favorites) ? favorites.length : 0;
      
      // 从本地存储读取照片数量（如果有的话）
      const photos = wx.getStorageSync('generated_images') || [];
      const photoCount = Array.isArray(photos) ? photos.length : 0;
      
      this.setData({
        stats: {
          photos: photoCount,
          favorites: favCount,
          following: 0
        }
      });
      
      console.log('[profile] 统计数据加载:', { photos: photoCount, favorites: favCount });
    } catch (e) {
      console.error('[profile] 加载统计数据失败:', e);
    }
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
    // 更新全局主题
    const app = getApp();
    if (app && app.setTheme) {
      app.setTheme(color);
    }
    // 只在启用主题时应用
    if (this.data.themeEnabled) {
      this.applyThemeColor(color);
    }
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

  // 测试认证是否有效
  async testAuth() {
    try {
      const { get } = require('../../utils/request');
      const { getAuth } = require('../../utils/storage');
      
      const auth = getAuth() || {};
      console.log('[profile] 测试认证 - 当前认证信息:', {
        hasToken: !!auth.token,
        tokenPreview: auth.token ? auth.token.substring(0, 30) + '...' : '(空)',
        userId: auth.userId
      });
      
      // 尝试调用一个简单的接口测试认证
      const response = await get('/api/user/info');
      console.log('[profile] 认证测试成功:', response);
      wx.showToast({ title: '认证有效', icon: 'success' });
    } catch (err) {
      console.error('[profile] 认证测试失败:', err);
      wx.showToast({ title: '认证失败: ' + err.statusCode, icon: 'none' });
    }
  },

  // 用户选择头像
  async onChooseAvatar(e) {
    const url = e?.detail?.avatarUrl || '';
    if (!url) return;
    
    // 已登录：上传头像到后端
    if (this.data.profile && this.data.profile.hasAuth) {
      try {
        wx.showLoading({ title: '上传中...', mask: true });
        
        const { upload } = require('../../utils/request');
        const { getAuth } = require('../../utils/storage');
        
        const auth = getAuth() || {};
        const userId = auth.userId;
        const token = auth.token;
        
        console.log('[profile] 上传头像 - 认证信息:', { 
          userId, 
          hasToken: !!token,
          tokenPreview: token ? token.substring(0, 20) + '...' : '(空)'
        });
        
        if (!userId) {
          wx.showToast({ title: '用户信息异常，请重新登录', icon: 'none' });
          wx.hideLoading();
          return;
        }
        
        if (!token) {
          wx.showToast({ title: 'Token 已过期，请重新登录', icon: 'none' });
          wx.hideLoading();
          return;
        }
        
        // 先测试一下修改昵称接口是否正常（验证 Token 是否有效）
        try {
          const { post } = require('../../utils/request');
          console.log('[profile] 测试 Token 有效性 - 调用修改昵称接口');
          const testResponse = await post('/api/user/updateNickname', {
            id: userId,
            nickname: this.data.profile.nickName || '测试'
          });
          console.log('[profile] Token 测试成功:', testResponse);
        } catch (testErr) {
          console.error('[profile] Token 测试失败:', testErr);
          if (testErr.statusCode === 401 || testErr.statusCode === 403) {
            wx.showToast({ title: 'Token 无效，请重新登录', icon: 'none' });
            wx.hideLoading();
            return;
          }
        }
        
        // 调用后端上传接口
        console.log('[profile] 准备上传头像:', {
          url: '/api/user/uploadAvatar',
          filePath: url,
          filePathType: typeof url,
          name: 'avatar',
          formData: { id: String(userId) },
          userId: userId,
          userIdType: typeof userId
        });
        
        const response = await upload({
          url: '/api/user/uploadAvatar',
          filePath: url,
          name: 'avatar', // 后端接收的文件字段名
          formData: {
            id: String(userId) // 确保 id 是字符串类型
          },
          autoAddUserId: false // 不自动添加 userId，避免与 id 参数冲突
        });
        
        console.log('[profile] 上传头像完整响应:', {
          statusCode: response.statusCode,
          data: response.data,
          header: response.header,
          errMsg: response.errMsg
        });
        
        // 解析响应
        let responseData = response?.data;
        if (typeof responseData === 'string') {
          try { responseData = JSON.parse(responseData); } catch(e) {}
        }
        
        // 检查上传是否成功
        if (response.statusCode === 200 && responseData?.code === 200) {
          // 上传成功，更新本地头像
          const merged = { ...this.data.profile, avatarUrl: url, hasAuth: true };
          this.setData({ profile: merged });
          try { wx.setStorageSync('profile_basic', merged); } catch (err) {}
          
          // 同步到全局
          try {
            const app = getApp && getApp();
            if (app && app.globalData) app.globalData.userInfo = { ...merged };
          } catch (e) {}
          
          console.log('[profile] 头像上传成功:', merged.avatarUrl);
          wx.showToast({ title: '头像修改成功', icon: 'success' });
        } else {
          // 上传失败
          const msg = responseData?.msg || '上传失败';
          wx.showToast({ title: msg, icon: 'none' });
        }
      } catch (err) {
        console.error('[profile] 上传头像失败 - 详细错误:', {
          statusCode: err.statusCode,
          data: err.data,
          errMsg: err.errMsg,
          header: err.header
        });
        
        // 处理不同的错误状态码
        if (err.statusCode === 401) {
          wx.showModal({
            title: '认证失败',
            content: 'Token 已过期或无效，请重新登录',
            showCancel: false,
            success: () => {
              // 清除本地认证信息
              try {
                wx.removeStorageSync('authData');
                wx.removeStorageSync('token');
                wx.removeStorageSync('auth_token');
                wx.removeStorageSync('profile_basic');
              } catch (e) {}
              // 刷新页面
              this.setData({
                profile: {
                  avatarUrl: '',
                  nickName: '未登录',
                  hasAuth: false
                }
              });
            }
          });
        } else if (err.statusCode === 403) {
          wx.showModal({
            title: '权限不足',
            content: `无法上传头像，可能是：
1. Token 无效
2. 用户权限不足
3. 接口参数错误

状态码: 403`,
            showCancel: false
          });
        } else {
          wx.showToast({ title: '上传失败: ' + (err.statusCode || '网络错误'), icon: 'none' });
        }
      } finally {
        wx.hideLoading();
      }
      return;
    }
    
    // 未登录：先作为临时头像，后续点"点击登录"再走授权与落库
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
      .then(({ mergedUser, token }) => {
        console.log('[profile] 登录成功，用户信息:', mergedUser);
        console.log('[profile] 登录成功，后端返回的 token:', token);
        
        // 保存 token，供请求自动注入 Authorization 使用
        if (typeof token === 'string' && token) {
          try { wx.setStorageSync('token', token); } catch (e) {}
          try { wx.setStorageSync('auth_token', token); } catch (e) {}
          // 使用封装的 setToken，统一注入到 utils/request.js
          try { require('../../utils/request.js').setToken(token); } catch (e) {}
        }
        
        // 清除游客模式标记
        try { wx.removeStorageSync('auth_bypassed'); } catch (e) {}
        
        this.setData({ profile: { ...mergedUser, hasAuth: true } });
        try { wx.setStorageSync('profile_basic', { ...mergedUser, hasAuth: true }); } catch (e) {}
        wx.showToast({ title: '登录成功', icon: 'success' });
        
        // 登录成功后重新加载个人信息和统计数据
        setTimeout(() => {
          this.loadProfile();
          this.loadStats();
        }, 500);
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
      success: async (res) => {
        if (res.confirm) {
          const name = String(res.content || '').trim();
          if (!name) {
            wx.showToast({ title: '昵称不能为空', icon: 'none' });
            return;
          }
          
          // 调用后端接口更新昵称
          try {
            wx.showLoading({ title: '保存中...', mask: true });
            
            const { post } = require('../../utils/request');
            const { getAuth } = require('../../utils/storage');
            
            const auth = getAuth() || {};
            const userId = auth.userId;
            const token = auth.token;
            
            console.log('[profile] 当前认证信息:', { 
              hasToken: !!token, 
              tokenPreview: token ? token.substring(0, 20) + '...' : '(空)',
              userId: userId,
              userIdType: typeof userId
            });
            
            if (!userId) {
              wx.showToast({ title: '用户信息异常，请重新登录', icon: 'none' });
              wx.hideLoading();
              return;
            }
            
            if (!token) {
              wx.showToast({ title: 'Token 已过期，请重新登录', icon: 'none' });
              wx.hideLoading();
              return;
            }
            
            const requestData = { id: userId, nickname: name };
            console.log('[profile] 更新昵称请求参数:', requestData);
            console.log('[profile] 即将发送 POST 请求到: /api/user/updateNickname');
            
            // 调用后端接口（request.js 会自动添加 token 和 userId）
            const response = await post('/api/user/updateNickname', requestData);
            
            console.log('[profile] 更新昵称响应:', response);
            
            // 解析后端响应，获取返回的昵称
            let responseData = response?.data;
            if (typeof responseData === 'string') {
              try { responseData = JSON.parse(responseData); } catch(e) {}
            }
            
            // 优先使用后端返回的 nickname，如果没有则使用用户输入的
            const finalNickname = (responseData?.data?.nickname || responseData?.nickname || name);
            
            console.log('[profile] 使用昵称:', finalNickname);
            
            // 更新成功后，更新本地数据
            const merged = { ...this.data.profile, nickName: finalNickname, hasAuth: true };
            this.setData({ profile: merged });
            try { wx.setStorageSync('profile_basic', merged); } catch (e) {}
            
            // 同步到全局
            try {
              const app = getApp && getApp();
              if (app && app.globalData) app.globalData.userInfo = { ...merged };
            } catch (e) {}
            
            wx.showToast({ title: '昵称修改成功', icon: 'success' });
          } catch (err) {
            console.error('[profile] 修改昵称失败', err);
            
            // 处理 401/403 错误
            if (err.statusCode === 401 || err.statusCode === 403) {
              wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' });
            } else {
              wx.showToast({ title: '修改失败，请稍后重试', icon: 'none' });
            }
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  }
});