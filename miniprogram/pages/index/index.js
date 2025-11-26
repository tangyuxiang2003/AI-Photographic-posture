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
      favorites: '/images/icons/goods.png',
      history: '/images/icons/examples.png',
      account: '/images/icons/usercenter.png',
      settings: '/images/icons/setting.svg',
      feedback: '/images/icons/customer-service.svg',
      about: '/images/icons/question.svg'
    },
    showAuthOverlay: false,
    authBypassed: false,
    // 未登录可免费生成一次姿势推荐的标记
    freeAnalyzeUsed: false,
    // 受个人中心“展示拍照小技巧”开关联动控制
    homeTipsEnabled: true,
    // 全局主题背景色
    themeBg: '#FFF7FA'
  },

  onTapUpload() {
    if (!this.data.profile.hasAuth && !this.data.authBypassed) {
      this.setData({ showAuthOverlay: true })
      return
    }
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

  // 首屏授权：读取本地跳过标记并决定是否显示覆盖层
  _initAuthOverlay() {
    let bypass = false
    try {
      bypass = !!wx.getStorageSync('auth_bypassed')
    } catch (e) {}
    const hasAuth = !!this.data.profile?.hasAuth
    this.setData({
      authBypassed: bypass,
      showAuthOverlay: !hasAuth && !bypass
    })
  },

  // 覆盖层按钮：一键登录（统一授权弹窗 + 授权 + HTTP登录）
  onAuthAgree() {
    const { authorizeLogin } = require('../../utils/auth.js');
    authorizeLogin()
      .then(({ mergedUser, token }) => {
        console.log('登录成功，后端返回的 token:', token);
        // 保存 token，供请求自动注入 Authorization 使用
        if (typeof token === 'string' && token) {
          try { wx.setStorageSync('token', token); } catch (e) {}
          try { wx.setStorageSync('auth_token', token); } catch (e) {}
          // 使用封装的 setToken，统一注入到 utils/request.js
          try { require('../../utils/request.js').setToken(token); } catch (e) {}
        }
        // 清除游客模式标记
        try { wx.removeStorageSync('auth_bypassed'); } catch (e) {}
        this.setData({
          profile: { ...this.data.profile, ...mergedUser, hasAuth: true },
          showAuthOverlay: false,
          authBypassed: false
        });
        wx.showToast({ title: '登录成功', icon: 'success' });
        
        // 登录成功后刷新统计数据
        this.updateStatsFromLocal();
      })
      .catch((err) => {
        if (String(err && err.message).includes('USER_CANCEL_EXPLAIN')) {
          wx.showToast({ title: '已取消授权说明', icon: 'none' });
        } else {
          wx.showToast({ title: '登录失败，请稍后重试', icon: 'none' });
        }
      });
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

  // 点击句子，同步到描述框（追加，且用空格分隔）
  onTapSentence(e){
    const sentence = e.currentTarget.dataset.sentence || ''
    const prev = this.data.expectDesc?.trim()
    const next = prev ? (prev + ' ' + sentence) : sentence
    this.setData({ expectDesc: next })
  },


  // 刷新热门词
  onRefreshChips(){
    const pool = [
      // 风格
      '法式优雅','公主风','森系清新','甜酷混搭','通勤极简','复古胶片','港风氛围','韩系氛围','元气校园','度假海边','美式复古','日式简约','中式国潮','轻熟御姐','街头潮酷','极简主义','波西米亚','复古英伦','ins清新','甜辣少女',
      // 场景
      '咖啡店','书店一角','落地窗旁','花墙前','天台栏杆','街头斑马线','公园草地','海边礁石','老城区巷口','地铁站口','复古唱片店','艺术展览馆','林荫小道','商场扶梯','雨夜街头','露营营地','古镇戏台','大学操场','文创园区','滨江步道',
      // 姿势
      '回头微笑','贴墙侧身','抱臂俏皮','托腮凝视','捧脸甜笑','撩发侧目','露齿微笑','躺拍顶视','坐姿显腿长','跨步走拍',
      '单手插兜','捏衣领','捧花入镜','拿书遮脸','手持咖啡','转身回望','跳步抓拍','歪头wink','手比爱心','抱膝而坐','背手漫步','仰头望景','俯身拾物','靠墙歪头','举镜自拍','抱臂倚栏','踮脚旋转','托帽耍帅','侧身撩发','盘腿静坐','双手比耶','捧杯浅笑','搭肩互动','倚树眺望','提裙小步','甩发抓拍','歪头比耶','手插裤袋','仰头大笑','侧躺摆拍'
    ]
    
    // 如果没有初始化过词库或当前索引，则初始化
    if (!this.chipPool || !Array.isArray(this.chipPool) || this.chipPool.length === 0) {
      // 打乱词库顺序
      this.chipPool = pool.sort(() => 0.5 - Math.random())
      this.chipIndex = 0
    }
    
    // 获取当前批次的6个词语
    const start = this.chipIndex
    const end = start + 6
    let currentBatch = this.chipPool.slice(start, end)
    
    // 如果不足6个，说明到末尾了，需要重新打乱并从头开始
    if (currentBatch.length < 6) {
      this.chipPool = pool.sort(() => 0.5 - Math.random())
      this.chipIndex = 0
      currentBatch = this.chipPool.slice(0, 6)
      this.chipIndex = 6
    } else {
      // 移动索引到下一批
      this.chipIndex = end
    }
    
    this.setData({ hotChips: currentBatch })
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
      ' 逆光站在树影下，光斑洒在发丝上，朦胧感拉满。',
      ' 侧光拍摄，轮廓分明，脸部明暗对比更显立体感。',
      ' 低角度仰拍，搭配天空背景，瞬间拥有大长腿既视感。',
      // 姿势灵感
      '把重心放在一条腿上，另一条自然弯曲更显灵动。',
      '单手插兜、另一手拎包，走两步制造自然摆动感。',
      '坐在台阶上双手抱膝，脚尖内扣更显俏皮比例。',
      '靠墙侧身，肩膀向镜头，回眸浅笑更显氛围。',
      '双手捧花靠近脸颊，闭眼嗅花增强画面故事感。',
      '拿书挡半张脸，只露眼睛看镜头，增加神秘感。',
      ' 一只脚向前伸直，另一只脚向后弯曲，重心错落更具动感。',
      ' 双手交叉放在胸前，微微仰头，气场瞬间拉满。',
      ' 背对镜头慢走，突然回头露齿笑，抓拍的动态感绝了。',
      ' 趴在草地上，手肘撑地托腮，无辜感直接拿捏。',
      ' 单手扶帽檐，眼神看向斜下方，随性又时髦。',
      ' 坐在椅子上，一条腿搭在另一条腿上，慵懒又高级。',
      // 场景动作
      '咖啡店窗边对着窗外发呆，手心托腮更显温柔。',
      '书店通道回眸，身后书架形成纵深感与层次。',
      '公园草地坐姿，双腿侧放，身体微向前倾更显比例。',
      '海边逆光拨发，裙摆随风，注意连拍捕捉状态感。',
      '天台栏杆处远望，身体靠栏，注意安全与地平线平衡。',
      ' 复古唱片店拿起黑胶唱片，举在耳边，复古氛围感直接拉满。',
      ' 艺术展览馆前，对着雕塑做出同款姿势，互动感十足。',
      ' 林荫小道上散步，偶尔回头看镜头，自然又清新。',
      ' 商场扶梯上从上往下拍，利用扶梯线条营造延伸感。',
      ' 雨夜街头撑伞，雨滴打在伞面，低头浅笑氛围感拉满。',
      ' 露营营地坐在帐篷前，手拿篝火棒，烟火气十足。',
      // 小技巧
      '嘴角上扬但不过度，眼神聚焦镜头上方更显自然。',
      '道具在手不离线：花/书/咖啡随动作移动保持自然。',
      '按三分法构图，人偏一侧，给画面留出呼吸空间。',
      
    ]
    const shuffled = pool.sort(() => 0.5 - Math.random())
    this.setData({ tipsItems: shuffled.slice(0, 3) })
  },

  onAnalyze() {
    // 未登录：仅允许免费生成一次，其后需登录
    if (!this.data.profile.hasAuth) {
      let used = this.data.freeAnalyzeUsed
      try {
        if (!used) used = !!wx.getStorageSync('free_analyze_used')
      } catch (e) {}
      if (used) {
        wx.showToast({ title: '请登录后继续使用此功能', icon: 'none' })
        this.setData({ showAuthOverlay: true })
        return
      } else {
        // 标记已使用免费次数
        try { wx.setStorageSync('free_analyze_used', true) } catch (e) {}
        this.setData({ freeAnalyzeUsed: true })
      }
    }

    // 提交分析任务占位：保存用户意图与候选输入，等待后端/工作流产出结果
    const prompt = (this.data.expectDesc || '').trim()
    const list = this.normalize(this.data.previewPaths)
    const inputs = list.map(it => it.src).filter(Boolean)
    
    // CRITICAL: 必须上传图片才能进行分析
    if (!inputs.length) {
      wx.showToast({ 
        title: '请先上传背景照片或人景合照', 
        icon: 'none',
        duration: 2000
      })
      return
    }
    
    // 至少需要描述或图片之一
    if (!prompt && !inputs.length) {
      wx.showToast({ title: '请先填写描述或选择图片', icon: 'none' })
      return
    }
    try {
      const job = {
        prompt,
        inputs,
        createdAt: Date.now(),
        status: 'pending'
      }
      wx.setStorageSync('analyze_job', job)
      // 清空旧的工作流结果，待工作流写入新结果
      wx.removeStorageSync('workflow_results')
    } catch (e) {}
    // 导航前先读取 token，若为空则兜底提示并不跳转
    let t1 = '', t2 = '', tk = '';
    try { t1 = wx.getStorageSync('auth_token') || ''; } catch (e) {}
    try { t2 = wx.getStorageSync('token') || ''; } catch (e) {}
    tk = t1 || t2;
    try { console.log('[index] pre-navigate token', { auth_token: t1, token: t2, using: tk }); } catch (_) {}
    if (!tk) {
      wx.showToast({ title: '登录信息未就绪，请稍后重试', icon: 'none' });
      // 如果未显示授权层，则引导用户登录
      if (!this.data.profile.hasAuth) this.setData({ showAuthOverlay: true });
      return;
    }
    wx.navigateTo({
      url: '/pages/analyze/index',
      success: (res) => {
        const channel = res && res.eventChannel;
        if (channel) {
          try { console.log('[index] emit token', { auth_token: t1, token: t2, using: tk }); } catch (_) {}
          channel.emit('startAnalyzePayload', {
            localPaths: inputs,
            desc: prompt,
            // 可选：如果有用户ID就传，没有则留空字符串
            userId: (this.data.profile && this.data.profile.userId) ? String(this.data.profile.userId) : '',
            // 附带 token，分析页兜底使用
            token: tk,
            // 新增：标记是否为纯文字描述模式
            textOnly: inputs.length === 0 && !!prompt
          });
        }
      }
    })
  },

  // 生命周期：进入页面初始化个人中心数据
  onLoad() {
    // 同步首页主题背景
    try {
      const bg = wx.getStorageSync('theme_bg') || '#FFF7FA';
      if (bg !== this.data.themeBg) this.setData({ themeBg: bg });
    } catch (e) {}
    // 读取个人中心开关：tips_enabled 控制首页两个区块显示
    try {
      const tipsEn = wx.getStorageSync('tips_enabled');
      if (typeof tipsEn === 'boolean') this.setData({ homeTipsEnabled: tipsEn });
    } catch (e) {}
    // 读取本地设置
    try {
      const saved = wx.getStorageSync('app_settings')
      if (saved && typeof saved === 'object') {
        this.setData({ settings: { ...this.data.settings, ...saved } })
      }
    } catch (e) {}
    // 初始化一次免费生成标记
    try {
      const used = !!wx.getStorageSync('free_analyze_used')
      if (used) this.setData({ freeAnalyzeUsed: true })
    } catch (e) {}
    // 初始化授权覆盖层状态
    this._initAuthOverlay()
    // 刷新统计
    this.updateStatsFromLocal()
  },
  onShow() {
    // 同步主题背景
    try {
      const bg = wx.getStorageSync('theme_bg') || '#FFF7FA';
      if (bg !== this.data.themeBg) this.setData({ themeBg: bg });
    } catch (e) {}
    // 同步个人中心开关
    try {
      const tipsEn = wx.getStorageSync('tips_enabled');
      if (typeof tipsEn === 'boolean' && tipsEn !== this.data.homeTipsEnabled) {
        this.setData({ homeTipsEnabled: tipsEn });
      }
    } catch (e) {}
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
          const next = {
            avatarUrl: userInfo?.avatarUrl || '',
            nickName: userInfo?.nickName || '微信昵称',
            hasAuth: true
          }
          // 持久化到本地，供个人中心自动读取
          try { wx.setStorageSync('profile_basic', next); } catch (e) {}
          this.setData({
            profile: next,
            showAuthOverlay: false,
            authBypassed: false
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
    // 未登录：个人中心常用功能需登录
    if (!this.data.profile.hasAuth) {
      wx.showToast({ title: '请登录后使用此功能', icon: 'none' })
      this.setData({ showAuthOverlay: true })
      return
    }
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
