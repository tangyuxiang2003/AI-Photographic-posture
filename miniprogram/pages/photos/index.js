Page({
  data: {
    query: '',
    activeTab: '全部',
    favorites: [
      {
        id: 'p1',
        title: '韩系咖啡店回眸',
        cover: '../../images/ai_example1.png',
        tags: ['韩系','咖啡店','回眸'],
        type: '场景'
      },
      {
        id: 'p2',
        title: '法式花墙托腮',
        cover: '../../images/ai_example2.png',
        tags: ['法式','花墙','托腮'],
        type: '风格'
      },
      {
        id: 'p3',
        title: '公园坐姿显腿长',
        cover: '../../images/default-goods-image.png',
        tags: ['公园','坐姿','显腿长'],
        type: '姿势'
      },
      {
        id: 'p4',
        title: '通勤极简抱臂',
        cover: '../../images/create_env.png',
        tags: ['通勤','极简','抱臂'],
        type: '风格'
      },
      {
        id: 'p5',
        title: '海边逆光拨发',
        cover: '../../images/scf-enter.png',
        tags: ['海边','逆光','拨发'],
        type: '场景'
      },
      {
        id: 'p6',
        title: '书店通道回眸',
        cover: '../../images/database.png',
        tags: ['书店','回眸','抓拍'],
        type: '场景'
      }
    ],
    filtered: []
  },

  onLoad(){
    this.computeFiltered()
  },

  onSetTab(e){
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab }, this.computeFiltered)
  },

  onSearchInput(e){
    this.setData({ query: e.detail.value }, this.computeFiltered)
  },

  onClearSearch(){
    this.setData({ query: '' }, this.computeFiltered)
  },

  computeFiltered(){
    const { favorites, activeTab, query } = this.data
    const q = (query || '').trim().toLowerCase()
    const list = favorites.filter(it => {
      const okTab = activeTab === '全部' ? true : (it.type === activeTab || it.tags.includes(activeTab))
      const text = (it.title + ' ' + it.tags.join(' ')).toLowerCase()
      const okQuery = q ? text.includes(q) : true
      return okTab && okQuery
    })
    this.setData({ filtered: list })
  },

  onToggleFavorite(e){
    const id = e.currentTarget.dataset.id
    const next = this.data.favorites.filter(it => it.id !== id)
    this.setData({ favorites: next }, this.computeFiltered)
    wx.showToast({ title: '已取消收藏', icon: 'none' })
  },

  onShare(e){
    const id = e.currentTarget.dataset.id
    const item = this.data.favorites.find(x => x.id === id)
    wx.showToast({ title: '已分享：' + (item?.title || ''), icon: 'none' })
    // 可在此接入转发/生成海报等
  },

  onShuffle(){
    const arr = [...this.data.favorites]
    arr.sort(() => 0.5 - Math.random())
    this.setData({ favorites: arr }, this.computeFiltered)
    wx.showToast({ title: '已为你推荐新顺序', icon: 'none' })
  }
})