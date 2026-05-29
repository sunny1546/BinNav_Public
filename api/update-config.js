/**
 * Vercel API Route - 更新配置文件
 * 路由: /api/update-config
 * 用途: 更新websiteData.js文件内容，触发重新部署
 * 鉴权: 支持 X-API-Key 头部认证（匹配 OPENCLAW_KEY 环境变量）
 */

import { verifyApiKey } from './_auth.js'

export const config = {
  runtime: 'edge',
}

// Base64 编码函数（纯JavaScript实现，兼容所有环境）
function base64Encode(str) {
  try {
    // 尝试使用标准btoa函数
    if (typeof btoa !== 'undefined') {
      return btoa(unescape(encodeURIComponent(str)));
    }
    
    // 尝试使用Node.js Buffer
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(str, 'utf-8').toString('base64');
    }
    
    // 纯JavaScript实现的Base64编码
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    
    // 先处理UTF-8编码
    const utf8Str = unescape(encodeURIComponent(str));
    let result = '';
    let i = 0;
    
    while (i < utf8Str.length) {
      const a = utf8Str.charCodeAt(i++);
      const b = i < utf8Str.length ? utf8Str.charCodeAt(i++) : 0;
      const c = i < utf8Str.length ? utf8Str.charCodeAt(i++) : 0;
      
      const bitmap = (a << 16) | (b << 8) | c;
      
      result += chars.charAt((bitmap >> 18) & 63);
      result += chars.charAt((bitmap >> 12) & 63);
      result += chars.charAt((bitmap >> 6) & 63);
      result += chars.charAt(bitmap & 63);
    }
    
    // 添加填充
    const padLength = str.length % 3;
    if (padLength === 1) {
      result = result.slice(0, -2) + '==';
    } else if (padLength === 2) {
      result = result.slice(0, -1) + '=';
    }
    
    return result;
    
  } catch (error) {
    console.error('Base64编码失败:', error);
    throw new Error(`Base64编码失败: ${error.message}`);
  }
}

export default async function handler(request, response) {
  // 处理CORS
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({
      success: false,
      error: 'Method not allowed',
      message: '只支持POST请求'
    });
  }

  // API Key 鉴权：若请求头包含 X-API-Key，则必须匹配
  const apiKeyHeader = request.headers['x-api-key'];
  if (apiKeyHeader) {
    const openclawKey = process.env.OPENCLAW_KEY;
    if (!openclawKey || apiKeyHeader !== openclawKey) {
      return response.status(401).json({
        success: false,
        message: 'API Key 无效'
      });
    }
  }

  // 获取环境变量
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_REPO = process.env.GITHUB_REPO;

  if (!GITHUB_TOKEN) {
    return response.status(500).json({
      success: false,
      error: 'GITHUB_TOKEN未配置',
      message: '请在Vercel项目中配置GITHUB_TOKEN环境变量'
    });
  }

  if (!GITHUB_REPO) {
    return response.status(500).json({
      success: false,
      error: 'GITHUB_REPO未配置',
      message: '请在Vercel项目中配置GITHUB_REPO环境变量'
    });
  }

  try {
    // 解析请求数据
    const { content, sha } = request.body;
    
    if (!content) {
      throw new Error('配置内容不能为空');
    }

    if (!sha) {
      throw new Error('文件SHA值不能为空');
    }

    // Base64编码内容
    const encodedContent = base64Encode(content);
    
    // 更新GitHub文件
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/src/data/websiteData.js`;
    
    const updateData = {
      message: `🔄 Update website configuration - ${new Date().toISOString()}`,
      content: encodedContent,
      sha: sha
    };

    const githubResponse = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Vercel-Functions/1.0'
      },
      body: JSON.stringify(updateData)
    });

    if (!githubResponse.ok) {
      const errorText = await githubResponse.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { message: errorText };
      }
      
      throw new Error(`GitHub API错误: ${githubResponse.status} ${githubResponse.statusText} - ${errorData.message || errorText}`);
    }

    const result = await githubResponse.json();
    
    return response.status(200).json({
      success: true,
      message: '配置更新成功！',
      data: {
        commit: {
          sha: result.commit.sha,
          url: result.commit.html_url,
          message: result.commit.message
        },
        file: {
          path: result.content.path,
          sha: result.content.sha,
          size: result.content.size
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('更新配置失败:', error);
    
    return response.status(500).json({
      success: false,
      error: '更新配置失败',
      message: error.message,
      debug: {
        timestamp: new Date().toISOString(),
        errorName: error.name,
        githubRepo: GITHUB_REPO ? '已配置' : '未配置',
        githubToken: GITHUB_TOKEN ? '已配置' : '未配置'
      }
    });
  }
}
