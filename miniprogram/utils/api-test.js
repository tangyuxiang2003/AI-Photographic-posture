/**
 * API 接口测试工具
 * 用于调试后端接口权限问题
 */

const { get, post } = require('./request');
const { getAuth } = require('./storage');

/**
 * 测试所有需要认证的接口
 */
async function testAllApis() {
  const auth = getAuth();
  console.log('[api-test] 当前认证信息:', {
    hasToken: !!auth?.token,
    tokenPreview: auth?.token ? auth.token.substring(0, 30) + '...' : '无',
    userId: auth?.userId
  });

  const results = {
    collection: { success: false, error: null, data: null },
    userProfile: { success: false, error: null, data: null },
    imageHistory: { success: false, error: null, data: null }
  };

  // 测试收藏接口
  try {
    console.log('[api-test] 测试收藏接口...');
    const res = await get('/api/collection/list');
    results.collection.success = res.statusCode === 200;
    results.collection.data = res.data;
    console.log('[api-test] 收藏接口结果:', res.statusCode, res.data);
  } catch (err) {
    results.collection.error = err;
    console.error('[api-test] 收藏接口失败:', err);
  }

  // 测试用户信息接口
  try {
    console.log('[api-test] 测试用户信息接口...');
    const res = await get('/api/user/profile');
    results.userProfile.success = res.statusCode === 200;
    results.userProfile.data = res.data;
    console.log('[api-test] 用户信息接口结果:', res.statusCode, res.data);
  } catch (err) {
    results.userProfile.error = err;
    console.error('[api-test] 用户信息接口失败:', err);
  }

  // 测试历史记录接口
  try {
    console.log('[api-test] 测试历史记录接口...');
    const res = await get('/api/image/history');
    results.imageHistory.success = res.statusCode === 200;
    results.imageHistory.data = res.data;
    console.log('[api-test] 历史记录接口结果:', res.statusCode, res.data);
  } catch (err) {
    results.imageHistory.error = err;
    console.error('[api-test] 历史记录接口失败:', err);
  }

  // 汇总结果
  console.log('[api-test] 测试完成，结果汇总:', {
    collection: results.collection.success ? '✓' : '✗',
    userProfile: results.userProfile.success ? '✓' : '✗',
    imageHistory: results.imageHistory.success ? '✓' : '✗'
  });

  return results;
}

/**
 * 测试不同的请求方式
 */
async function testUserProfileVariants() {
  const auth = getAuth();
  console.log('[api-test] 测试用户信息接口的不同调用方式...');

  // 方式1: 不带任何参数
  try {
    console.log('[api-test] 方式1: GET /api/user/profile (无参数)');
    const res = await get('/api/user/profile', {});
    console.log('[api-test] 结果:', res.statusCode, res.data);
  } catch (err) {
    console.error('[api-test] 失败:', err.statusCode, err.data);
  }

  // 方式2: 显式传 userId
  try {
    console.log('[api-test] 方式2: GET /api/user/profile?userId=' + auth.userId);
    const res = await get('/api/user/profile', { userId: auth.userId });
    console.log('[api-test] 结果:', res.statusCode, res.data);
  } catch (err) {
    console.error('[api-test] 失败:', err.statusCode, err.data);
  }

  // 方式3: POST 方式
  try {
    console.log('[api-test] 方式3: POST /api/user/profile');
    const res = await post('/api/user/profile', { userId: auth.userId });
    console.log('[api-test] 结果:', res.statusCode, res.data);
  } catch (err) {
    console.error('[api-test] 失败:', err.statusCode, err.data);
  }

  // 方式4: 尝试 /api/user/info
  try {
    console.log('[api-test] 方式4: GET /api/user/info');
    const res = await get('/api/user/info', { userId: auth.userId });
    console.log('[api-test] 结果:', res.statusCode, res.data);
  } catch (err) {
    console.error('[api-test] 失败:', err.statusCode, err.data);
  }
}

module.exports = {
  testAllApis,
  testUserProfileVariants
};