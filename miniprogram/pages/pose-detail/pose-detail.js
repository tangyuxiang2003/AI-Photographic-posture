const authUtil = require('../../utils/auth')

Page({
  data: {
    poseId: '',
    poseUrl: '',
    pose: {},
    isFavorite: false,
    isLoggedIn: false
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
    
    // 检查登录状态
    this.checkLoginStatus()
    // 加载收藏状态
    this.loadFavoriteStatus()
  },

  onShow() {
    // 每次显示时重新检查登录状态和收藏状态
    this.checkLoginStatus()
    this.loadFavoriteStatus()
  },

  // 检查登录状态
  checkLoginStatus() {
    const isLoggedIn = authUtil.isLoggedIn()
    this.setData({ isLoggedIn })
  },

  // 加载收藏状态
  loadFavoriteStatus() {
    try {
      // 从本地收藏列表中加载
      const localFavorites = wx.getStorageSync('local_favorites') || []
      const isFavorite = localFavorites.some(item => {
        const url = typeof item === 'string' ? item : item.cover
        return url === this.data.poseUrl
      })
      this.setData({ isFavorite })
    } catch (error) {
      console.error('加载收藏状态失败:', error)
    }
  },

  // 关闭页面
  onClose() {
    wx.navigateBack()
  },

  // 使用姿势 - 跳转到自定义功能拍摄界面
  onUse() {
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
          localPath: this.data.pose.url,
          desc: `参考姿势 ${this.data.pose.id}`,
          textOnly: false
        })
      }
    })
  },

  // 切换收藏状态
  async onToggleFavorite() {
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
    
    try {
      // 使用新的本地收藏列表（支持完整数据结构）
      let localFavorites = wx.getStorageSync('local_favorites') || []
      
      // 查找是否已收藏
      const index = localFavorites.findIndex(item => {
        const url = typeof item === 'string' ? item : item.cover
        return url === this.data.poseUrl
      })
      
      if (index > -1) {
        // 已收藏，取消收藏
        const favoriteItem = localFavorites[index]
        localFavorites.splice(index, 1)
        this.setData({ isFavorite: false })
        
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
          id: `local_${Date.now()}_${this.data.poseId}`, // 本地收藏ID
          aiImageId: this.data.poseId, // 姿势ID
          title: this.data.pose.name || '参考姿势',
          cover: this.data.poseUrl,
          tags: [],
          type: 'Reference', // 参考图类型
          collectTime: new Date().toISOString()
        }
        
        localFavorites.push(favoriteItem)
        this.setData({ isFavorite: true })
        
        // 调用后端接口保存收藏
        try {
          wx.showLoading({ title: '收藏中...', mask: true })
          const { post } = require('../../utils/request')
          const { getAuth } = require('../../utils/storage')
          const auth = getAuth() || {}
          const userId = auth.userId
          
          const response = await post('/api/collection/add', {
            aiImageId: this.data.poseId,
            aiImageUrl: this.data.poseUrl,
            title: this.data.pose.name || '参考姿势',
            tag: '',
            type: 'Reference',
            userId
          })
          
          console.log('[pose-detail] 收藏响应:', response)
          
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
          // 收藏失败时从本地列表中移除并恢复状态
          localFavorites.pop()
          this.setData({ isFavorite: false })
        }
      }
      
      // 保存到本地存储
      wx.setStorageSync('local_favorites', localFavorites)
    } catch (error) {
      console.error('收藏操作失败:', error)
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    }
  }
})