/**
 * 数据同步工具
 * 用于在用户登录后从后端同步收藏、历史等数据
 */

const { get, post } = require('./request');
const { getAuth } = require('./storage');

/**
 * 同步用户收藏列表
 * @returns {Promise<Array>} 收藏列表
 */
async function syncFavorites() {
  try {
    const auth = getAuth();
    if (!auth || !auth.userId) {
      console.log('[sync] 未登录，跳过收藏同步');
      return [];
    }

    // 从后端获取收藏列表
    const res = await get('/api/collection/list');
    
    let responseData = res.data;
    if (typeof responseData === 'string') {
      try { responseData = JSON.parse(responseData); } catch(e) {}
    }

    const ok = responseData && (
      responseData.code === 0 || 
      responseData.code === 200 || 
      responseData.success === true
    );

    if (!ok) {
      console.warn('[sync] 获取收藏列表失败:', responseData.msg);
      return [];
    }

    const items = Array.isArray(responseData.data) ? responseData.data : [];
    
    // 转换为本地格式
    const favorites = items.map(item => ({
      id: item.aiImageId || item.id,
      title: item.title || 'AI生成图',
      cover: item.aiImageUrl || item.imageUrl || item.cover,
      tags: item.tags || [],
      type: item.type || 'AI',
      createdAt: item.createdAt || item.createTime
    })).filter(item => item.cover); // 过滤掉没有图片的项

    // 保存到本地
    const urls = favorites.map(f => f.cover);
    try {
      wx.setStorageSync('favorites', urls);
      wx.setStorageSync('app_favorites', favorites);
      console.log('[sync] 收藏同步成功，共', favorites.length, '项');
    } catch (e) {
      console.error('[sync] 保存收藏到本地失败:', e);
    }

    return favorites;
  } catch (err) {
    console.error('[sync] 同步收藏失败:', err);
    return [];
  }
}

/**
 * 同步用户生成历史
 * @returns {Promise<Array>} 历史记录列表
 */
async function syncHistory() {
  try {
    const auth = getAuth();
    if (!auth || !auth.userId) {
      console.log('[sync] 未登录，跳过历史同步');
      return [];
    }

    // 从后端获取生成历史
    const res = await get('/api/image/history');
    
    let responseData = res.data;
    if (typeof responseData === 'string') {
      try { responseData = JSON.parse(responseData); } catch(e) {}
    }

    const ok = responseData && (
      responseData.code === 0 || 
      responseData.code === 200 || 
      responseData.success === true
    );

    if (!ok) {
      console.warn('[sync] 获取历史记录失败:', responseData.msg);
      return [];
    }

    const items = Array.isArray(responseData.data) ? responseData.data : [];
    
    // 转换为本地格式
    const history = items.map(item => ({
      id: item.id,
      imageUrl: item.aiImageUrl || item.imageUrl,
      prompt: item.content || item.prompt,
      createdAt: item.createdAt || item.createTime
    })).filter(item => item.imageUrl);

    // 保存到本地
    try {
      wx.setStorageSync('app_history', history);
      console.log('[sync] 历史同步成功，共', history.length, '项');
    } catch (e) {
      console.error('[sync] 保存历史到本地失败:', e);
    }

    return history;
  } catch (err) {
    console.error('[sync] 同步历史失败:', err);
    return [];
  }
}

/**
 * 同步用户个人信息
 * @returns {Promise<Object>} 用户信息
 */
async function syncUserProfile() {
  try {
    const auth = getAuth();
    if (!auth || !auth.userId) {
      console.log('[sync] 未登录，跳过个人信息同步');
      return null;
    }

    // 从后端获取用户信息
    const res = await get('/api/user/profile');
    
    let responseData = res.data;
    if (typeof responseData === 'string') {
      try { responseData = JSON.parse(responseData); } catch(e) {}
    }

    const ok = responseData && (
      responseData.code === 0 || 
      responseData.code === 200 || 
      responseData.success === true
    );

    if (!ok) {
      console.warn('[sync] 获取用户信息失败:', responseData.msg);
      return null;
    }

    const userInfo = responseData.data || {};
    
    // 更新本地用户信息（保留本地头像昵称，仅同步后端特有字段）
    try {
      const localProfile = wx.getStorageSync('profile_basic') || {};
      const merged = {
        ...localProfile,
        userId: userInfo.id || userInfo.userId || localProfile.userId,
        // 如果后端有头像昵称且本地为空，则使用后端的
        avatarUrl: localProfile.avatarUrl || userInfo.avatarUrl || '',
        nickName: localProfile.nickName || userInfo.nickName || '微信昵称',
        hasAuth: true
      };
      wx.setStorageSync('profile_basic', merged);
      console.log('[sync] 用户信息同步成功');
      return merged;
    } catch (e) {
      console.error('[sync] 保存用户信息到本地失败:', e);
    }

    return userInfo;
  } catch (err) {
    console.error('[sync] 同步用户信息失败:', err);
    return null;
  }
}

/**
 * 完整同步所有数据
 * 建议在登录成功后调用
 */
async function syncAll() {
  console.log('[sync] 开始完整数据同步...');
  
  const results = await Promise.allSettled([
    syncUserProfile(),
    syncFavorites(),
    syncHistory()
  ]);

  const [profileResult, favoritesResult, historyResult] = results;

  const summary = {
    profile: profileResult.status === 'fulfilled' ? profileResult.value : null,
    favorites: favoritesResult.status === 'fulfilled' ? favoritesResult.value : [],
    history: historyResult.status === 'fulfilled' ? historyResult.value : [],
    success: results.every(r => r.status === 'fulfilled')
  };

  console.log('[sync] 数据同步完成:', {
    profileSynced: !!summary.profile,
    favoritesCount: summary.favorites.length,
    historyCount: summary.history.length,
    allSuccess: summary.success
  });

  return summary;
}

module.exports = {
  syncFavorites,
  syncHistory,
  syncUserProfile,
  syncAll
};