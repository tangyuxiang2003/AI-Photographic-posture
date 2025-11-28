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
    referenceImage: '', // 参考图片URL
    liveEnabled: false, // 实况模式默认关闭
    cameraContext: null, // 相机上下文
    source: 'reference', // 来源：reference(姿势厅) 或 generated(AI生成)
    isRecording: false, // 是否正在录制
    recordTimer: null, // 录制计时器
    cameraAuthorized: false, // 相机权限是否已授权
    showAuthModal: false // 是否显示授权引导弹窗
  },

  onLoad(options) {
    // 判断来源
    const source = options.source || (options.referenceImage ? 'reference' : 'generated');
    
    // 接收参考图片URL参数
    if (options.referenceImage) {
      const referenceImage = decodeURIComponent(options.referenceImage);
      this.setData({ 
        referenceImage: referenceImage,
        enlargedImage: referenceImage,
        isMaxEnlarged: false,
        source: source
      }, () => {
        // 根据来源决定是否加载生成的图片
        if (source === 'generated') {
          this.loadGeneratedImages();
        }
      });
      console.log('接收到参考图片:', referenceImage, '来源:', source);
    } else {
      // 没有参考图片，来源必定是 generated
      this.setData({ source: 'generated' }, () => {
        this.loadGeneratedImages();
      });
    }

    // 延迟检查权限，确保页面渲染完成
    setTimeout(() => {
      this.checkAndAuthorizeCameraPermissions();
    }, 300);
  },

  // 检查并申请相机相关权限（非强制）
  checkAndAuthorizeCameraPermissions() {
    console.log('开始检查相机权限...');
    
    wx.getSetting({
      success: (res) => {
        const authSetting = res.authSetting || {};
        console.log('当前权限设置:', authSetting);
        
        // 检查相机权限
        if (authSetting['scope.camera'] === false) {
          // 用户之前拒绝过相机权限，显示未授权状态
          console.log('相机权限已被拒绝，需要用户手动开启');
          this.setData({ cameraAuthorized: false });
          
          wx.showModal({
            title: '需要相机权限',
            content: '请允许使用相机功能',
            confirmText: '去设置',
            cancelText: '取消',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.openSetting({
                  success: (settingRes) => {
                    console.log('设置返回:', settingRes.authSetting);
                    if (settingRes.authSetting['scope.camera']) {
                      this.setData({ cameraAuthorized: true });
                      wx.showToast({
                        title: '权限已开启',
                        icon: 'success'
                      });
                      this.authorizeOtherPermissions();
                    } else {
                      wx.showToast({
                        title: '未开启相机权限',
                        icon: 'none'
                      });
                    }
                  }
                });
              }
            }
          });
        } else if (!authSetting['scope.camera']) {
          // 用户尚未授权，先设置为 true 让相机组件渲染，触发系统授权
          console.log('用户尚未授权相机，准备请求授权');
          this.setData({ cameraAuthorized: true }, () => {
            // 延迟一下，让相机组件先渲染
            setTimeout(() => {
              wx.authorize({
                scope: 'scope.camera',
                success: () => {
                  console.log('相机权限授权成功');
                  this.setData({ cameraAuthorized: true });
                  this.authorizeOtherPermissions();
                },
                fail: (err) => {
                  console.log('用户拒绝了相机权限', err);
                  this.setData({ cameraAuthorized: false });
                  wx.showToast({
                    title: '需要相机权限才能使用',
                    icon: 'none',
                    duration: 2000
                  });
                }
              });
            }, 100);
          });
        } else {
          // 已有相机权限，允许使用相机
          console.log('相机权限已存在，直接使用');
          this.setData({ cameraAuthorized: true });
          this.authorizeOtherPermissions();
        }
      },
      fail: (err) => {
        console.error('获取设置失败:', err);
        // 即使获取设置失败，也尝试渲染相机组件
        this.setData({ cameraAuthorized: true });
        wx.showToast({
          title: '权限检查失败，尝试使用相机',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 申请其他权限（闪光灯、录音、相册）
  authorizeOtherPermissions() {
    // 申请闪光灯权限（静默申请，失败不提示）
    wx.authorize({
      scope: 'scope.cameraFlash',
      success: () => {
        console.log('闪光灯权限已获取');
      },
      fail: () => {
        console.log('闪光灯权限获取失败');
      }
    });

    // 申请录音权限（实况录制需要，静默申请）
    wx.authorize({
      scope: 'scope.record',
      success: () => {
        console.log('录音权限已获取');
      },
      fail: () => {
        console.log('录音权限获取失败，实况功能可能无法使用');
      }
    });

    // 申请保存到相册权限（静默申请）
    wx.authorize({
      scope: 'scope.writePhotosAlbum',
      success: () => {
        console.log('相册写入权限已获取');
      },
      fail: () => {
        console.log('相册写入权限获取失败');
      }
    });
  },

  // 请求相机授权（由用户主动触发）
  requestCameraAuth() {
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.camera'] === false) {
          // 用户之前拒绝过，需要引导去设置页
          wx.showModal({
            title: '需要相机权限',
            content: '请在设置中开启相机权限',
            confirmText: '去设置',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.openSetting({
                  success: (settingRes) => {
                    if (settingRes.authSetting['scope.camera']) {
                      this.setData({ cameraAuthorized: true });
                      wx.showToast({
                        title: '权限已开启',
                        icon: 'success'
                      });
                      this.authorizeOtherPermissions();
                    }
                  }
                });
              }
            }
          });
        } else {
          // 重新请求授权
          this.checkAndAuthorizeCameraPermissions();
        }
      }
    });
  },

  onShow() {
    // 每次显示页面时重新加载图片
    this.loadGeneratedImages();
  },

  // 加载生成的图片
  loadGeneratedImages() {
    // 只有来源是 generated 时才加载生成的图片
    if (this.data.source !== 'generated') {
      console.log('来源是姿势厅，不加载生成图片');
      this.setData({ generatedImages: [] });
      return;
    }
    
    try {
      const images = wx.getStorageSync('generated_images') || [];
      // 过滤掉空值、无效数据和与参考图片重复的数据
      const validImages = (Array.isArray(images) ? images : [])
        .filter(img => img && typeof img === 'string' && img.trim() !== '')
        .filter(img => img !== this.data.referenceImage);
      
      this.setData({ generatedImages: validImages });
      console.log('加载的有效图片数量:', validImages.length);
    } catch (e) {
      console.error('加载生成图片失败', e);
      this.setData({ generatedImages: [] });
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
            icon: 'none',
            duration: 1500
          });
        } else {
          wx.showToast({
            title: '闪光灯已关闭',
            icon: 'none',
            duration: 1500
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

  // 切换实况模式
  toggleLive() {
    this.setData({
      liveEnabled: !this.data.liveEnabled
    });
  },

  // 拍照
  takePhoto() {
    if (this.data.isTakingPhoto) return;
    
    const ctx = wx.createCameraContext();
    this.setData({ isTakingPhoto: true });
    
    // 如果开启了实况模式
    if (this.data.liveEnabled) {
      // 如果开启了倒计时
      if (this.data.timerEnabled) {
        let seconds = this.data.timerSeconds;
        
        wx.showToast({
          title: `将在${seconds}秒后拍摄实况`,
          icon: 'none',
          duration: seconds * 1000
        });
        
        this.data.countdown = setInterval(() => {
          seconds--;
          if (seconds <= 0) {
            clearInterval(this.data.countdown);
            this.takeLivePhoto(ctx);
          } else {
            wx.showToast({
              title: `将在${seconds}秒后拍摄实况`,
              icon: 'none',
              duration: 1000
            });
          }
        }, 1000);
      } else {
        this.takeLivePhoto(ctx);
      }
    } else {
      // 普通拍照模式
      if (this.data.timerEnabled) {
        let seconds = this.data.timerSeconds;
        
        wx.showToast({
          title: `将在${seconds}秒后拍摄`,
          icon: 'none',
          duration: seconds * 1000
        });
        
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
        this.realTakePhoto(ctx);
      }
    }
  },

  // 实况拍照
  takeLivePhoto(ctx) {
    // 先检查录音权限
    wx.getSetting({
      success: (res) => {
        if (!res.authSetting['scope.record']) {
          // 没有录音权限，请求授权
          wx.authorize({
            scope: 'scope.record',
            success: () => {
              this.startRecording(ctx);
            },
            fail: () => {
              wx.showModal({
                title: '需要录音权限',
                content: '实况拍摄需要录音权限，请在设置中开启',
                confirmText: '去设置',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    wx.openSetting();
                  }
                  this.setData({ isTakingPhoto: false });
                }
              });
            }
          });
        } else {
          this.startRecording(ctx);
        }
      }
    });
  },

  // 开始录制
  startRecording(ctx) {
    // 防止重复录制
    if (this.data.isRecording) {
      console.log('正在录制中，忽略重复调用');
      return;
    }

    this.setData({ isRecording: true });

    ctx.startRecord({
      timeout: 10, // 设置最大录制时长为10秒
      success: () => {
        console.log('开始录制成功');
        
        // 使用计时器在2秒后停止录制
        this.data.recordTimer = setTimeout(() => {
          // 检查是否还在录制状态
          if (!this.data.isRecording) {
            console.log('录制已停止，跳过stopRecord调用');
            return;
          }

          ctx.stopRecord({
            success: (res) => {
              console.log('停止录制成功', res);
              this.setData({ 
                isRecording: false,
                isTakingPhoto: false 
              });
              
              const tempVideoPath = res.tempVideoPath;
              
              // 跳转到视频预览页面
              wx.navigateTo({
                url: `/pages/video-preview/index?videoPath=${encodeURIComponent(tempVideoPath)}`
              });
            },
            fail: (err) => {
              console.error('停止录制失败', err);
              this.setData({ 
                isRecording: false,
                isTakingPhoto: false 
              });
              wx.showToast({
                title: '录制失败，请重试',
                icon: 'none',
                duration: 2000
              });
            }
          });
        }, 2000);
      },
      fail: (err) => {
        console.error('开始录制失败', err);
        this.setData({ 
          isRecording: false,
          isTakingPhoto: false 
        });
        
        // 根据错误类型给出不同提示
        let errorMsg = '录制失败';
        if (err.errMsg && err.errMsg.includes('auth')) {
          errorMsg = '缺少录音权限';
        } else if (err.errMsg && err.errMsg.includes('busy')) {
          errorMsg = '相机忙碌，请稍后重试';
        }
        
        wx.showToast({
          title: errorMsg,
          icon: 'none',
          duration: 2000
        });
      }
    });
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
      setTimeout(doTake, 100);
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
    const error = e.detail || {};
    console.error('相机错误详情:', error);
    
    let errorMsg = '相机初始化失败';
    
    // 根据错误信息给出更具体的提示
    if (error.errMsg) {
      const errMsg = error.errMsg.toLowerCase();
      
      if (errMsg.includes('auth') || errMsg.includes('authorize')) {
        errorMsg = '相机权限未授权';
        this.setData({ cameraAuthorized: false });
        
        // 提示用户去设置
        wx.showModal({
          title: '需要相机权限',
          content: '请在设置中开启相机权限',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting();
            }
          }
        });
        return;
      } else if (errMsg.includes('busy')) {
        errorMsg = '相机正忙，请稍后重试';
      } else if (errMsg.includes('not support')) {
        errorMsg = '设备不支持相机功能';
      } else if (errMsg.includes('system')) {
        errorMsg = '系统错误，请重启小程序';
      }
    }
    
    wx.showModal({
      title: '相机错误',
      content: errorMsg + ' | 错误信息: ' + (error.errMsg || '未知错误'),
      showCancel: true,
      confirmText: '重试',
      cancelText: '返回',
      success: (res) => {
        if (res.confirm) {
          // 重新检查权限
          this.checkAndAuthorizeCameraPermissions();
        } else {
          // 返回上一页
          wx.navigateBack();
        }
      }
    });
  },

  // 相机准备就绪
  onCameraReady() {
    console.log('相机初始化完成');
    wx.showToast({
      title: '相机已就绪',
      icon: 'success',
      duration: 1500
    });
  },

  // 相机停止
  onCameraStop() {
    console.log('相机已停止');
  },

  onUnload() {
    // 页面卸载时清除计时器
    if (this.data.countdown) {
      clearInterval(this.data.countdown);
    }
    // 清除录制计时器
    if (this.data.recordTimer) {
      clearTimeout(this.data.recordTimer);
    }
    // 如果正在录制，尝试停止
    if (this.data.isRecording) {
      const ctx = wx.createCameraContext();
      ctx.stopRecord({
        success: () => {
          console.log('页面卸载时停止录制成功');
        },
        fail: () => {
          console.log('页面卸载时停止录制失败');
        }
      });
    }
  }
});