// app.js
App({
  onLaunch() {
    // 检查隐私协议
    this.checkPrivacyAuthorization();
  },

  // 检查并处理隐私协议
  checkPrivacyAuthorization() {
    if (wx.getPrivacySetting) {
      wx.getPrivacySetting({
        success: res => {
          console.log('隐私协议状态:', res);
          // needAuthorization 表示需要弹出隐私协议
          if (res.needAuthorization) {
            // 需要用户同意隐私协议
            console.log('需要用户同意隐私协议');
          } else {
            // 用户已经同意过隐私协议
            console.log('用户已同意隐私协议');
          }
        },
        fail: err => {
          console.error('获取隐私设置失败:', err);
        }
      });
    } else {
      console.log('当前基础库版本不支持隐私协议API');
    }
  },

  globalData: {
    userInfo: null
  }
});