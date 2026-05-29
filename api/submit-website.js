/**
 * Vercel API Route - 提交网站
 * 路由: /api/submit-website
 * 用途: 接收用户提交的站点
 *   - 普通用户：保存到待审核列表
 *   - API Key 认证（X-API-Key 匹配 OPENCLAW_KEY）：直接写入正式数据，跳过审核
 */

import { verifyApiKey } from './_auth.js'

export const config = {
  runtime: 'edge',
}

export default async function handler(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, message: '只支持POST请求' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // API Key 鉴权
  const apiKeyHeader = request.headers.get('X-API-Key') || request.headers.get('x-api-key')
  const isApiKeyAuth = apiKeyHeader && verifyApiKey(request, { OPENCLAW_KEY: process.env.OPENCLAW_KEY })

  if (apiKeyHeader && !isApiKeyAuth) {
    return new Response(JSON.stringify({ success: false, message: 'API Key 无效' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN
  const GITHUB_REPO = process.env.GITHUB_REPO

  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    return new Response(JSON.stringify({
      success: false,
      message: 'GITHUB_TOKEN 或 GITHUB_REPO 未配置'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const submissionData = await request.json()
    const { name, url, description, category, tags, icon, contactEmail, submitterName } = submissionData

    // API Key 路径：仅需 name + url
    if (isApiKeyAuth) {
      if (!name || !url) {
        return new Response(JSON.stringify({
          success: false,
          message: '必填字段缺失：name 和 url 为必填'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    } else {
      if (!name || !url) {
        return new Response(JSON.stringify({
          success: false,
          message: '网站名称和URL不能为空'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // URL 处理
    let processedUrl = url.trim()
    if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
      processedUrl = 'https://' + processedUrl
    }

    try {
      new URL(processedUrl)
    } catch {
      return new Response(JSON.stringify({ success: false, message: 'URL格式不正确' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ============================================================
    // API Key 认证路径：直接写入正式数据
    // ============================================================
    if (isApiKeyAuth) {
      const configPath = 'src/data/websiteData.js'

      // 1. 获取当前配置文件
      const fileResponse = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/${configPath}`,
        {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Vercel-Functions/1.0'
          }
        }
      )

      if (!fileResponse.ok) {
        throw new Error(`获取配置文件失败: HTTP ${fileResponse.status}`)
      }

      const fileData = await fileResponse.json()
      const fileSha = fileData.sha
      const cleanBase64 = fileData.content.replace(/\s/g, '')

      let fileContent
      if (typeof atob !== 'undefined') {
        fileContent = decodeURIComponent(escape(atob(cleanBase64)))
      } else {
        fileContent = Buffer.from(cleanBase64, 'base64').toString('utf-8')
      }

      // 2. 解析现有数据
      const websiteDataMatch = fileContent.match(/export const websiteData\s*=\s*(\[[\s\S]*?\]);/)
      const categoriesMatch = fileContent.match(/export const categories\s*=\s*(\[[\s\S]*?\]);/)
      const siteConfigMatch = fileContent.match(/export const siteConfig\s*=\s*({[\s\S]*?});/)

      if (!websiteDataMatch || !categoriesMatch) {
        throw new Error('无法解析当前配置文件')
      }

      const websiteDataArr = JSON.parse(websiteDataMatch[1])
      const categoriesArr = JSON.parse(categoriesMatch[1])
      const siteConfigObj = siteConfigMatch ? JSON.parse(siteConfigMatch[1]) : {}

      // 3. 解析分类，支持动态创建
      let resolvedCategory = (category || '').trim();

      if (resolvedCategory) {
        let foundCategoryId = null;
        for (const cat of categoriesArr) {
          if (cat.subcategories) {
            const existing = cat.subcategories.find(sub => sub.name === resolvedCategory || sub.id === resolvedCategory);
            if (existing) {
              foundCategoryId = existing.id;
              break;
            }
          }
          if (cat.name === resolvedCategory || cat.id === resolvedCategory) {
            foundCategoryId = cat.id;
            break;
          }
        }

        if (foundCategoryId) {
          resolvedCategory = foundCategoryId;
        } else {
          let aiParent = categoriesArr.find(cat => cat.name === 'AI新增');
          if (!aiParent) {
            aiParent = {
              id: `category_ai_${Date.now()}`,
              name: 'AI新增',
              icon: '/assets/____.png',
              special: false,
              subcategories: []
            };
            categoriesArr.push(aiParent);
          }
          if (!aiParent.subcategories) {
            aiParent.subcategories = [];
          }
          const newSubCategory = {
            id: `category_${Date.now()}`,
            name: resolvedCategory,
            icon: '/assets/163___.png',
            special: false
          };
          aiParent.subcategories.push(newSubCategory);
          resolvedCategory = newSubCategory.id;
        }
      } else {
        resolvedCategory = categoriesArr[0]?.id || 'tools';
      }

      const newWebsite = {
        id: Date.now(),
        name: name.trim(),
        description: (description || '').trim(),
        url: processedUrl,
        category: resolvedCategory,
        tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []),
        icon: icon || `https://icon.nbvil.com/favicon?url=${new URL(processedUrl).hostname}`
      }

      websiteDataArr.push(newWebsite)

      // 4. 重新生成配置文件
      const timestamp = new Date().toLocaleString('zh-CN')
      const newFileContent = `// 网站数据 - 通过管理后台更新于 ${timestamp}\n\n// 站点配置\nexport const siteConfig = ${JSON.stringify(siteConfigObj, null, 2)};\n\nexport const websiteData = ${JSON.stringify(websiteDataArr, null, 2)};\n\n// 分类定义 - 支持二级分类\nexport const categories = ${JSON.stringify(categoriesArr, null, 2)};\n\n// 搜索引擎配置\nexport const searchEngines = [\n  { id: "bing", name: "必应", url: "https://www.bing.com/search?q=", color: "bg-blue-600" },\n  { id: "baidu", name: "百度", url: "https://www.baidu.com/s?wd=", color: "bg-red-600" },\n  { id: "google", name: "谷歌", url: "https://www.google.com/search?q=", color: "bg-green-600" },\n  { id: "internal", name: "站内搜索", url: "", color: "bg-purple-600" }\n];\n\n// 推荐内容配置\nexport const recommendations = [\n  {\n    id: 1,\n    title: "阿里云",\n    description: "点击领取2000元限量云产品优惠券",\n    url: "https://aliyun.com",\n    type: "sponsor",\n    color: "from-blue-50 to-blue-100"\n  },\n  {\n    id: 2,\n    title: "设计资源",\n    description: "高质量设计素材网站推荐",\n    url: "#design_resources",\n    type: "internal",\n    color: "from-green-50 to-green-100"\n  }\n];\n\n// 热门标签\nexport const popularTags = [\n  "设计工具", "免费素材", "UI设计", "前端开发", "图标库", "配色方案",\n  "设计灵感", "原型工具", "代码托管", "学习平台", "社区论坛", "创业资讯"\n];\n\n// 网站统计信息\nexport const siteStats = {\n  totalSites: websiteData.length,\n  totalCategories: categories.length,\n  totalTags: [...new Set(websiteData.flatMap(site => site.tags || []))].length,\n  lastUpdated: "${new Date().toISOString().split('T')[0]}"\n};\n`

      // 5. 提交到 GitHub
      let encodedContent
      if (typeof btoa !== 'undefined') {
        encodedContent = btoa(unescape(encodeURIComponent(newFileContent)))
      } else {
        encodedContent = Buffer.from(newFileContent, 'utf-8').toString('base64')
      }

      const commitResponse = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/${configPath}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'Vercel-Functions/1.0'
          },
          body: JSON.stringify({
            message: `✅ 直接添加站点: ${name} (via API Key)`,
            content: encodedContent,
            sha: fileSha
          })
        }
      )

      if (!commitResponse.ok) {
        const errorText = await commitResponse.text()
        throw new Error(`GitHub提交失败: ${commitResponse.status} - ${errorText}`)
      }

      const commitResult = await commitResponse.json()

      return new Response(JSON.stringify({
        success: true,
        message: '站点已直接添加到正式数据，部署将在1-2分钟后生效',
        mode: 'direct',
        data: {
          id: newWebsite.id,
          name: newWebsite.name,
          url: newWebsite.url,
          category: newWebsite.category,
          tags: newWebsite.tags,
          icon: newWebsite.icon
        },
        commit: {
          sha: commitResult.commit?.sha,
          message: commitResult.commit?.message
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ============================================================
    // 普通用户路径：返回待审核响应
    // ============================================================
    const pendingWebsite = {
      id: Date.now().toString(),
      name: name.trim(),
      url: processedUrl,
      description: description ? description.trim() : '',
      category: category || 'tools',
      submitterEmail: contactEmail ? contactEmail.trim() : '',
      submittedAt: new Date().toISOString(),
      status: 'pending'
    }

    return new Response(JSON.stringify({
      success: true,
      message: '网站提交成功！我们会尽快审核您的提交。',
      mode: 'pending',
      data: {
        submissionId: pendingWebsite.id,
        website: {
          name: pendingWebsite.name,
          url: pendingWebsite.url,
          description: pendingWebsite.description,
          category: pendingWebsite.category
        },
        submittedAt: pendingWebsite.submittedAt
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: '提交失败: ' + error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}
