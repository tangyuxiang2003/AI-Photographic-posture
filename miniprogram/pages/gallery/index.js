const { get } = require('../../utils/request')
const authUtil = require('../../utils/auth')

Page({
  data: {
    // 搜索关键词
    searchKeyword: '',
    
    // 快捷搜索标签
    quickSearchTags: [],
    
    // 分类标签
    categoryTags: [
      { id: 1, name: '浪漫满屋' },
      { id: 2, name: '不露脸' },
      { id: 3, name: '情侣' },
      { id: 4, name: '闺蜜' },
      { id: 5, name: '自拍' },
      { id: 6, name: '鲜花' },
      { id: 7, name: '古灵精怪' },
      { id: 8, name: '创意照' },
      { id: 9, name: '超市' },
      { id: 10, name: '合照' }
    ],
    currentTagIndex: 0,
    
    // 姿势分组数据（动态从接口获取）
    poseGroups: [],
    
    // 原始姿势数据（用于搜索过滤）
    allPoseGroups: [],
    
    // 收藏状态映射 { url: true/false }
    favoriteMap: {},
    
    // 登录状态
    isLoggedIn: false,
    
    // 主题背景色
    themeBg: '#FFF7FA'
  },

  onLoad() {
    // 读取主题背景色
    try {
      const bg = wx.getStorageSync('theme_bg') || '#FFF7FA';
      this.setData({ themeBg: bg });
      this.applyThemeColor(bg);
    } catch (e) {}
    
    this.checkLoginStatus()
    this.loadPoses()
    this.loadFavorites()
  },

  onShow() {
    // 读取主题背景色
    try {
      const bg = wx.getStorageSync('theme_bg') || '#FFF7FA';
      if (bg !== this.data.themeBg) {
        this.setData({ themeBg: bg });
      }
      this.applyThemeColor(bg);
    } catch (e) {}
    
    // 每次显示页面时重新检查登录状态和收藏状态
    this.checkLoginStatus()
    this.loadFavorites()
  },

  // 检查登录状态
  checkLoginStatus() {
    const isLoggedIn = authUtil.isLoggedIn()
    this.setData({ isLoggedIn })
  },

  // 应用主题背景到导航栏、页面与底部tabBar
  applyThemeColor(backgroundColor) {
    const frontColor = this.getContrastingText(backgroundColor);
    try {
      wx.setNavigationBarColor({
        frontColor,
        backgroundColor,
        animation: { duration: 200, timingFunc: 'easeIn' }
      });
    } catch (e) {}
    // 同步 tabBar 背景
    try {
      wx.setTabBarStyle({
        backgroundColor,
        borderStyle: frontColor === '#ffffff' ? 'white' : 'black',
        color: frontColor === '#ffffff' ? '#e6e6e6' : '#666666',
        selectedColor: '#07C160'
      });
    } catch (e) {}
    try {
      wx.setBackgroundColor({
        backgroundColor,
        backgroundColorTop: backgroundColor,
        backgroundColorBottom: backgroundColor
      });
    } catch (e) {}
  },

  // 根据背景色计算对比文字颜色
  getContrastingText(bgColor) {
    if (!bgColor || bgColor === 'transparent') return '#000000';
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#ffffff';
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
      console.log('[gallery] 收藏状态已加载:', favoriteMap)
    } catch (error) {
      console.error('加载收藏状态失败:', error)
      this.setData({ favoriteMap: {} })
    }
  },

  // 加载姿势数据
  async loadPoses() {
    try {
      wx.showLoading({ title: '加载中...' })
      
      // 调用后端接口获取姿势分组数据
      const res = await get('/api/reference-image/list/group-by-tag')
      
      console.log('姿势分组接口返回:', res)
      
      if (res.statusCode === 200 && res.data) {
        const responseData = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
        
        if (responseData.code === 200 && responseData.data) {
          // data 是一个对象，每个 key 是分组名，value 是该分组的姿势数组
          const dataObj = responseData.data
          const poseGroups = []
          
          // 遍历所有分组
          for (const [groupName, posesArray] of Object.entries(dataObj)) {
            if (Array.isArray(posesArray) && posesArray.length > 0) {
              // 按 tag 分组（因为同一个 groupName 下可能有多个不同的 tag）
              const tagMap = {}
              posesArray.forEach(pose => {
                const tag = pose.tag || groupName
                if (!tagMap[tag]) {
                  tagMap[tag] = []
                }
                tagMap[tag].push({
                  id: pose.id,
                  url: pose.url,
                  createTime: pose.createTime
                })
              })
              
              // 将每个 tag 转换为一个分组，只取前2张
              for (const [tag, poses] of Object.entries(tagMap)) {
                poseGroups.push({
                  tag: tag,
                  poses: poses.slice(0, 2)
                })
              }
            }
          }
          
          this.setData({ 
            poseGroups,
            allPoseGroups: poseGroups // 保存原始数据用于搜索
          })
          // 提取快捷搜索标签
          this.extractQuickTags()
          console.log('姿势分组数据已加载:', poseGroups)
        } else {
          throw new Error(responseData.msg || '数据格式错误')
        }
      } else {
        throw new Error('接口请求失败')
      }
      
      wx.hideLoading()
    } catch (error) {
      console.error('加载姿势数据失败:', error)
      wx.hideLoading()
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      })
      
      // 失败时使用模拟数据
      this.loadMockData()
    }
  },

  // 加载模拟数据（作为降级方案）
  loadMockData() {
    const sampleImages = [
      '/images/ai_example1.png',
      '/images/ai_example2.png'
    ]
    
    const poseGroups = [
      {
        tag: '咖啡厅',
        poses: [
          { id: 1, url: sampleImages[0], createTime: '2025-11-12' },
          { id: 2, url: sampleImages[1], createTime: '2025-11-12' }
        ]
      },
      {
        tag: '闺蜜照',
        poses: [
          { id: 3, url: sampleImages[0], createTime: '2025-11-12' },
          { id: 4, url: sampleImages[1], createTime: '2025-11-12' }
        ]
      }
    ]
    
    this.setData({ 
      poseGroups,
      allPoseGroups: poseGroups // 保存原始数据用于搜索
    })
    // 提取快捷搜索标签
    this.extractQuickTags()
  },

  // 提取快捷搜索标签
  extractQuickTags() {
    const tags = new Set()
    this.data.allPoseGroups.forEach(group => {
      if (group.tag) {
        tags.add(group.tag)
      }
    })
    this.setData({
      quickSearchTags: Array.from(tags).slice(0, 10) // 最多显示10个
    })
    console.log('快捷搜索标签已提取:', this.data.quickSearchTags)
  },

  // 搜索输入
  onSearchInput(e) {
    const keyword = e.detail.value
    this.setData({
      searchKeyword: keyword
    })
    
    // 实时搜索
    this.performSearch(keyword)
  },

  // 搜索确认
  onSearch() {
    const keyword = this.data.searchKeyword.trim()
    this.performSearch(keyword)
  },

  // 执行模糊搜索
  performSearch(keyword) {
    const trimmedKeyword = keyword.trim()
    
    // 如果搜索关键词为空，显示所有数据
    if (!trimmedKeyword) {
      this.setData({
        poseGroups: this.data.allPoseGroups
      })
      return
    }

    // 将搜索关键词按空格分割成多个关键词
    const keywords = trimmedKeyword.toLowerCase().split(/\s+/).filter(k => k)
    
    // 过滤姿势分组
    const filteredGroups = this.data.allPoseGroups.filter(group => {
      const tagLower = group.tag.toLowerCase()
      
      // 检查是否所有关键词都匹配（支持模糊匹配）
      return keywords.every(kw => tagLower.includes(kw))
    })

    this.setData({
      poseGroups: filteredGroups
    })

    // 如果没有搜索结果，显示提示
    if (filteredGroups.length === 0) {
      wx.showToast({
        title: '未找到相关姿势',
        icon: 'none',
        duration: 1500
      })
    }
  },

  // 快捷标签点击
  onQuickTagTap(e) {
    const tag = e.currentTarget.dataset.tag
    this.setData({
      searchKeyword: tag
    })
    this.performSearch(tag)
    console.log('点击快捷标签:', tag)
  },

  // 标签点击
  onTagTap(e) {
    const index = e.currentTarget.dataset.index
    this.setData({
      currentTagIndex: index
    })
    
    // TODO: 根据标签筛选姿势
    const tag = this.data.categoryTags[index]
    console.log('选中标签:', tag)
  },

  // 查看全部
  onViewAll(e) {
    const tag = e.currentTarget.dataset.tag
    wx.navigateTo({
      url: `/pages/category-detail/category-detail?tag=${encodeURIComponent(tag)}`
    })
  },

  // 姿势点击 - 预览图片
  onPoseTap(e) {
    const pose = e.currentTarget.dataset.pose
    const group = e.currentTarget.dataset.group
    
    // 获取当前分组的所有图片URL
    const urls = group && group.poses ? group.poses.map(p => p.url) : [pose.url]
    
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
    const group = e.currentTarget.dataset.group
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
          
          console.log('[gallery] 收藏响应:', response)
          
          // 解析响应
          let responseData = response?.data
          if (typeof responseData === 'string') {
            try { responseData = JSON.parse(responseData) } catch(e) {}
          }
          
          wx.hideLoading()
          
          // 检查是否是重复收藏
          if (responseData?.code === 400 || responseData?.msg?.includes('已收藏') || responseData?.msg?.includes('已存在')) {
            wx.showToast({
              title: '此照片已在收藏列表中',
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