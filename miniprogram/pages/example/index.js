// pages/exampleDetail/index.js
Page({
  data: {
    type: "",
    envId: "",
    showTip: false,
    title: "",
    content: "",

    haveGetOpenId: false,
    openId: "",

    haveGetCodeSrc: false,
    codeSrc: "",

    haveGetRecord: false,
    record: [],

    haveGetImgSrc: false,
    imgSrc: "",

    // ai
    modelConfig: {
      modelProvider: "deepseek", // 大模型服务厂商
      quickResponseModel: "deepseek-v3", // 快速响应模型 （混元 turbo, gpt4 turbo版，deepseek v3等）
      logo: "https://cloudcache.tencent-cloud.com/qcloud/ui/static/static_source_business/2339414f-2c0d-4537-9618-1812bd14f4af.svg", // model 头像
      welcomeMsg: "我是deepseek-v3，很高兴见到你！", // model 欢迎语
    },
    callcbrCode: "",
    initEnvCode: "",
    callOpenIdCode: "",
    callMiniProgramCode: "",
    callFunctionCode: "",
    callCreateCollectionCode: "",
    callUploadFileCode: "",

    showInsertModal: false,
    insertRegion: "",
    insertCity: "",
    insertSales: "",

    haveGetCallContainerRes: false,
    callContainerResStr: "",

    ai_page_config: `{
  "usingComponents": {
    "agent-ui":"/components/agent-ui/index"
  },
}`,
    ai_wxml_config: `&lt;agent-ui agentConfig="{{agentConfig}}" showBotAvatar="{{showBotAvatar}}" chatMode="{{chatMode}}" modelConfig="{{modelConfig}}""&gt;&lt;/agent-ui&gt;`,
    ai_data_config: `data: {
  chatMode: "bot", // bot 表示使用agent，model 表示使用大模型
  showBotAvatar: true, // 是否在对话框左侧显示头像
  agentConfig: {
    botId: "your agent id", // agent id,
    allowWebSearch: true, // 允许客户端选择展示联网搜索按钮
    allowUploadFile: true, // 允许客户端展示上传文件按钮
    allowPullRefresh: true, // 允许客户端展示下拉刷新
    allowUploadImage: true, // 允许客户端展示上传图片按钮
    allowMultiConversation: true, // 允许客户端展示查看会话列表/新建会话按钮
    showToolCallDetail: true, // 是否展示 mcp server toolCall 细节
    allowVoice: true, // 允许客户端展示语音按钮
    showBotName: true, // 允许展示bot名称
  },
  modelConfig: {
    modelProvider: "hunyuan-open", // 大模型服务厂商
    quickResponseModel: "hunyuan-lite", // 大模型名称
    logo: "", // model 头像
    welcomeMsg: "欢迎语", // model 欢迎语
  },
}`,
  },

  onLoad(options) {
    console.log("options", options);
    if (
      options.type === "cloudbaserunfunction" ||
      options.type === "cloudbaserun"
    ) {
      this.getCallcbrCode();
    }
    if (options.type === "getOpenId") {
      this.getOpenIdCode();
    }
    if (options.type === "getMiniProgramCode") {
      this.getMiniProgramCode();
    }

    if (options.type === "createCollection") {
      this.getCreateCollectionCode();
    }

    if (options.type === "uploadFile") {
      this.getUploadFileCode();
    }
    this.setData({ type: options?.type, envId: options?.envId });
  },

  copyUrl() {
    wx.setClipboardData({
      data: "https://gitee.com/TencentCloudBase/cloudbase-agent-ui/tree/main/apps/miniprogram-agent-ui/miniprogram/components/agent-ui",
      success: function (res) {
        wx.showToast({
          title: "复制成功",
          icon: "success",
        });
      },
    });
  },

  insertRecord() {
    this.setData({
      showInsertModal: true,
      insertRegion: "",
      insertCity: "",
      insertSales: "",
    });
  },

  deleteRecord(e) {
    console.log("deleteRecord e", e);
    wx.showLoading({ title: "删除中..." });
    try {
      const id = e.currentTarget.dataset.id;
      let rec = [];
      try {
        rec = wx.getStorageSync("app_example_records") || [];
        if (!Array.isArray(rec)) rec = [];
      } catch (err) {
        rec = [];
      }
      const next = rec.filter((it) => it && it._id !== id);
      try {
        wx.setStorageSync("app_example_records", next);
      } catch (_) {}
      wx.showToast({ title: "删除成功" });
      this.getRecord(); // 刷新列表
    } catch (err) {
      wx.showToast({ title: "删除失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  // 输入框事件
  onInsertRegionInput(e) {
    this.setData({ insertRegion: e.detail.value });
  },
  onInsertCityInput(e) {
    this.setData({ insertCity: e.detail.value });
  },
  onInsertSalesInput(e) {
    this.setData({ insertSales: e.detail.value });
  },
  // 取消弹窗
  onInsertCancel() {
    this.setData({ showInsertModal: false });
  },

  // 确认插入
  async onInsertConfirm() {
    const { insertRegion, insertCity, insertSales } = this.data;
    if (!insertRegion || !insertCity || !insertSales) {
      wx.showToast({ title: "请填写完整信息", icon: "none" });
      return;
    }
    wx.showLoading({ title: "插入中..." });
    try {
      let rec = [];
      try {
        rec = wx.getStorageSync("app_example_records") || [];
        if (!Array.isArray(rec)) rec = [];
      } catch (_) {
        rec = [];
      }
      const item = {
        _id: "id_" + Date.now() + "_" + Math.floor(Math.random() * 1e5),
        region: insertRegion,
        city: insertCity,
        sales: Number(insertSales),
      };
      const next = rec.concat(item);
      try {
        wx.setStorageSync("app_example_records", next);
      } catch (_) {}
      wx.showToast({ title: "插入成功" });
      this.setData({ showInsertModal: false });
      this.getRecord(); // 刷新列表
    } catch (e) {
      wx.showToast({ title: "插入失败", icon: "none" });
    } finally {
      wx.hideLoading();
    }
  },

  getOpenId() {
    wx.showLoading({ title: "" });
    // 使用 wx.login 的 code 或本地生成 openid 作为占位
    wx.login({
      success: (res) => {
        const oid = res.code ? `LOCAL_OPENID_${res.code}` : `LOCAL_OPENID_${Date.now()}`;
        this.setData({ haveGetOpenId: true, openId: oid });
      },
      complete: () => wx.hideLoading(),
    });
  },

  clearOpenId() {
    this.setData({
      haveGetOpenId: false,
      openId: "",
    });
  },

  clearCallContainerRes() {
    this.setData({
      haveGetCallContainerRes: false,
      callContainerResStr: "",
    });
  },

  getCodeSrc() {
    wx.showLoading({ title: "" });
    // 使用公开二维码服务生成可展示图片
    const data = encodeURIComponent("pages/index/index");
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${data}`;
    this.setData({ haveGetCodeSrc: true, codeSrc: url });
    wx.hideLoading();
  },

  clearCodeSrc() {
    this.setData({
      haveGetCodeSrc: false,
      codeSrc: "",
    });
  },

  bindInput(e) {
    const index = e.currentTarget.dataset.index;
    const record = this.data.record;
    record[index].sales = Number(e.detail.value);
    this.setData({
      record,
    });
  },

  getRecord() {
    wx.showLoading({ title: "" });
    try {
      let rec = [];
      try {
        rec = wx.getStorageSync("app_example_records") || [];
        if (!Array.isArray(rec)) rec = [];
      } catch (_) {
        rec = [];
      }
      this.setData({ haveGetRecord: true, record: rec });
    } finally {
      wx.hideLoading();
    }
  },

  clearRecord() {
    this.setData({
      haveGetRecord: false,
      record: [],
    });
  },
  updateRecord() {
    wx.showLoading({ title: "" });
    try {
      const rec = Array.isArray(this.data.record) ? this.data.record : [];
      try {
        wx.setStorageSync("app_example_records", rec);
      } catch (_) {}
      wx.showToast({ title: "更新成功" });
    } catch (e) {
      console.log(e);
      this.setData({ showUploadTip: true });
    } finally {
      wx.hideLoading();
    }
  },

  uploadImg() {
    wx.showLoading({ title: "" });
    // 让用户选择一张图片并直接显示临时路径
    wx.chooseMedia({
      count: 1,
      success: (chooseResult) => {
        const path = chooseResult?.tempFiles?.[0]?.tempFilePath || "";
        if (path) {
          this.setData({ haveGetImgSrc: true, imgSrc: path });
        } else {
          wx.showToast({ title: "未选择图片", icon: "none" });
        }
      },
      complete: () => wx.hideLoading(),
    });
  },

  clearImgSrc() {
    this.setData({
      haveGetImgSrc: false,
      imgSrc: "",
    });
  },

  goOfficialWebsite() {
    const url = "https://docs.cloudbase.net/toolbox/quick-start";
    wx.navigateTo({
      url: `../web/index?url=${url}`,
    });
  },
  runCallContainer: async function () {
    const app = getApp();
    const base = app?.globalData?.apiBase || "";
    if (base) {
      wx.request({
        url: `${base}/api/users`,
        method: "GET",
        success: (r) => {
          const items = r?.data?.items || r?.data || [];
          this.setData({
            haveGetCallContainerRes: true,
            callContainerResStr: `${JSON.stringify(items, null, 2)}`,
          });
        },
        fail: () => {
          // 请求失败则回退本地模拟
          const items = [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }];
          this.setData({
            haveGetCallContainerRes: true,
            callContainerResStr: `${JSON.stringify(items, null, 2)}`,
          });
        },
      });
    } else {
      // 未配置后端时本地模拟数据
      const items = [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }];
      this.setData({
        haveGetCallContainerRes: true,
        callContainerResStr: `${JSON.stringify(items, null, 2)}`,
      });
    }
  },
  getCallcbrCode: function () {
    const app = getApp();
    this.setData({
      callcbrCode: `// 使用普通后端接口（非云开发）
const app = getApp()
const base = app?.globalData?.apiBase || ''
if (base) {
  wx.request({
    url: base + '/api/users',
    method: 'GET',
    success: (r) => {
      const items = r?.data?.items || r?.data || []
      console.log(items)
    }
  })
} else {
  // 未配置后端时使用本地模拟数据
  const items = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]
  console.log(items)
}`,
    });
  },
  getInitEnvCode: function () {
    const app = getApp();
    this.setData({
      initEnvCode: `// 已停用云开发，无需 wx.cloud.init
// 可在 app.js 全局配置普通后端地址
App({
  onLaunch() {
    this.globalData = { apiBase: 'https://your.api.server' }
  }
})`,
    });
  },
  getCreateCollectionCode: function () {
    this.setData({
      callCreateCollectionCode: `// 使用本地存储模拟创建集合（非云开发）
try {
  const init = wx.getStorageSync('app_example_records')
  if (!Array.isArray(init)) {
    wx.setStorageSync('app_example_records', [])
  }
} catch (e) {
  wx.setStorageSync('app_example_records', [])
}
console.log('create collection success')`,
    });
  },
  getOpenIdCode: function () {
    this.setData({
      callOpenIdCode: `// 使用 wx.login 获取 code，并生成本地占位 openid（非云开发）
wx.login({
  success: (res) => {
    const openid = res.code ? 'LOCAL_OPENID_' + res.code : 'LOCAL_OPENID_' + Date.now()
    console.log(openid)
  }
})`,
      callFunctionCode: `// 页面内直接调用
this.getOpenId()`,
    });
  },
  getMiniProgramCode: function () {
    this.setData({
      callMiniProgramCode: `// 使用公开二维码服务生成可展示图片 URL（非云开发）
const data = encodeURIComponent('pages/index/index')
const url = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=' + data
console.log(url)`,
      callFunctionCode: `// 页面内直接调用
this.getCodeSrc()`,
    });
  },
  getUploadFileCode: function () {
    this.setData({
      callUploadFileCode: `// 选择图片并使用临时路径展示（非云开发）
wx.chooseMedia({
  count: 1,
  success: (chooseResult) => {
    const path = chooseResult?.tempFiles?.[0]?.tempFilePath
    console.log(path)
  }
});`,
    });
  },
});
