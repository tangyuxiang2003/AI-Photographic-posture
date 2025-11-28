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
    isLoggedIn: false,
    themeBg: '#FFF7FA',
    btnTextColor: '#000000'
  },

  onLoad(options) {
    // 同步主题背景
    try {
      const bg = wx.getStorageSync('theme_bg') || '#FFF7FA';
      const textColor = this.getContrastingText(bg);
      this.setData({ themeBg: bg, btnTextColor: textColor });
    } catch (e) {}

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
    // 同步主题背景
    try {
      const bg = wx.getStorageSync('theme_bg') || '#FFF7FA';
      const textColor = this.getContrastingText(bg);
      this.setData({ themeBg: bg, btnTextColor: textColor });
    } catch (e) {}

    // 每次显示页面时重新检查登录状态和收藏状态
    this.checkLoginStatus()
    this.loadFavorites()
  },

  // 根据背景色自动选择黑/白前景色
  getContrastingText(hex) {
    const norm = (h) => {
      if (!h) return '#000000';
      let s = h.toString().trim();
      if (s[0] !== '#') s = '#' + s;
      if (s.length === 4) {
        const r = s[1], g = s[2], b = s[3];
        s = '#' + r + r + g + g + b + b;
      }
      return s.slice(0, 7);
    };
    const c = norm(hex);
    const r = parseInt(c.substr(1, 2), 16);
    const g = parseInt(c.substr(3, 2), 16);
    const b = parseInt(c.substr(5, 2), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 160 ? '#000000' : '#ffffff';
  },

  // 检查登录状态
  checkLoginStatus() {
    const isLoggedIn = authUtil.isLoggedIn()
    this.setData({ isLoggedIn })
  },

  // 加载收藏状态（从服务器获取）
  async loadFavorites() {
    try {
      const authUtil = require('../../utils/auth')
      if (!authUtil.isLoggedIn()) {
        this.setData({ favoriteMap: {} })
        return
      }

      const { get } = require('../../utils/request')
      const { getAuth } = require('../../utils/storage')
      const auth = getAuth() || {}
      const userId = auth.userId

      if (!userId) {
        this.setData({ favoriteMap: {} })
        return
      }

      // 调用后端接口获取收藏列表
      const resp = await get('/api/collection/list', { userId })
      
      let responseData = resp?.data
      if (typeof responseData === 'string') {
        try { responseData = JSON.parse(responseData) } catch(e) {}
      }
      
      const items = responseData?.data || []
      const favoriteMap = {}
      
      // 遍历收藏列表,建立 referenceImageId -> true 的映射
      items.forEach(item => {
        if (item.referenceImageId) {
          // 参考图收藏,使用 referenceImageId 作为 key
          favoriteMap[item.referenceImageId] = true
        }
      })
      
      this.setData({ favoriteMap })
      console.log('[category-detail] 收藏状态已加载:', favoriteMap)
    } catch (error) {
      console.error('加载收藏状态失败:', error)
      this.setData({ favoriteMap: {} })
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

  // 使用按钮点击 - 直接跳转到相机拍摄界面
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

    // 直接跳转到相机拍摄界面,传递参考图片
    wx.navigateTo({
      url: `/pages/camera/index?referenceImage=${encodeURIComponent(pose.url)}&source=reference`
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
    const referenceImageId = pose.id
    
    try {
      const { post } = require('../../utils/request')
      const { getAuth } = require('../../utils/storage')
      const auth = getAuth() || {}
      const userId = auth.userId
      
      // 检查是否已收藏
      const isFavorited = this.data.favoriteMap[referenceImageId]
      
      if (isFavorited) {
        // 已收藏，取消收藏
        wx.showLoading({ title: '取消中...', mask: true })
        
        try {
          await post('/api/collection/remove', { 
            id: referenceImageId,
            userId 
          })
          
          wx.hideLoading()
          wx.showToast({
            title: '已取消收藏',
            icon: 'success',
            duration: 1500
          })
          
          // 更新收藏状态
          await this.loadFavorites()
        } catch (err) {
          console.error('取消收藏失败:', err)
          wx.hideLoading()
          wx.showToast({
            title: '取消失败，请稍后重试',
            icon: 'none',
            duration: 2000
          })
        }
      } else {
        // 未收藏，添加收藏
        wx.showLoading({ title: '收藏中...', mask: true })
        
        try {
          const response = await post('/api/collection/addByReferenceImageId', {
            referenceImageId: referenceImageId,
            userId
          })
          
          console.log('[category-detail] 收藏响应:', response)
          
          // 解析响应
          let responseData = response?.data
          if (typeof responseData === 'string') {
            try { responseData = JSON.parse(responseData) } catch(e) {}
          }
          
          wx.hideLoading()
          
          // 检查是否是重复收藏
          if (responseData?.code === 400 || responseData?.msg?.includes('已收藏') || responseData?.msg?.includes('已存在')) {
            wx.showToast({
              title: '此图已在收藏列表',
              icon: 'none',
              duration: 2000
            })
            // 更新收藏状态，确保爱心显示正确
            await this.loadFavorites()
          } else if (responseData?.code === 200) {
            wx.showToast({
              title: '收藏成功',
              icon: 'success',
              duration: 1500
            })
            // 更新收藏状态
            await this.loadFavorites()
          } else {
            throw new Error(responseData?.msg || '收藏失败')
          }
        } catch (err) {
          console.error('收藏失败:', err)
          wx.hideLoading()
          
          // 统一提示：此图已在收藏列表
          wx.showToast({
            title: '此图已在收藏列表',
            icon: 'none',
            duration: 2000
          })
          // 更新收藏状态，确保爱心显示正确
          await this.loadFavorites()
        }
      }
    } catch (error) {
      console.error('收藏操作失败:', error)
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    }
  }
})