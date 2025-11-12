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
    poseGroups: []
  },

  onLoad() {
    this.loadPoses()
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
          
          this.setData({ poseGroups })
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
    
    this.setData({ poseGroups })
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    })
  },

  // 搜索确认
  onSearch() {
    const keyword = this.data.searchKeyword.trim()
    if (!keyword) {
      wx.showToast({
        title: '请输入搜索关键词',
        icon: 'none'
      })
      return
    }

    // TODO: 调用搜索接口
    wx.showToast({
      title: `搜索: ${keyword}`,
      icon: 'none'
    })
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

  // 姿势点击
  onPoseTap(e) {
    const pose = e.currentTarget.dataset.pose
    wx.navigateTo({
      url: `/pages/pose-detail/pose-detail?id=${pose.id}&url=${encodeURIComponent(pose.url)}`
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
              url: '/pages/profile/index'
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
    //   url: `/pages/camera/index?poseId=${pose.id}`
    // })
  }
})