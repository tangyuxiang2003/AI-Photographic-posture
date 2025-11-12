// 姿势数据配置文件（模拟数据，后续替换为接口）

// 分类数据
const categories = [
  { id: 1, name: '浪漫满屋', icon: '💑' },
  { id: 2, name: '不露脸', icon: '🙈' },
  { id: 3, name: '情侣', icon: '💕' },
  { id: 4, name: '闺蜜', icon: '👭' },
  { id: 5, name: '自拍', icon: '🤳' },
  { id: 6, name: '鲜花', icon: '🌸' },
  { id: 7, name: '古灵精怪', icon: '😜' },
  { id: 8, name: '创意照', icon: '💡' },
  { id: 9, name: '超市', icon: '🛒' },
  { id: 10, name: '合照', icon: '👥' }
]

// 姿势数据（模拟数据）
const poses = {
  // 本地 Pose
  local: [
    { id: 'local_1', name: '本地姿势1', image: '/images/placeholder.png', category: 'local' },
    { id: 'local_2', name: '本地姿势2', image: '/images/placeholder.png', category: 'local' },
    { id: 'local_3', name: '本地姿势3', image: '/images/placeholder.png', category: 'local' }
  ],
  
  // 美少女
  beauty: [
    { id: 'beauty_1', name: '美少女姿势1', image: '/images/placeholder.png', category: 'beauty', description: '优雅的美少女姿势' },
    { id: 'beauty_2', name: '美少女姿势2', image: '/images/placeholder.png', category: 'beauty', description: '甜美的美少女姿势' },
    { id: 'beauty_3', name: '美少女姿势3', image: '/images/placeholder.png', category: 'beauty', description: '活泼的美少女姿势' },
    { id: 'beauty_4', name: '美少女姿势4', image: '/images/placeholder.png', category: 'beauty', description: '清新的美少女姿势' }
  ],
  
  // 自拍分类
  selfie: [
    { id: 'selfie_1', name: '自拍姿势1', image: '/images/placeholder.png', category: 'selfie', description: '经典自拍角度' },
    { id: 'selfie_2', name: '自拍姿势2', image: '/images/placeholder.png', category: 'selfie', description: '俏皮自拍姿势' },
    { id: 'selfie_3', name: '自拍姿势3', image: '/images/placeholder.png', category: 'selfie', description: '侧脸自拍' },
    { id: 'selfie_4', name: '自拍姿势4', image: '/images/placeholder.png', category: 'selfie', description: '镜面自拍' },
    { id: 'selfie_5', name: '自拍姿势5', image: '/images/placeholder.png', category: 'selfie', description: '创意自拍' },
    { id: 'selfie_6', name: '自拍姿势6', image: '/images/placeholder.png', category: 'selfie', description: '街拍自拍' }
  ],
  
  // 情侣分类
  couple: [
    { id: 'couple_1', name: '情侣姿势1', image: '/images/placeholder.png', category: 'couple', description: '浪漫牵手' },
    { id: 'couple_2', name: '情侣姿势2', image: '/images/placeholder.png', category: 'couple', description: '背影合照' },
    { id: 'couple_3', name: '情侣姿势3', image: '/images/placeholder.png', category: 'couple', description: '甜蜜拥抱' },
    { id: 'couple_4', name: '情侣姿势4', image: '/images/placeholder.png', category: 'couple', description: '对视瞬间' }
  ]
}

// 获取分类列表
function getCategories() {
  return categories
}

// 获取指定分类的姿势（前N张）
function getPosesByCategory(categoryKey, limit = 6) {
  const categoryPoses = poses[categoryKey] || []
  return limit ? categoryPoses.slice(0, limit) : categoryPoses
}

// 获取指定分类的所有姿势
function getAllPosesByCategory(categoryKey) {
  return poses[categoryKey] || []
}

// 搜索姿势
function searchPoses(keyword) {
  const results = []
  Object.keys(poses).forEach(categoryKey => {
    poses[categoryKey].forEach(pose => {
      if (pose.name.includes(keyword) || pose.description?.includes(keyword)) {
        results.push(pose)
      }
    })
  })
  return results
}

// 根据ID获取姿势详情
function getPoseById(poseId) {
  let foundPose = null
  Object.keys(poses).forEach(categoryKey => {
    const pose = poses[categoryKey].find(p => p.id === poseId)
    if (pose) {
      foundPose = pose
    }
  })
  return foundPose
}

module.exports = {
  getCategories,
  getPosesByCategory,
  getAllPosesByCategory,
  searchPoses,
  getPoseById
}