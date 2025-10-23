Page({
  data: {
    expectDesc: '',
    previewPaths: [],
    // 选择模式
    selectMode: false,
    selectedSet: {},
    selectedCount: 0,
    // 热门关键词与句子
    hotChips: [
      '甜美笑容','回眸侧拍','手捧花束','坐姿俏皮','自然走拍','咖啡店',
      '元气校园','韩系氛围','法式优雅','温柔通勤','公主风','森系小清新'
    ],
    tipsItems: [
      '面向窗边自然光，侧身45°露锁骨更显温柔。',
      '肩颈放松，微微抬下巴更显自信气质。',
      '拿一束小花靠近脸颊，营造甜美氛围。',
      '双手抱臂微笑，干净背景更显通勤质感。',
      '坐在台阶上交叉小腿，镜头略俯拍显腿长。'
    ],
    // 个人中心：基础档案
    profile: {
      avatarUrl: '',
      nickName: '点击登录',
      hasAuth: false,
      level: 1,
      vip: false,
      progressPct: 0
    },
    // 个人中心：统计信息
    stats: {
      photos: 0,
      favorites: 0,
      following: 0
    },
    // 个人中心：设置项
    settings: {
      saveHD: true,
      showTips: true,
      allowCellular: false
    },
    // 个人中心：功能菜单（可在 WXML 循环渲染）
    actionList: [
      { key: 'favorites', icon: 'star', text: '我的收藏', url: '/pages/photos/index?tab=fav' },
      { key: 'history', icon: 'time', text: '浏览历史', url: '/pages/photos/index?tab=history' },
      { key: 'account', icon: 'user', text: '账号与安全', url: '/pages/profile/index?tab=account' },
      { key: 'settings', icon: 'setting', text: '设置中心', url: '/pages/profile/index?tab=settings' },
      { key: 'feedback', icon: 'message', text: '反馈与帮助', url: '/pages/example/index?tab=feedback' },
      { key: 'about', icon: 'info', text: '关于', url: '/pages/example/index?tab=about' }
    ],
    // 功能角标与图标映射（如无匹配图标将回退到问号）
    actionBadges: {},
    actionIconMap: {
      favorites: '/miniprogram/images/icons/goods.png',
      history: '/miniprogram/images/icons/examples.png',
      account: '/miniprogram/images/icons/usercenter.png',
      settings: '/miniprogram/images/icons/setting.svg',
      feedback: '/miniprogram/images/icons/customer-service.svg',
      about: '/miniprogram/images/icons/question.svg'
    }
  },

  onTapUpload() {
    wx.showActionSheet({
      itemList: ['相册', '拍摄'],
      success: (res) => {
        const index = res.tapIndex
        const isAlbum = index === 0
        const MAX_KEEP = 12
        if (isAlbum) {
          // 相册：使用 chooseImage 支持一次多选
          wx.chooseImage({
            count: 9,
            sizeType: ['compressed'],
            sourceType: ['album'],
            success: (resp) => {
              const added = (resp.tempFilePaths || []).map(p => ({ src: p, selected: false }))
              const prev = this.normalize(this.data.previewPaths)
              const next = prev.concat(added).slice(0, MAX_KEEP)
              this.setData({
                previewPaths: next,
                selectMode: false,
                selectedSet: {},
                selectedCount: this.countSelected(next)
              })
            }
          })
        } else {
          // 拍摄：仍用 chooseMedia（通常单张）
          wx.chooseMedia({
            count: 1,
            mediaType: ['image'],
            sourceType: ['camera'],
            sizeType: ['compressed'],
            success: (resp) => {
              const added = (resp.tempFiles || []).map(f => ({ src: f.tempFilePath, selected: false }))
              const prev = this.normalize(this.data.previewPaths)
              const next = prev.concat(added).slice(0, MAX_KEEP)
              this.setData({
                previewPaths: next,
                selectMode: false,
                selectedSet: {},
                selectedCount: this.countSelected(next)
              })
            }
          })
        }
      }
    })
  },

  onDescInput(e) {
    this.setData({ expectDesc: e.detail.value })
  },

  // 点击热门词，同步到描述框（追加，且用空格分隔）
  onTapChip(e){
    const word = e.currentTarget.dataset.word || ''
    const prev = this.data.expectDesc?.trim()
    const next = prev ? (prev + ' ' + word) : word
    this.setData({ expectDesc: next })
  },

  // 刷新热门词
  onRefreshChips(){
    const pool = [
      // 风格
      '法式优雅','公主风','森系清新','甜酷混搭','通勤极简','复古胶片','港风氛围','韩系氛围','元气校园','度假海边',
      // 场景
      '咖啡店','书店一角','落地窗旁','花墙前','天台栏杆','街头斑马线','公园草地','海边礁石','老城区巷口','地铁站口',
      // 姿势
      '回头微笑','贴墙侧身','抱臂俏皮','托腮凝视','捧脸甜笑','撩发侧目','露齿微笑','躺拍顶视','坐姿显腿长','跨步走拍',
      '单手插兜','捏衣领','捧花入镜','拿书遮脸','手持咖啡','转身回望','跳步抓拍','歪头wink','手比爱心','抱膝而坐'
    ]
    const shuffled = pool.sort(() => 0.5 - Math.random())
    this.setData({ hotChips: shuffled.slice(0, 6) })
  },

  // 工具：将预览列表规范为对象数组 [{src, selected}]
  normalize(list){
    return (list || []).map(it => {
      if (typeof it === 'string') return { src: it, selected: false }
      if (it && typeof it === 'object') return { src: it.src || it.tempFilePath || '', selected: !!it.selected }
      return { src: String(it || ''), selected: false }
    })
  },
  countSelected(list){
    return (list || []).reduce((n, it) => n + (it.selected ? 1 : 0), 0)
  },

  // 选择相关
  isSelected(idx){
    return !!this.data.selectedSet[idx]
  },
  onLongPressThumb(e){
    const idx = e.currentTarget.dataset.index
    const list = this.normalize(this.data.previewPaths)
    if (list[idx]) list[idx].selected = true
    // 进入选择模式并选中当前
    this.setData({ selectMode: true, previewPaths: list, selectedCount: this.countSelected(list) })
    // 仅抑制紧随其后的“下一次 tap”
    this._suppressNextTap = true
  },
  onTapThumb(e){
    const idx = e.currentTarget.dataset.index
    // 若刚发生长按，屏蔽紧随其后的这一次 tap
    if (this._suppressNextTap) {
      this._suppressNextTap = false
      return
    }
    // 未在选择模式：预览大图
    if(!this.data.selectMode){
      const list = this.normalize(this.data.previewPaths)
      const urls = list.map(it => it.src)
      if(!urls.length) return
      wx.previewImage({ current: urls[idx], urls })
      return
    }
    // 选择模式：切换勾选（基于对象数组）
    const list = this.normalize(this.data.previewPaths)
    const it = list[idx]
    if (it) it.selected = !it.selected
    this.setData({ previewPaths: list, selectedCount: this.countSelected(list) })
  },
  onExitSelect(){
    const list = this.normalize(this.data.previewPaths).map(it => ({ ...it, selected: false }))
    this.setData({ selectMode: false, previewPaths: list, selectedSet: {}, selectedCount: 0 })
  },
  onDeleteSelected(){
    const list = this.normalize(this.data.previewPaths)
    const next = list.filter(it => !it.selected)
    this.setData({ previewPaths: next, selectMode: false, selectedSet: {}, selectedCount: 0 })
    wx.showToast({ title: '已删除选中照片', icon: 'none' })
  },

  // 刷新姿势句子
  onRefreshTips(){
    const pool = [
      // 光线与角度
      '面对窗边柔光，侧身45°露锁骨与下颌线更显温柔。',
      '顺光微笑、逆光撩发，两种氛围各拍几张更耐看。',
      '镜头略高俯拍，头顶留白能弱化颧骨显脸小。',
      // 姿势灵感
      '把重心放在一条腿上，另一条自然弯曲更显灵动。',
      '单手插兜、另一手拎包，走两步制造自然摆动感。',
      '坐在台阶上双手抱膝，脚尖内扣更显俏皮比例。',
      '靠墙侧身，肩膀向镜头，回眸浅笑更显氛围。',
      '双手捧花靠近脸颊，闭眼嗅花增强画面故事感。',
      '拿书挡半张脸，只露眼睛看镜头，增加神秘感。',
      // 场景动作
      '咖啡店窗边对着窗外发呆，手心托腮更显温柔。',
      '书店通道回眸，身后书架形成纵深感与层次。',
      '公园草地坐姿，双腿侧放，身体微向前倾更显比例。',
      '海边逆光拨发，裙摆随风，注意连拍捕捉状态感。',
      '天台栏杆处远望，身体靠栏，注意安全与地平线平衡。',
      // 小技巧
      '嘴角上扬但不过度，眼神聚焦镜头上方更显自然。',
      '道具在手不离线：花/书/咖啡随动作移动保持自然。',
      '按三分法构图，人偏一侧，给画面留出呼吸空间。'
    ]
    const shuffled = pool.sort(() => 0.5 - Math.random())
    this.setData({ tipsItems: shuffled.slice(0, 3) })
  },

  onAnalyze() {
    wx.showToast({
      title: '原型：开始分析',
      icon: 'none'
    })
  },

  // 生命周期：进入页面初始化个人中心数据
  onLoad() {
    // 读取本地设置
    try {
      const saved = wx.getStorageSync('app_settings')
      if (saved && typeof saved === 'object') {
        this.setData({ settings: { ...this.data.settings, ...saved } })
      }
    } catch (e) {}
    // 刷新统计
    this.updateStatsFromLocal()
  },
  onShow() {
    // 页面可见时刷新统计，确保与相册操作保持同步
    this.updateStatsFromLocal()
  },

  // 统计刷新：根据当前列表与本地缓存估算统计
  updateStatsFromLocal() {
    const photos = (this.data.previewPaths || []).length
    let favorites = 0
    let following = 0
    try {
      const fav = wx.getStorageSync('app_favorites') || []
      const follow = wx.getStorageSync('app_following') || []
      favorites = Array.isArray(fav) ? fav.length : 0
      following = Array.isArray(follow) ? follow.length : 0
    } catch (e) {}
    const levelInfo = this.computeLevel(photos)
    this.setData({
      stats: { ...this.data.stats, photos, favorites, following },
      profile: { ...this.data.profile, ...levelInfo },
      actionBadges: {
        favorites: favorites > 0 ? favorites : '',
        history: '',
        account: '',
        settings: '',
        feedback: '',
        about: ''
      }
    })
  },

  // 获取头像昵称授权
  onGetUserProfile() {
    if (this.data.profile.hasAuth) return
    if (wx.getUserProfile) {
      wx.getUserProfile({
        desc: '用于完善个人资料与头像展示',
        success: (res) => {
          const { userInfo } = res || {}
          this.setData({
            profile: {
              avatarUrl: userInfo?.avatarUrl || '',
              nickName: userInfo?.nickName || '已登录',
              hasAuth: true
            }
          })
          wx.showToast({ title: '登录成功', icon: 'success' })
        },
        fail: () => {
          wx.showToast({ title: '用户取消授权', icon: 'none' })
        }
      })
    } else {
      wx.showToast({ title: '基础库过低，无法获取头像昵称', icon: 'none' })
    }
  },

  // 菜单跳转
  onNavigate(e) {
    const url = e.currentTarget.dataset.url
    if (!url) return
    // 若目标是当前页可用 switchTab，否则 navigateTo
    if (/^\/pages\/(index)\/index/.test(url)) {
      wx.switchTab({ url })
    } else {
      wx.navigateTo({ url })
    }
  },

  // 设置切换并持久化
  onToggleSetting(e) {
    const key = e.currentTarget.dataset.key
    if (!key || !(key in this.data.settings)) return
    const next = { ...this.data.settings, [key]: !this.data.settings[key] }
    this.setData({ settings: next })
    try {
      wx.setStorageSync('app_settings', next)
    } catch (e) {}
  },

  // 清理缓存与预览
  onClearCache() {
    wx.showModal({
      title: '清理缓存',
      content: '将清空本地设置、收藏与预览列表，是否继续？',
      confirmText: '清理',
      success: (res) => {
        if (!res.confirm) return
        try {
          wx.removeStorageSync('app_settings')
          wx.removeStorageSync('app_favorites')
          wx.removeStorageSync('app_following')
        } catch (e) {}
        this.setData({
          previewPaths: [],
          selectMode: false,
          selectedSet: {},
          selectedCount: 0
        })
        this.updateStatsFromLocal()
        wx.showToast({ title: '已清理', icon: 'none' })
      }
    })
  },

  // 联系与反馈
  onContact() {
    wx.showActionSheet({
      itemList: ['意见反馈', '加入交流群', '联系开发者'],
      success: (res) => {
        const i = res.tapIndex
        if (i === 0) {
          wx.navigateTo({ url: '/pages/example/index?tab=feedback' })
        } else if (i === 1) {
          wx.setClipboardData({ data: '交流群：请在小程序内添加客服后进群' })
        } else if (i === 2) {
          wx.showModal({
            title: '联系开发者',
            content: '邮箱：dev@example.com\n微信：dev_helper',
            showCancel: false
          })
        }
      }
    })
  },

  // 下拉刷新：同步灵感与统计
  onPullDownRefresh() {
    this.onRefreshChips()
    this.onRefreshTips()
    this.updateStatsFromLocal()
    wx.stopPullDownRefresh()
  },

  // 分享
  onShareAppMessage() {
    return {
      title: 'AI摄影姿势灵感与个人中心',
      path: '/pages/index/index'
    }
  },

  // 基于照片数量计算等级/VIP/成长进度
  computeLevel(photos = 0) {
    const maxLevel = 5
    const level = Math.min(maxLevel, Math.floor(photos / 10) + 1)
    const progressPct = Math.min(100, (photos % 10) * 10)
    const vip = photos >= 50
    return { level, progressPct, vip }
  }
})
