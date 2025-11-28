// 隐私协议弹窗组件
Component({
  data: {
    showPrivacy: false,
    resolvePrivacy: null
  },

  lifetimes: {
    attached() {
      // 组件加载时检查是否需要显示隐私弹窗
      this.checkPrivacy();
    }
  },

  methods: {
    // 检查隐私协议状态
    checkPrivacy() {
      if (wx.getPrivacySetting) {
        wx.getPrivacySetting({
          success: res => {
            console.log('隐私协议检查结果:', res);
            if (res.needAuthorization) {
              // 需要用户同意隐私协议
              this.setData({ showPrivacy: true });
            } else {
              // 用户已经同意
              this.setData({ showPrivacy: false });
            }
          },
          fail: err => {
            console.error('获取隐私设置失败:', err);
          }
        });
      }
    },

    // 打开隐私协议
    openPrivacyContract() {
      if (wx.openPrivacyContract) {
        wx.openPrivacyContract({
          success: () => {
            console.log('打开隐私协议成功');
          },
          fail: err => {
            console.error('打开隐私协议失败:', err);
          }
        });
      }
    },

    // 用户同意
    handleAgree(e) {
      console.log('用户同意隐私协议', e);
      this.setData({ showPrivacy: false });
      
      // 触发同意事件
      this.triggerEvent('agree');
      
      // 提示用户
      wx.showToast({
        title: '感谢您的信任',
        icon: 'success',
        duration: 2000
      });
    },

    // 用户拒绝
    handleDisagree() {
      console.log('用户拒绝隐私协议');
      
      wx.showModal({
        title: '温馨提示',
        content: '拒绝授权将无法使用相机等功能，是否确认拒绝？',
        confirmText: '确认拒绝',
        cancelText: '重新考虑',
        success: res => {
          if (res.confirm) {
            // 用户确认拒绝，返回上一页或首页
            this.triggerEvent('disagree');
            
            wx.showToast({
              title: '已拒绝授权',
              icon: 'none',
              duration: 2000,
              success: () => {
                setTimeout(() => {
                  // 尝试返回上一页，如果没有上一页则跳转到首页
                  const pages = getCurrentPages();
                  if (pages.length > 1) {
                    wx.navigateBack();
                  } else {
                    wx.switchTab({
                      url: '/pages/index/index'
                    });
                  }
                }, 1500);
              }
            });
          } else {
            // 用户取消，继续显示弹窗
            console.log('用户重新考虑');
          }
        }
      });
    }
  }
});