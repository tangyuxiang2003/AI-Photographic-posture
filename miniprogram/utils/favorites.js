// 本地收藏工具（仅前端）：兼容现有缓存键 'app_favorites'
const KEY = 'app_favorites';

function getAll() {
  try { return wx.getStorageSync(KEY) || []; } catch { return []; }
}

function saveAll(list) {
  try { wx.setStorageSync(KEY, Array.isArray(list) ? list : []); } catch (_) {}
}

function upsertFavorite(fav) {
  // fav: { id, title, cover, tags: [] }
  const list = getAll();
  const i = list.findIndex(x => x.id === fav.id);
  if (i >= 0) list[i] = { ...list[i], ...fav };
  else list.unshift({ ...fav, createdAt: Date.now() });
  saveAll(list);
  return list;
}

function setPhotoTags(photoId, tags) {
  const list = getAll();
  const i = list.findIndex(x => x.id === photoId);
  if (i < 0) return list;
  list[i].tags = Array.isArray(tags) ? tags : [];
  saveAll(list);
  return list;
}

function removeFavorite(photoId) {
  const list = getAll().filter(x => x.id !== photoId);
  saveAll(list);
  return list;
}

module.exports = { getAll, saveAll, upsertFavorite, setPhotoTags, removeFavorite };