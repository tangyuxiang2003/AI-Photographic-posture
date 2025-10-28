Page({
  data: {
    images: [],
    favSet: {}, // 以 cover/src 为键，true 表示已收藏
    progress: 0,
    generating: true
  },

  onLoad() {
    this.refreshResults()
    this.startProgressLoop()
  },

  onToggleFav(e) {
    const src = e.currentTarget.dataset.src
    if (!src) return
    let fav = []
    try {
      fav = wx.getStorageSync('app_favorites') || []
      if (!Array.isArray(fav)) fav = []
    } catch (e1) { fav = [] }

    const isFav = !!this.data.favSet[src]
    if (isFav) {
      // 取消：按 cover 匹配删除
      const nextFav = fav.filter(it => it.cover !== src)
      try { wx.setStorageSync('app_favorites', nextFav) } catch (e2) {}
      this.setData({ favSet: { ...this.data.favSet, [src]: false } })
      wx.showToast({ title: '已取消收藏', icon: 'none' })
    } else {
      // 新增：构造与收藏页一致结构
      const title = this.inferTitleFromSrc(src)
      const item = {
        id: src, // 使用图片路径保证唯一性
        title,
        cover: src,
        tags: [],
        type: '分析'
      }
      const nextFav = fav.concat(item)
      try { wx.setStorageSync('app_favorites', nextFav) } catch (e3) {}
      this.setData({ favSet: { ...this.data.favSet, [src]: true } })
      wx.showToast({ title: '已加入收藏', icon: 'none' })
    }
  },

  onShow() {
    // 回到页面时尝试刷新工作流结果
    this.refreshResults()
    if (this.data.generating) this.startProgressLoop()
  },

  onHide() { this.stopProgressLoop() },
  onUnload() { this.stopProgressLoop() },

  startProgressLoop() {
    this.stopProgressLoop()
    this._progressTimer = setInterval(() => {
      let p = this.data.progress
      // 优先读取工作流写入的进度 0-100
      try {
        const v = wx.getStorageSync('workflow_progress')
        if (typeof v === 'number' && v >= 0 && v <= 100) p = v
      } catch (e) {}
      // 无外部进度时，缓慢自增到 95%
      if (this.data.generating && p < 95) p = Math.min(95, p + 1)
      this.setData({ progress: p })
      this.checkIfDone()
    }, 500)
  },

  stopProgressLoop() {
    if (this._progressTimer) {
      clearInterval(this._progressTimer)
      this._progressTimer = null
    }
  },

  checkIfDone() {
    let imgs = []
    try {
      imgs = wx.getStorageSync('workflow_results') || []
      if (!Array.isArray(imgs)) imgs = []
    } catch (e) { imgs = [] }
    if (imgs.length) {
      // 已有结果，结束进度并展示
      this.stopProgressLoop()
      this.setData({ images: imgs, generating: false, progress: 100 })
    }
  },

  refreshResults() {
    let imgs = []
    try {
      imgs = wx.getStorageSync('workflow_results') || []
      if (!Array.isArray(imgs)) imgs = []
    } catch (e) { imgs = [] }

    // 读取收藏，建立快速查找集合（按 cover 匹配）
    let fav = []
    try {
      fav = wx.getStorageSync('app_favorites') || []
      if (!Array.isArray(fav)) fav = []
    } catch (e) { fav = [] }
    const favSet = {}
    fav.forEach(it => { if (it && it.cover) favSet[it.cover] = true })

    const generating = imgs.length === 0
    this.setData({ images: imgs, favSet, generating })
  },



  inferTitleFromSrc(src = '') {
    try {
      const m = src.split(/[\/\\]/).pop() || ''
      return m ? ('分析图 - ' + m) : '分析图'
    } catch (e) {
      return '分析图'
    }
  }
})