# 解决 "this.loadStats is not a function" 错误

## 问题原因
小程序开发者工具的缓存导致代码没有正确更新。

## 解决方案

### 方案 1：清除缓存并重新编译（推荐）

1. **停止当前编译**
   - 点击开发者工具右上角的"停止"按钮

2. **清除缓存**
   - 点击菜单栏：`工具` → `清除缓存` → `清除全部缓存`
   - 或者点击：`项目` → `清除缓存` → `清除全部缓存`

3. **重新编译**
   - 点击"编译"按钮
   - 或按快捷键 `Ctrl + B` (Windows) / `Cmd + B` (Mac)

### 方案 2：重启开发者工具

1. 完全关闭微信开发者工具
2. 重新打开项目
3. 等待自动编译完成

### 方案 3：删除本地编译文件

1. 关闭开发者工具
2. 找到项目目录
3. 删除以下文件夹（如果存在）：
   - `.tea/`
   - `node_modules/.cache/`
4. 重新打开项目

### 方案 4：手动保存文件

1. 打开 `miniprogram/pages/profile/index.js`
2. 在文件中做一个小改动（比如添加一个空格）
3. 保存文件 (`Ctrl + S` / `Cmd + S`)
4. 撤销改动
5. 再次保存

### 方案 5：检查文件是否正确保存

确认 `miniprogram/pages/profile/index.js` 文件中包含以下代码：

```javascript
// 第 68-90 行应该有这个方法
loadStats() {
  try {
    // 从本地存储读取收藏数量
    const favorites = wx.getStorageSync('app_favorites') || [];
    const favCount = Array.isArray(favorites) ? favorites.length : 0;
    
    // 从本地存储读取照片数量（如果有的话）
    const photos = wx.getStorageSync('generated_images') || [];
    const photoCount = Array.isArray(photos) ? photos.length : 0;
    
    this.setData({
      stats: {
        photos: photoCount,
        favorites: favCount,
        following: 0
      }
    });
    
    console.log('[profile] 统计数据加载:', { photos: photoCount, favorites: favCount });
  } catch (e) {
    console.error('[profile] 加载统计数据失败:', e);
  }
},
```

## 验证修复

修复后，在控制台应该能看到：
```
[profile] 统计数据加载: { photos: 0, favorites: 0 }
```

如果看到这个日志，说明方法已经正常工作了。

## 如果问题仍然存在

请尝试以下步骤：

1. **检查文件编码**
   - 确保文件使用 UTF-8 编码
   - 检查是否有隐藏字符

2. **检查语法错误**
   - 在开发者工具的"调试器"标签查看是否有其他错误
   - 确保所有方法的逗号、括号都正确闭合

3. **使用真机调试**
   - 点击"真机调试"
   - 在真机上测试是否正常

4. **更新开发者工具**
   - 检查是否有新版本的微信开发者工具
   - 更新到最新版本

## 临时解决方案

如果以上方法都不行，可以临时在 `onShow` 中直接写入代码：

```javascript
onShow() {
  this.loadProfile();
  
  // 临时直接加载统计数据
  try {
    const favorites = wx.getStorageSync('app_favorites') || [];
    const favCount = Array.isArray(favorites) ? favorites.length : 0;
    const photos = wx.getStorageSync('generated_images') || [];
    const photoCount = Array.isArray(photos) ? photos.length : 0;
    this.setData({
      stats: {
        photos: photoCount,
        favorites: favCount,
        following: 0
      }
    });
  } catch (e) {}
  
  // 其余代码...
}
```

这样可以先让功能运行起来，之后再排查为什么方法调用不生效。