Page({
  data: {
    input: '',
    canSubmit: false,
    suggestions: []
  },

  onLoad() {
    this.loadSuggestions();
  },
  onShow() {
    this.loadSuggestions();
  },
  onPullDownRefresh() {
    this.loadSuggestions();
    wx.stopPullDownRefresh();
  },

  onInput(e) {
    const v = (e && e.detail && e.detail.value || '').trimStart();
    this.setData({
      input: v,
      canSubmit: v.trim().length > 0
    });
  },

  loadSuggestions() {
    // 获取用户认证信息
    let token = '';
    let userId = '';
    try {
      token = wx.getStorageSync('auth_token') || wx.getStorageSync('token') || '';
      const authData = wx.getStorageSync('authData');
      const profileBasic = wx.getStorageSync('profile_basic');
      
      userId = (authData && authData.userId) || 
               (profileBasic && profileBasic.userId) || 
               wx.getStorageSync('userId') || '';
      
      if (userId) {
        userId = String(userId);
      }
    } catch (e) {
      console.error('[suggestions] 获取认证信息失败:', e);
    }

    // 如果未登录,显示空列表
    if (!token || !userId) {
      this.setData({ suggestions: [] });
      return;
    }

    // 获取 API 基础地址
    const getBaseUrl = () => {
      try {
        const v = wx.getStorageSync('api_base');
        if (v && typeof v === 'string') return v;
      } catch (e) {}
      return 'https://ai.biohelix.cn';
    };

    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/api/suggestion/list?userId=${encodeURIComponent(userId)}`;

    console.log('[suggestions] 加载历史建议:', { userId, url });

    // 从后端获取历史建议
    wx.request({
      url,
      method: 'GET',
      header: {
        'Authorization': `Bearer ${token}`
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.code === 200) {
          const backendList = res.data.data || [];
          // 转换后端数据格式为前端格式
          const list = backendList.map(item => ({
            id: item.id,
            content: item.suggestionText,
            imageUrl: item.suggestionImage || '',
            createdAt: item.createTime ? new Date(item.createTime).getTime() : Date.now(),
            readableTime: item.createTime || this.formatTime(Date.now())
          }));
          
          console.log('[suggestions] 加载成功,共', list.length, '条记录');
          this.setData({ suggestions: list });
          
          // 同步保存到本地存储(可选,用于离线查看)
          try {
            wx.setStorageSync('user_suggestions', list);
          } catch (e) {}
        } else {
          console.warn('[suggestions] 加载失败:', res.data);
          // 加载失败时尝试使用本地缓存
          this.loadLocalSuggestions();
        }
      },
      fail: (err) => {
        console.error('[suggestions] 网络请求失败:', err);
        // 网络失败时使用本地缓存
        this.loadLocalSuggestions();
      }
    });
  },

  // 从本地缓存加载建议(作为后备方案)
  loadLocalSuggestions() {
    let list = [];
    try {
      const cached = wx.getStorageSync('user_suggestions');
      if (Array.isArray(cached)) {
        list = cached.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      }
    } catch (e) {}
    this.setData({ suggestions: list });
  },

  onSubmit() {
    const text = (this.data.input || '').trim();
    if (!text) {
      wx.showToast({ title: '请输入内容', icon: 'none' });
      return;
    }

    // 获取用户认证信息
    let token = '';
    let userId = '';
    try {
      // 获取 token
      token = wx.getStorageSync('auth_token') || wx.getStorageSync('token') || '';
      
      // 从多个可能的位置获取 userId
      const authData = wx.getStorageSync('authData');
      const profileBasic = wx.getStorageSync('profile_basic');
      
      userId = (authData && authData.userId) || 
               (profileBasic && profileBasic.userId) || 
               wx.getStorageSync('userId') || '';
      
      // 确保 userId 是字符串
      if (userId) {
        userId = String(userId);
      }
      
      console.log('[suggestions] 获取到的认证信息:', { 
        hasToken: !!token, 
        userId: userId,
        tokenPreview: token ? token.substring(0, 20) + '...' : '无'
      });
    } catch (e) {
      console.error('获取认证信息失败:', e);
    }

    if (!token || !userId) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      console.error('[suggestions] 缺少认证信息:', { hasToken: !!token, hasUserId: !!userId });
      return;
    }

    // 显示加载提示
    wx.showLoading({ title: '提交中...', mask: true });

    // 获取 API 基础地址
    const getBaseUrl = () => {
      try {
        const v = wx.getStorageSync('api_base');
        if (v && typeof v === 'string') return v;
      } catch (e) {}
      return 'https://ai.biohelix.cn';
    };

    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/api/suggestion/add`;

    // 构造表单数据字符串
    const formData = `userId=${encodeURIComponent(userId)}&suggestionText=${encodeURIComponent(text)}`;
    
    console.log('[suggestions] 提交数据:', { userId, suggestionText: text, formData });

    // 调用后端接口 - 使用 form-urlencoded 格式
    wx.request({
      url,
      method: 'POST',
      header: {
        'content-type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${token}`
      },
      data: formData,
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200 && res.data) {
          // 提交成功,清空输入框并重新加载列表
          this.setData({ input: '', canSubmit: false });
          wx.showToast({ title: '提交成功', icon: 'success' });
          
          // 重新从后端加载最新的建议列表
          setTimeout(() => {
            this.loadSuggestions();
          }, 500);
        } else {
          wx.showToast({ 
            title: res.data?.message || '提交失败,请重试', 
            icon: 'none' 
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('提交建议失败:', err);
        wx.showToast({ title: '网络错误,请重试', icon: 'none' });
      }
    });
  },

  formatTime(ts) {
    try {
      const d = new Date(ts);
      const pad = (n) => (n < 10 ? '0' + n : '' + n);
      const y = d.getFullYear();
      const m = pad(d.getMonth() + 1);
      const day = pad(d.getDate());
      const h = pad(d.getHours());
      const mi = pad(d.getMinutes());
      return `${y}-${m}-${day} ${h}:${mi}`;
    } catch (e) {
      return '';
    }
  }
});