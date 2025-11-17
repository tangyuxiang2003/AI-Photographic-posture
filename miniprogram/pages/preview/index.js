// pages/preview/index.js
const authUtil = require('../../utils/auth')
const { post } = require('../../utils/request')
const { getAuth } = require('../../utils/storage')

Page({
  data: {
    imagePath: '',
    aiImageId: null,
    isFavorite: false,
    isLoggedIn: false
  },
  onLoad(options) {
    const { imagePath = '', aiImageId = '' } = options || {};
    this.setData({ 
      imagePath,
      aiImageId: aiImageId || null
    });
    if (!imagePath) {
      wx.showToast({ title: '未获取到图片', icon: 'none' });
    }
    
    // 如果没有传入aiImageId，尝试从本地存储的aiIdMap中获取
    if (!aiImageId) {
      this.loadAiImageId();
    }
    
    this.checkLoginStatus();
    this.loadFavoriteStatus();
  },
  onShow() {
    this.checkLoginStatus();
    this.loadFavoriteStatus();
  },
  // 从本地存储加载aiImageId
  loadAiImageId() {
    try {
      // 尝试从analyze页面的aiIdMap中获取
      const aiIdMap = wx.getStorageSync('aiIdMap') || {};
      const aiImageId = aiIdMap[this.data.imagePath];
      if (aiImageId) {
        this.setData({ aiImageId });
        console.log('[preview] 从aiIdMap加载到aiImageId:', aiImageId);
      }
    } catch (error) {
      console.error('加载aiImageId失败:', error);
    }
  },
  // 检查登录状态
  checkLoginStatus() {
    const isLoggedIn = authUtil.isLoggedIn();
    this.setData({ isLoggedIn });
  },
  // 加载收藏状态
  loadFavoriteStatus() {
    try {
      const localFavorites = wx.getStorageSync('local_favorites') || [];
      const isFavorite = localFavorites.some(item => {
        return item.cover === this.data.imagePath || item.aiImageUrl === this.data.imagePath;
      });
      this.setData({ isFavorite });
    } catch (error) {
      console.error('加载收藏状态失败:', error);
    }
  },
  onOpenPreview() {
    const url = this.data.imagePath;
    if (!url) return;
    wx.previewImage({ current: url, urls: [url] });
  },
  onSave() {
    const url = this.data.imagePath;
    if (!url) return;
    // 保存到相册前确保已授权
    wx.saveImageToPhotosAlbum({
      filePath: url,
      success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: (err) => {
        if (err && err.errMsg && err.errMsg.includes('auth')) {
          wx.showModal({
            title: '提示',
            content: '需要开启“保存到相册”权限',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) wx.openSetting({});
            }
          });
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      }
    });
  },
  onRetake() {
    // 返回到相机页重新拍摄
    wx.navigateBack();
  },
  onBack() {
    wx.navigateBack();
  },
  // 切换收藏状态
  async onToggleFavorite() {
    if (!this.data.isLoggedIn) {
      wx.showModal({
        title: '需要授权登录',
        content: '收藏功能需要先授权登录，是否前往授权？',
        confirmText: '去授权',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({
              url: '/pages/profile/index'
            });
          }
        }
      });
      return;
    }

    // 检查是否有aiImageId
    if (!this.data.aiImageId) {
      wx.showToast({
        title: '缺少图片ID，无法收藏',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    try {
      const auth = getAuth() || {};
      const userId = auth.userId;
      const url = this.data.imagePath;
      const aiImageId = this.data.aiImageId;

      // 使用与analyze页面相同的收藏逻辑
      const willFav = !this.data.isFavorite;

      // 更新本地收藏状态
      const favorites = wx.getStorageSync('favorites') || [];
      let favMap = {};
      favorites.forEach(u => { favMap[u] = true; });

      if (willFav) {
        favMap[url] = true;
      } else {
        delete favMap[url];
      }

      const list = Object.keys(favMap);
      wx.setStorageSync('favorites', list);

      // 同步到app_favorites（用于收藏页展示）
      const existingFavs = wx.getStorageSync('app_favorites') || [];
      const existingMap = {};
      existingFavs.forEach(item => {
        if (item && item.cover) {
          existingMap[item.cover] = item;
        }
      });

      const objList = list.map(u => {
        const existing = existingMap[u];
        return {
          id: aiImageId,
          title: existing?.title || 'AI生成图',
          cover: u,
          tags: existing?.tags || [],
          type: existing?.type || 'AI',
          collectTime: existing?.collectTime || new Date().toISOString()
        };
      });
      wx.setStorageSync('app_favorites', objList);

      this.setData({ isFavorite: willFav });
      wx.showToast({ 
        title: willFav ? '已收藏' : '已取消', 
        icon: 'none', 
        duration: 800 
      });

      // 调用后端接口
      try {
        if (willFav) {
          // 使用 addByAiImageId 接口，只需要传递 aiImageId
          // userId 会由 request.js 自动注入到请求体中
          await post('/api/collection/addByAiImageId', { 
            aiImageId: aiImageId
          });
        } else {
          await post('/api/collection/remove', { userId, aiImageId });
        }
      } catch (err) {
        console.error('后端收藏操作失败:', err);
        // 回滚本地状态
        const rollback = Object.assign({}, favMap);
        if (willFav) {
          delete rollback[url];
        } else {
          rollback[url] = true;
        }
        const rollList = Object.keys(rollback);
        wx.setStorageSync('favorites', rollList);
        
        const rollObj = rollList.map(u => {
          const existing = existingMap[u];
          return {
            id: aiImageId,
            title: existing?.title || 'AI生成图',
            cover: u,
            tags: existing?.tags || [],
            type: existing?.type || 'AI',
            collectTime: existing?.collectTime || new Date().toISOString()
          };
        });
        wx.setStorageSync('app_favorites', rollObj);
        
        this.setData({ isFavorite: !willFav });
        wx.showToast({ 
          title: '网络错误，请重试', 
          icon: 'none' 
        });
      }
    } catch (error) {
      console.error('收藏操作失败:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    }
  }
});