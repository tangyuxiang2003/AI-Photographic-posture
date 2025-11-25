// video-preview.js
Page({
  data: {
    videoPath: ''
  },

  onLoad(options) {
    if (options.videoPath) {
      this.setData({
        videoPath: decodeURIComponent(options.videoPath)
      });
    }
  },

  // 保存到相册
  saveToAlbum() {
    wx.showLoading({
      title: '保存中...',
      mask: true
    });

    wx.saveVideoToPhotosAlbum({
      filePath: this.data.videoPath,
      success: () => {
        wx.hideLoading();
        wx.showToast({
          title: '已保存到相册',
          icon: 'success',
          duration: 2000
        });
        // 延迟返回，让用户看到成功提示
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('保存视频失败', err);
        
        if (err.errMsg && err.errMsg.includes('auth')) {
          wx.showModal({
            title: '需要相册权限',
            content: '保存实况需要相册权限，请在设置中开启',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) {
                wx.openSetting({
                  success: (settingRes) => {
                    if (settingRes.authSetting['scope.writePhotosAlbum']) {
                      // 权限开启后重试保存
                      this.saveToAlbum();
                    }
                  }
                });
              }
            }
          });
        } else {
          wx.showToast({
            title: '保存失败',
            icon: 'none'
          });
        }
      }
    });
  },

  // 取消保存
  cancel() {
    wx.navigateBack();
  }
});