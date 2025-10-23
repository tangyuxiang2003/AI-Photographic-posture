Page({
  data: {
    profile: {
      avatarUrl: '',
      nickName: '未登录',
      hasAuth: false
    }
  },

  onLoad() {
    this.loadProfile();
  },
  onShow() {
    this.loadProfile();
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
          nickName: userInfo?.nickName || '已登录',
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
  }
});