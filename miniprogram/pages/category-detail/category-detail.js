const { get } = require('../../utils/request')
const authUtil = require('../../utils/auth')

Page({
  data: {
    tag: '',
    categoryName: '',
    poses: [],
    statusBarHeight: 0,
    menuButtonHeight: 0,
    headerHeight: 0,
    favoriteMap: {},
    isLoggedIn: false
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
    
    this.checkLoginStatus()
    this.loadPoses()
    this.loadFavorites()
  },

  onShow() {
    // 每次显示页面时重新检查登录状态和收藏状态
    this.checkLoginStatus()
    this.loadFavorites()
  },

  // 检查登录状态
  checkLoginStatus() {
    const isLoggedIn = authUtil.isLoggedIn()
    this.setData({ isLoggedIn })
  },

  // 加载收藏状态
  loadFavorites() {
    try {
      // 从本地收藏列表中加载（支持完整数据结构）
      const localFavorites = wx.getStorageSync('local_favorites') || []
      const favoriteMap = {}
      localFavorites.forEach(item => {
        // 兼容旧格式（纯URL）和新格式（对象）
        const url = typeof item === 'string' ? item : item.cover
        if (url) {
          favoriteMap[url] = true
        }
      })
      this.setData({ favoriteMap })
    } catch (error) {
      console.error('加载收藏状态失败:', error)
    }
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

  // 姿势点击 - 预览图片
  onPoseTap(e) {
    const pose = e.currentTarget.dataset.pose
    
    // 获取当前分类的所有图片URL
    const urls = this.data.poses.map(p => p.url)
    
    wx.previewImage({
      current: pose.url,
      urls: urls
    })
  },

  // 使用按钮点击 - 跳转到自定义功能拍摄界面
  onUse(e) {
    const pose = e.currentTarget.dataset.pose
    
    // 检查登录状态
    if (!authUtil.isLoggedIn()) {
      wx.showModal({
        title: '需要授权登录',
        content: '使用拍照功能需要先授权登录，是否前往授权？',
        confirmText: '去授权',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            // 跳转到个人中心进行授权
            wx.switchTab({
              url: '/pages/profile/index'
            })
          }
        }
      })
      return
    }

    // 跳转到自定义功能拍摄界面（analyze页面）
    wx.navigateTo({
      url: '/pages/analyze/index',
      success: (res) => {
        // 通过 eventChannel 传递姿势参考图
        res.eventChannel.emit('startAnalyzePayload', {
          localPath: pose.url,
          desc: `参考姿势 ${pose.id}`,
          textOnly: false
        })
      }
    })
  },

  // 切换收藏状态
  async onToggleFavorite(e) {
    // 检查登录状态
    if (!authUtil.isLoggedIn()) {
      wx.showModal({
        title: '需要授权登录',
        content: '收藏功能需要先授权登录，是否前往授权？',
        confirmText: '去授权',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({
              url: '/pages/profile/index'
            })
          }
        }
      })
      return
    }

    const pose = e.currentTarget.dataset.pose
    
    try {
      // 使用新的本地收藏列表（支持完整数据结构）
      let localFavorites = wx.getStorageSync('local_favorites') || []
      
      // 查找是否已收藏
      const index = localFavorites.findIndex(item => {
        const url = typeof item === 'string' ? item : item.cover
        return url === pose.url
      })
      
      if (index > -1) {
        // 已收藏，取消收藏
        const favoriteItem = localFavorites[index]
        localFavorites.splice(index, 1)
        
        // 调用后端删除接口
        if (favoriteItem.aiImageId) {
          try {
            wx.showLoading({ title: '删除中...', mask: true })
            const { post } = require('../../utils/request')
            const { getAuth } = require('../../utils/storage')
            const auth = getAuth() || {}
            const userId = auth.userId
            
            await post('/api/collection/remove', { 
              aiImageId: favoriteItem.aiImageId,
              userId 
            })
            wx.hideLoading()
          } catch (err) {
            console.error('后端删除收藏失败:', err)
            wx.hideLoading()
          }
        }
        
        wx.showToast({
          title: '已取消收藏',
          icon: 'success',
          duration: 1500
        })
      } else {
        // 未收藏，添加收藏（保存完整数据结构）
        const favoriteItem = {
          id: `local_${Date.now()}_${pose.id}`, // 本地收藏ID
          aiImageId: pose.id, // 姿势ID
          title: this.data.categoryName || '参考姿势',
          cover: pose.url,
          tags: this.data.categoryName ? [this.data.categoryName] : [],
          type: 'Reference', // 参考图类型
          collectTime: new Date().toISOString()
        }
        
        localFavorites.push(favoriteItem)
        
        // 调用后端接口保存收藏
        try {
          wx.showLoading({ title: '收藏中...', mask: true })
          const { post } = require('../../utils/request')
          const { getAuth } = require('../../utils/storage')
          const auth = getAuth() || {}
          const userId = auth.userId
          
          const response = await post('/api/collection/add', {
            aiImageId: pose.id,
            aiImageUrl: pose.url,
            title: this.data.categoryName || '参考姿势',
            tag: this.data.categoryName || '',
            type: 'Reference',
            userId
          })
          
          console.log('[category-detail] 收藏响应:', response)
          
          // 解析响应获取后端返回的收藏ID
          let responseData = response?.data
          if (typeof responseData === 'string') {
            try { responseData = JSON.parse(responseData) } catch(e) {}
          }
          
          // 更新本地收藏项的ID为后端返回的ID
          if (responseData?.data?.id) {
            favoriteItem.id = responseData.data.id
            localFavorites[localFavorites.length - 1] = favoriteItem
          }
          
          wx.hideLoading()
          wx.showToast({
            title: '收藏成功',
            icon: 'success',
            duration: 1500
          })
        } catch (err) {
          console.error('后端收藏失败:', err)
          wx.hideLoading()
          wx.showToast({
            title: '收藏失败，请稍后重试',
            icon: 'none',
            duration: 2000
          })
          // 收藏失败时从本地列表中移除
          localFavorites.pop()
        }
      }
      
      // 保存到本地存储
      wx.setStorageSync('local_favorites', localFavorites)
      
      // 更新收藏状态
      this.loadFavorites()
    } catch (error) {
      console.error('收藏操作失败:', error)
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    }
  }
})