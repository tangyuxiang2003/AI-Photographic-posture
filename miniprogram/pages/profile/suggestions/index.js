Page({
  data: {
    input: '',
    canSubmit: false,
    suggestions: []
  },

  onLoad() {
    this.loadSuggestions();
  },
  onShow() {
    this.loadSuggestions();
  },
  onPullDownRefresh() {
    this.loadSuggestions();
    wx.stopPullDownRefresh();
  },

  onInput(e) {
    const v = (e && e.detail && e.detail.value || '').trimStart();
    this.setData({
      input: v,
      canSubmit: v.trim().length > 0
    });
  },

  loadSuggestions() {
    let list = [];
    try {
      const cached = wx.getStorageSync('user_suggestions');
      if (Array.isArray(cached)) {
        list = cached.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      }
    } catch (e) {}
    this.setData({ suggestions: list });
  },

  onSubmit() {
    const text = (this.data.input || '').trim();
    if (!text) {
      wx.showToast({ title: '请输入内容', icon: 'none' });
      return;
    }
    const now = Date.now();
    const rec = {
      id: `${now}_${Math.random().toString(36).slice(2,8)}`,
      content: text,
      createdAt: now,
      readableTime: this.formatTime(now)
    };
    let list = [];
    try {
      const cached = wx.getStorageSync('user_suggestions');
      list = Array.isArray(cached) ? cached : [];
    } catch (e) {}
    list.unshift(rec);
    try { wx.setStorageSync('user_suggestions', list); } catch (e) {}
    this.setData({ input: '', canSubmit: false, suggestions: list });
    wx.showToast({ title: '已提交', icon: 'success' });
  },

  formatTime(ts) {
    try {
      const d = new Date(ts);
      const pad = (n) => (n < 10 ? '0' + n : '' + n);
      const y = d.getFullYear();
      const m = pad(d.getMonth() + 1);
      const day = pad(d.getDate());
      const h = pad(d.getHours());
      const mi = pad(d.getMinutes());
      return `${y}-${m}-${day} ${h}:${mi}`;
    } catch (e) {
      return '';
    }
  }
});