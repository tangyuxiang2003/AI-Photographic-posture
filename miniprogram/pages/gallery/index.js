const { get } = require('../../utils/request')
const authUtil = require('../../utils/auth')

Page({
  data: {
    // 搜索关键词
    searchKeyword: '',
    
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
    isLoggedIn: false
  },

  onLoad() {
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
          localPath: pose.url, // 传递姿势图片URL作为参考
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
    const group = e.currentTarget.dataset.group
    
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
          title: group ? group.tag : '参考姿势',
          cover: pose.url,
          tags: group ? [group.tag] : [],
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
            title: group ? group.tag : '参考姿势',
            tag: group ? group.tag : '',
            type: 'Reference',
            userId
          })
          
          console.log('[gallery] 收藏响应:', response)
          
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