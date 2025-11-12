// app.js
App({
  onLaunch: function () {
    this.globalData = {
      // env 参数说明：
      //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
      //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
      //   如不填则使用默认环境（第一个创建的环境）
      env: "",
      themeBg: '#FFF7FA'
    };
    // 云开发已停用：不再初始化 wx.cloud，保留全局配置占位
    this.globalData.env = this.globalData.env;
    
    // 初始化主题色
    this.initTheme();
  },
  
  // 初始化主题
  initTheme() {
    try {
      const bg = wx.getStorageSync('theme_bg') || '#FFF7FA';
      this.globalData.themeBg = bg;
    } catch (e) {
      console.error('初始化主题失败:', e);
    }
  },
  
  // 获取主题色
  getTheme() {
    return this.globalData.themeBg || '#FFF7FA';
  },
  
  // 设置主题色
  setTheme(color) {
    this.globalData.themeBg = color;
    try {
      wx.setStorageSync('theme_bg', color);
    } catch (e) {
      console.error('保存主题失败:', e);
    }
  }
});
