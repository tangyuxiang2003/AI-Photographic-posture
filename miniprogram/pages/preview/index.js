// pages/preview/index.js
Page({
  data: {
    imagePath: ''
  },
  onLoad(options) {
    const { imagePath = '' } = options || {};
    this.setData({ imagePath });
    if (!imagePath) {
      wx.showToast({ title: '未获取到图片', icon: 'none' });
    }
  },
  onOpenPreview() {
    const url = this.data.imagePath;
    if (!url) return;
    wx.previewImage({ current: url, urls: [url] });
  },
  onSave() {
    const url = this.data.imagePath;
    if (!url) return;
    // 保存到相册前确保已授权
    wx.saveImageToPhotosAlbum({
      filePath: url,
      success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: (err) => {
        if (err && err.errMsg && err.errMsg.includes('auth')) {
          wx.showModal({
            title: '提示',
            content: '需要开启“保存到相册”权限',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) wx.openSetting({});
            }
          });
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      }
    });
  },
  onRetake() {
    // 返回到相机页重新拍摄
    wx.navigateBack();
  },
  onBack() {
    wx.navigateBack();
  }
});