const { get } = require('../../utils/request')
const authUtil = require('../../utils/auth')

Page({
  data: {
    tag: '',
    categoryName: '',
    poses: [],
    statusBarHeight: 0,
    menuButtonHeight: 0,
    headerHeight: 0
  },

  onLoad(options) {
    const tag = decodeURIComponent(options.tag || '')
    
    // 获取系统信息和胶囊按钮信息
    const systemInfo = wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    
    const statusBarHeight = systemInfo.statusBarHeight || 0
    const menuButtonHeight = menuButton.height || 32
    const menuButtonTop = menuButton.top || statusBarHeight
    
    // 计算头部总高度：胶囊按钮底部（减少60px向上移动）
    const headerHeight = (menuButtonTop - statusBarHeight) + menuButtonHeight + statusBarHeight
    
    this.setData({
      tag: tag,
      categoryName: tag,
      statusBarHeight: statusBarHeight,
      menuButtonHeight: menuButtonHeight,
      headerHeight: headerHeight
    })
    
    console.log('页面布局信息:', {
      statusBarHeight,
      menuButtonHeight,
      menuButtonTop,
      headerHeight
    })
    
    this.loadPoses()
  },

  // 加载姿势数据
  async loadPoses() {
    try {
      wx.showLoading({ title: '加载中...' })
      
      // 调用后端接口获取该标签下的所有姿势
      const res = await get('/api/reference-image/list/group-by-tag')
      
      if (res.statusCode === 200 && res.data) {
        const responseData = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
        
        if (responseData.code === 200 && responseData.data) {
          const dataObj = responseData.data
          const allPoses = []
          
          // 遍历所有分组，找到匹配的 tag
          for (const [groupName, posesArray] of Object.entries(dataObj)) {
            if (Array.isArray(posesArray)) {
              posesArray.forEach(pose => {
                if (pose.tag === this.data.tag) {
                  allPoses.push({
                    id: pose.id,
                    url: pose.url,
                    createTime: pose.createTime
                  })
                }
              })
            }
          }
          
          this.setData({ poses: allPoses })
          console.log(`标签 "${this.data.tag}" 的姿势数据:`, allPoses)
        }
      }
      
      wx.hideLoading()
    } catch (error) {
      console.error('加载姿势数据失败:', error)
      wx.hideLoading()
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  // 关闭页面
  onClose() {
    wx.navigateBack()
  },

  // 姿势点击
  onPoseTap(e) {
    const pose = e.currentTarget.dataset.pose
    wx.navigateTo({
      url: `/pages/pose-detail/pose-detail?id=${pose.id}`
    })
  },

  // 使用按钮点击
  onUse(e) {
    const pose = e.currentTarget.dataset.pose
    
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
  }
})