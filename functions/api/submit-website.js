/**
 * EdgeOne Functions - 站点提交
 * 路由: /api/submit-website
 * 用途: 接收用户提交的站点
 *   - 普通用户：保存到待审核列表并发送邮件通知
 *   - API Key 认证（X-API-Key 匹配 OPENCLAW_KEY）：直接写入正式数据，跳过审核
 */

import { verifyApiKey } from './_auth.js'

// 处理OPTIONS请求（CORS预检）
export async function onRequestOptions({ request }) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
      'Access-Control-Max-Age': '86400'
    }
  });
}

// 处理POST请求
export async function onRequestPost({ request, env }) {
  const { GITHUB_TOKEN, GITHUB_REPO } = env;
  const RESEND_API_KEY = env.RESEND_API_KEY;
  const ADMIN_EMAIL = env.ADMIN_EMAIL;
  const RESEND_DOMAIN = env.RESEND_DOMAIN;

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  // API Key 鉴权
  const apiKeyHeader = request.headers.get('X-API-Key') || request.headers.get('x-api-key')
  const isApiKeyAuth = apiKeyHeader && verifyApiKey(request, env)

  if (apiKeyHeader && !isApiKeyAuth) {
    return new Response(JSON.stringify({ success: false, message: 'API Key 无效' }), {
      status: 401,
      headers: corsHeaders
    });
  }

  // 检查GitHub配置
  if (!GITHUB_TOKEN) {
    return new Response(JSON.stringify({
      success: false,
      message: '请在EdgeOne项目中配置GITHUB_TOKEN环境变量'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }

  if (!GITHUB_REPO) {
    return new Response(JSON.stringify({
      success: false,
      message: '请在EdgeOne项目中配置GITHUB_REPO环境变量'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }

  try {
    const submissionData = await request.json();
    const { name, url, description, category, tags, icon, contactEmail, submitterName } = submissionData;

    // API Key 认证路径：必填字段更少（无需联系邮箱）
    if (isApiKeyAuth) {
      if (!name || !url) {
        return new Response(JSON.stringify({
          success: false,
          message: '必填字段缺失：name 和 url 为必填'
        }), { status: 400, headers: corsHeaders });
      }
    } else {
      if (!name || !url || !description || !category || !contactEmail) {
        return new Response(JSON.stringify({
          success: false,
          message: '请填写所有必填字段'
        }), { status: 400, headers: corsHeaders });
      }
    }

    // URL 处理
    let processedUrl = url.trim();
    if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
      processedUrl = 'https://' + processedUrl;
    }

    try {
      new URL(processedUrl);
    } catch {
      return new Response(JSON.stringify({
        success: false,
        message: '请输入有效的网站链接'
      }), { status: 400, headers: corsHeaders });
    }

    // ============================================================
    // API Key 认证路径：直接写入正式数据（等同管理员手动添加）
    // ============================================================
    if (isApiKeyAuth) {
      // 1. 获取当前 websiteData.js
      const fileResponse = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/src/websiteData.js`,
        {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'BinNav-EdgeOne-Functions'
          }
        }
      );

      if (!fileResponse.ok) {
        throw new Error(`获取配置文件失败: HTTP ${fileResponse.status}`);
      }

      const fileData = await fileResponse.json();
      const fileSha = fileData.sha;
      const cleanBase64 = fileData.content.replace(/\s/g, '');
      const fileContent = decodeURIComponent(escape(atob(cleanBase64)));

      // 2. 解析现有数据
      const websiteDataMatch = fileContent.match(/export const websiteData\s*=\s*(\[[\s\S]*?\]);/);
      const categoriesMatch = fileContent.match(/export const categories\s*=\s*(\[[\s\S]*?\]);/);
      const siteConfigMatch = fileContent.match(/export const siteConfig\s*=\s*({[\s\S]*?});/);

      if (!websiteDataMatch || !categoriesMatch) {
        throw new Error('无法解析当前配置文件');
      }

      const websiteDataArr = JSON.parse(websiteDataMatch[1]);
      const categoriesArr = JSON.parse(categoriesMatch[1]);
      const siteConfigObj = siteConfigMatch ? JSON.parse(siteConfigMatch[1]) : {};

      // 3. 构建新网站条目（格式与管理员手动添加完全一致）
      const newWebsite = {
        id: Date.now(),
        name: name.trim(),
        description: (description || '').trim(),
        url: processedUrl,
        category: (category || categoriesArr[0]?.id || 'tools').trim(),
        tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []),
        icon: icon || `https://icon.nbvil.com/favicon?url=${new URL(processedUrl).hostname}`
      };

      // 4. 追加到数组
      websiteDataArr.push(newWebsite);

      // 5. 重新生成配置文件（与 configGenerator.js 逻辑一致）
      const timestamp = new Date().toLocaleString('zh-CN');
      const newFileContent = `// 网站数据 - 通过管理后台更新于 ${timestamp}

// 站点配置
export const siteConfig = ${JSON.stringify(siteConfigObj, null, 2)};

export const websiteData = ${JSON.stringify(websiteDataArr, null, 2)};

// 分类定义 - 支持二级分类
export const categories = ${JSON.stringify(categoriesArr, null, 2)};

// 搜索引擎配置
export const searchEngines = [
  { id: "bing", name: "必应", url: "https://www.bing.com/search?q=", color: "bg-blue-600" },
  { id: "baidu", name: "百度", url: "https://www.baidu.com/s?wd=", color: "bg-red-600" },
  { id: "google", name: "谷歌", url: "https://www.google.com/search?q=", color: "bg-green-600" },
  { id: "internal", name: "站内搜索", url: "", color: "bg-purple-600" }
];

// 推荐内容配置
export const recommendations = [
  {
    id: 1,
    title: "阿里云",
    description: "点击领取2000元限量云产品优惠券",
    url: "https://aliyun.com",
    type: "sponsor",
    color: "from-blue-50 to-blue-100"
  },
  {
    id: 2,
    title: "设计资源",
    description: "高质量设计素材网站推荐",
    url: "#design_resources",
    type: "internal",
    color: "from-green-50 to-green-100"
  }
];

// 热门标签
export const popularTags = [
  "设计工具", "免费素材", "UI设计", "前端开发", "图标库", "配色方案",
  "设计灵感", "原型工具", "代码托管", "学习平台", "社区论坛", "创业资讯"
];

// 网站统计信息
export const siteStats = {
  totalSites: websiteData.length,
  totalCategories: categories.length,
  totalTags: [...new Set(websiteData.flatMap(site => site.tags || []))].length,
  lastUpdated: "${new Date().toISOString().split('T')[0]}"
};
`;

      // 6. 提交到 GitHub
      const encodedContent = btoa(unescape(encodeURIComponent(newFileContent)));

      const commitResponse = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/src/websiteData.js`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'BinNav-EdgeOne-Functions'
          },
          body: JSON.stringify({
            message: `✅ 直接添加站点: ${name} (via API Key)`,
            content: encodedContent,
            sha: fileSha
          })
        }
      );

      if (!commitResponse.ok) {
        const errorText = await commitResponse.text();
        throw new Error(`GitHub提交失败: ${commitResponse.status} - ${errorText}`);
      }

      const commitResult = await commitResponse.json();

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
      }), { status: 200, headers: corsHeaders });
    }

    // ============================================================
    // 普通用户路径：写入待审核队列
    // ============================================================
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail)) {
      return new Response(JSON.stringify({
        success: false,
        message: '请输入有效的邮箱地址'
      }), { status: 400, headers: corsHeaders });
    }

    const submissionId = Date.now().toString();
    const currentTime = new Date().toISOString();

    const pendingWebsite = {
      id: submissionId,
      name: name.trim(),
      url: processedUrl,
      description: description.trim(),
      category: category.trim(),
      tags: tags ? (typeof tags === 'string' ? tags.trim() : tags.join(',')) : '',
      contactEmail: contactEmail.trim(),
      submitterName: submitterName ? submitterName.trim() : '',
      status: 'pending',
      submittedAt: currentTime
    };

    // 获取现有的待审核文件
    let pendingWebsites = [];
    let fileSha = null;

    try {
      const fileResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/public/pending-websites.json`, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'BinNav-EdgeOne-Functions'
        }
      });

      if (fileResponse.ok) {
        const fileData = await fileResponse.json();
        fileSha = fileData.sha;
        const cleanBase64 = fileData.content.replace(/\s/g, '');
        const content = decodeURIComponent(escape(atob(cleanBase64)));
        pendingWebsites = JSON.parse(content);
      }
    } catch (error) {
      // 使用空列表
    }

    // 检查重复
    const existingSubmission = pendingWebsites.find(site =>
      site.url.toLowerCase() === processedUrl.toLowerCase() ||
      (site.name.toLowerCase() === name.toLowerCase().trim() && site.contactEmail === contactEmail.trim())
    );

    if (existingSubmission) {
      return new Response(JSON.stringify({
        success: false,
        message: '该网站或邮箱已经提交过，请等待审核结果'
      }), { status: 400, headers: corsHeaders });
    }

    pendingWebsites.push(pendingWebsite);

    const jsonString = JSON.stringify(pendingWebsites, null, 2);
    const updatedContent = btoa(unescape(encodeURIComponent(jsonString)));

    const commitResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/public/pending-websites.json`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'BinNav-EdgeOne-Functions'
      },
      body: JSON.stringify({
        message: `新站点提交: ${name}`,
        content: updatedContent,
        sha: fileSha
      })
    });

    if (!commitResponse.ok) {
      const errorText = await commitResponse.text();
      throw new Error(`GitHub更新失败: ${commitResponse.status} ${commitResponse.statusText} - ${errorText}`);
    }

    // 发送邮件通知（仅普通用户路径）
    if (RESEND_API_KEY && ADMIN_EMAIL) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: RESEND_DOMAIN ? `noreply@${RESEND_DOMAIN}` : 'onboarding@resend.dev',
            to: [ADMIN_EMAIL],
            subject: `[BinNav] 新站点提交 - ${name}`,
            html: `<p>新站点待审核: <strong>${name}</strong> - <a href="${processedUrl}">${processedUrl}</a></p><p>分类: ${category} | 提交者: ${contactEmail}</p><p><a href="${request.headers.get('origin') || 'https://binnav.top'}/admin">前往审核</a></p>`
          })
        });
      } catch (e) {
        // 邮件发送失败不影响主流程
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: '站点提交成功！我们将在1-3个工作日内审核您的提交。',
      mode: 'pending',
      submissionId: submissionId
    }), { status: 200, headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: '提交失败: ' + error.message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}
