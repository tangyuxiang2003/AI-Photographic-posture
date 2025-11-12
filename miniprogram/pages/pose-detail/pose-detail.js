const authUtil = require('../../utils/auth')

Page({
  data: {
    poseId: '',
    poseUrl: '',
    pose: {}
  },

  onLoad(options) {
    const poseId = options.id
    const poseUrl = decodeURIComponent(options.url || '')
    
    this.setData({ 
      poseId,
      poseUrl,
      pose: {
        id: poseId,
        url: poseUrl,
        name: `姿势 ${poseId}`,
        description: '点击使用按钮开始拍摄'
      }
    })
  },

  // 关闭页面
  onClose() {
    wx.navigateBack()
  },

  // 使用姿势
  onUse() {
    // 检查登录状态
    if (!authUtil.isLoggedIn()) {
      wx.showModal({
        title: '需要登录',
        content: '使用姿势需要先登录，是否前往登录？',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/profile/profile'
            })
          }
        }
      })
      return
    }

    // TODO: 后续实现跳转到拍摄页面
    wx.showToast({
      title: '准备进入拍摄',
      icon: 'none'
    })
    
    // wx.navigateTo({
    //   url: `/pages/camera/camera?poseId=${this.data.pose.id}`
    // })
  }
})