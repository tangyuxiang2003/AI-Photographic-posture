 // camera.js
Page({
  data: {
    cameraPosition: 'back', // 初始使用后置摄像头
    flash: 'off', // 闪光灯默认关闭
    timerEnabled: false, // 倒计时默认关闭
    timerSeconds: 3, // 倒计时秒数
    countdown: null, // 倒计时计时器
    isTakingPhoto: false, // 是否正在拍照
    generatedImages: [], // 生成的图片列表
    enlargedImage: '', // 当前放大显示的图片
    isMaxEnlarged: false, // 是否处于最大放大状态（3倍）
    referenceImage: '' // 参考图片URL
  },

  onLoad(options) {
    // 接收参考图片URL参数
    if (options.referenceImage) {
      const referenceImage = decodeURIComponent(options.referenceImage);
      this.setData({ 
        referenceImage: referenceImage,
        enlargedImage: referenceImage,
        isMaxEnlarged: false 
      });
      console.log('接收到参考图片:', referenceImage);
    }

    // 申请相机权限
    wx.authorize({
      scope: 'scope.camera',
      success: () => {
        console.log('相机权限已获取');
      },
      fail: () => {
        wx.showToast({
          title: '请授予相机权限',
          icon: 'none'
        });
      }
    });
    
    // 申请闪光灯权限
    wx.authorize({
      scope: 'scope.cameraFlash',
      success: () => {
        console.log('闪光灯权限已获取');
      }
    });

    // 加载生成的图片
    this.loadGeneratedImages();
  },

  onShow() {
    // 每次显示页面时重新加载图片
    this.loadGeneratedImages();
  },

  // 加载生成的图片
  loadGeneratedImages() {
    try {
      const images = wx.getStorageSync('generated_images') || [];
      this.setData({ generatedImages: Array.isArray(images) ? images : [] });
    } catch (e) {
      console.error('加载生成图片失败', e);
    }
  },

  // 点击缩略图
  onThumbnailTap(e) {
    const url = e.currentTarget.dataset.url;
    if (url) {
      this.setData({ 
        enlargedImage: url,
        isMaxEnlarged: false 
      });
    }
  },

  // 点击屏幕收起放大图片
  onScreenTap() {
    if (this.data.enlargedImage) {
      this.setData({ 
        enlargedImage: '',
        isMaxEnlarged: false 
      });
    }
  },

  // 关闭放大图片或切换放大倍数
  onCloseEnlarged(e) {
    // 阻止事件冒泡
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    
    // 如果当前是最大放大状态，切换回普通放大
    if (this.data.isMaxEnlarged) {
      this.setData({ isMaxEnlarged: false });
    } else {
      // 如果是普通放大状态，切换到最大放大
      this.setData({ isMaxEnlarged: true });
    }
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  },

  // 切换摄像头
  switchCamera() {
    this.setData({
      cameraPosition: this.data.cameraPosition === 'back' ? 'front' : 'back'
    });
  },

  // 打开相册
  openAlbum() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0];
        if (file && file.tempFilePath) {
          wx.navigateTo({
            url: `/pages/preview/index?imagePath=${file.tempFilePath}`
          });
        }
      },
      fail: () => {
        wx.showToast({
          title: '打开相册失败',
          icon: 'none'
        });
      }
    });
  },

  // 切换闪光灯
  toggleFlash() {
    // 只有后置摄像头才能使用闪光灯
    if (this.data.cameraPosition === 'back') {
      const next = this.data.flash === 'off' ? 'on' : 'off';
      this.setData({ flash: next }, () => {
        if (next === 'on') {
          wx.showToast({
            title: '闪光灯已打开',
            icon: 'none'
          });
        }
      });
    } else {
      wx.showToast({
        title: '前置摄像头无闪光灯',
        icon: 'none'
      });
    }
  },

  // 切换倒计时
  toggleTimer() {
    this.setData({
      timerEnabled: !this.data.timerEnabled
    });
  },

  // 拍照
  takePhoto() {
    if (this.data.isTakingPhoto) return;
    
    const ctx = wx.createCameraContext();
    this.setData({ isTakingPhoto: true });
    
    // 如果开启了倒计时
    if (this.data.timerEnabled) {
      let seconds = this.data.timerSeconds;
      
      // 显示倒计时提示
      wx.showToast({
        title: `将在${seconds}秒后拍摄`,
        icon: 'none',
        duration: seconds * 1000
      });
      
      // 倒计时逻辑
      this.data.countdown = setInterval(() => {
        seconds--;
        if (seconds <= 0) {
          clearInterval(this.data.countdown);
          this.realTakePhoto(ctx);
        } else {
          wx.showToast({
            title: `将在${seconds}秒后拍摄`,
            icon: 'none',
            duration: 1000
          });
        }
      }, 1000);
    } else {
      // 直接拍照
      this.realTakePhoto(ctx);
    }
  },

  // 实际拍照操作
  realTakePhoto(ctx) {
    const doTake = () => {
      ctx.takePhoto({
        quality: 'high',
        success: (res) => {
          // 拍照成功，获取图片临时路径
          const tempImagePath = res.tempImagePath;
          
          // 可以在这里处理图片，比如预览或上传
          wx.navigateTo({
            url: `/pages/preview/index?imagePath=${tempImagePath}`
          });
        },
        fail: (err) => {
          console.error('拍照失败', err);
          wx.showToast({
            title: '拍照失败',
            icon: 'none'
          });
        },
        complete: () => {
          this.setData({ isTakingPhoto: false });
        }
      });
    };

    // 若为后置且闪光处于打开，先确保属性应用后再拍，提升闪光触发稳定性
    if (this.data.cameraPosition === 'back' && this.data.flash === 'on') {
      this.setData({ flash: 'on' });
      setTimeout(doTake, 120);
    } else {
      if (this.data.flash === 'on' && this.data.cameraPosition !== 'back') {
        wx.showToast({
          title: '前置摄像头无闪光灯',
          icon: 'none'
        });
      }
      doTake();
    }
  },

  // 相机错误处理
  onCameraError(e) {
    console.error('相机错误', e.detail);
    wx.showToast({
      title: '相机初始化失败',
      icon: 'none'
    });
  },

  onUnload() {
    // 页面卸载时清除计时器
    if (this.data.countdown) {
      clearInterval(this.data.countdown);
    }
  }
});