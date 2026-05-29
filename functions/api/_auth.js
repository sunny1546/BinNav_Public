/**
 * API Key 鉴权工具函数 (EdgeOne)
 * 用途: 检查请求头中的 X-API-Key 是否匹配 OPENCLAW_KEY 环境变量
 * 范围: 仅用于数据导出、WebDAV备份、新增站点等接口
 * 隔离性: 不影响前台 ADMIN_PASSWORD 的 UI 登录逻辑
 */

export function verifyApiKey(request, env) {
  const apiKey = request.headers.get('X-API-Key') || request.headers.get('x-api-key')
  if (!apiKey) return false

  const openclawKey = env?.OPENCLAW_KEY
  if (!openclawKey) return false

  return apiKey === openclawKey
}
