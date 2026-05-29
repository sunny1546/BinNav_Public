/**
 * EdgeOne Functions - 处理站点审核
 * 路由: /api/process-website-submission
 * 用途: 管理员审核站点提交（通过或拒绝），并发送邮件通知提交者
 * 鉴权: 支持 X-API-Key 头部认证（匹配 OPENCLAW_KEY 环境变量）
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
  const { RESEND_API_KEY, RESEND_DOMAIN } = env;

  // API Key 鉴权：若请求头包含 X-API-Key，则必须匹配
  const apiKeyHeader = request.headers.get('X-API-Key') || request.headers.get('x-api-key')
  if (apiKeyHeader) {
    if (!verifyApiKey(request, env)) {
      return new Response(JSON.stringify({ success: false, message: 'API Key 无效' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }

  try {
    // 解析请求数据
    const requestData = await request.json();
    const { websiteId, action, rejectReason } = requestData;

    if (!websiteId || !action) {
      return new Response(JSON.stringify({
        success: false,
        message: '缺少必要参数'
      }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (!['approve', 'reject'].includes(action)) {
      return new Response(JSON.stringify({
        success: false,
        message: '无效的操作类型'
      }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 通过GitHub API获取待审核站点列表
    const { GITHUB_TOKEN, GITHUB_REPO } = env;
    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      return new Response(JSON.stringify({
        success: false,
        message: 'GitHub配置未完成'
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    let pendingWebsites = [];
    let pendingFileSha = null;

    try {
      const fileResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/public/pending-websites.json`, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'EdgeOne-Functions/1.0'
        }
      });

      if (!fileResponse.ok) {
        return new Response(JSON.stringify({
          success: false,
          message: '未找到待审核站点列表'
        }), {
          status: 404,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      const fileData = await fileResponse.json();
      pendingFileSha = fileData.sha;
      // 清理base64字符串，移除换行符和空格
      const cleanBase64 = fileData.content.replace(/\s/g, '');
      const content = decodeURIComponent(escape(atob(cleanBase64)));
      pendingWebsites = JSON.parse(content);
    } catch (error) {
      console.error('解析待审核数据失败:', error);
      return new Response(JSON.stringify({
        success: false,
        message: '数据格式错误: ' + error.message
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 查找目标网站
    const websiteIndex = pendingWebsites.findIndex(site => site.id == websiteId); // 使用宽松比较
    if (websiteIndex === -1) {
      return new Response(JSON.stringify({
        success: false,
        message: `未找到指定的站点 (ID: ${websiteId})`
      }), {
        status: 404,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const website = pendingWebsites[websiteIndex];

    if (action === 'approve') {
      // 通过审核 - 添加到正式网站列表
      try {
        // 通过GitHub API获取现有配置
        const configResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/src/websiteData.js`, {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'EdgeOne-Functions/1.0'
          }
        });

        if (!configResponse.ok) {
          throw new Error('获取配置文件失败');
        }

        const configFile = await configResponse.json();
        // 清理base64字符串，移除换行符和空格
        const cleanConfigBase64 = configFile.content.replace(/\s/g, '');
        const configContent = decodeURIComponent(escape(atob(cleanConfigBase64)));
        
        // 解析当前配置
        const websiteDataMatch = configContent.match(/export const websiteData = (\[[\s\S]*?\]);/);
        let websiteData = [];
        
        if (websiteDataMatch) {
          try {
            websiteData = JSON.parse(websiteDataMatch[1]);
          } catch (error) {
            console.error('解析网站数据失败:', error);
          }
        }

        // 生成新的网站ID
        const newWebsiteId = Math.max(...(websiteData.map(w => w.id) || [0])) + 1;

        // 构建新网站数据
        const newWebsite = {
          id: newWebsiteId,
          name: website.name,
          description: website.description,
          url: website.url,
          category: website.category,
          tags: website.tags ? website.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
          icon: '/assets/tools_icon.png',
          popularity: 50
        };

        // 添加到网站列表
        websiteData.push(newWebsite);

        // 重新构建配置文件内容
        const updatedContent = configContent.replace(
          /export const websiteData = \[[\s\S]*?\];/,
          `export const websiteData = ${JSON.stringify(websiteData, null, 2)};`
        );

        // 保存更新后的配置到GitHub
        const updateResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/src/websiteData.js`, {
          method: 'PUT',
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'EdgeOne-Functions/1.0'
          },
          body: JSON.stringify({
            message: `审核通过: 添加站点 ${website.name}`,
            content: btoa(unescape(encodeURIComponent(updatedContent))),
            sha: configFile.sha
          })
        });

        if (!updateResponse.ok) {
          throw new Error('更新配置文件失败');
        }

        // 更新网站状态
        website.status = 'approved';
        website.processedAt = new Date().toISOString();

      } catch (error) {
        console.error('添加网站到正式列表失败:', error);
        return new Response(JSON.stringify({
          success: false,
          message: '审核通过但添加到网站列表失败'
        }), {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    } else if (action === 'reject') {
      // 拒绝审核
      website.status = 'rejected';
      website.rejectReason = rejectReason || '不符合收录标准';
      website.processedAt = new Date().toISOString();
    } else if (action === 'delete') {
      // 直接删除，不需要修改状态
    } else {
      return new Response(JSON.stringify({
        success: false,
        message: '无效的操作类型'
      }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 从待审核列表中移除
    pendingWebsites.splice(websiteIndex, 1);

    // 通过GitHub API保存更新后的待审核列表
    const updatedPendingContent = btoa(unescape(encodeURIComponent(JSON.stringify(pendingWebsites, null, 2))));
    
    const pendingUpdateResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/public/pending-websites.json`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'EdgeOne-Functions/1.0'
      },
      body: JSON.stringify({
        message: `处理站点审核: ${website.name} (${action})`,
        content: updatedPendingContent,
        sha: pendingFileSha
      })
    });

    if (!pendingUpdateResponse.ok) {
      throw new Error('更新待审核列表失败');
    }

    // 发送邮件通知提交者（删除操作不发送邮件）
    if (RESEND_API_KEY && website.contactEmail && action !== 'delete') {
      try {
        const isApproved = action === 'approve';
        const emailSubject = isApproved 
          ? `[BinNav] 您的站点"${website.name}"已通过审核` 
          : `[BinNav] 您的站点"${website.name}"审核未通过`;

        const emailHtml = isApproved ? `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">🎉 审核通过通知</h1>
            </div>
            
            <div style="padding: 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px;">
              <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
                恭喜！您提交的网站已通过我们的审核，现在已经正式收录到 BinNav 导航中。
              </p>
              
              <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <h3 style="margin-top: 0; color: #2563eb;">网站信息</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #6b7280; width: 100px;">网站名称:</td>
                    <td style="padding: 8px 0;">${website.name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">网站链接:</td>
                    <td style="padding: 8px 0;"><a href="${website.url}" target="_blank" style="color: #2563eb;">${website.url}</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">分类:</td>
                    <td style="padding: 8px 0;">${website.category}</td>
                  </tr>
                </table>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${request.headers.get('origin') || 'https://binnav.top'}" 
                   style="display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                  立即访问 BinNav
                </a>
              </div>
              
              <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #065f46;">
                  <strong>感谢您的贡献！</strong><br>
                  您推荐的优质网站将帮助更多用户发现有价值的在线资源。
                </p>
              </div>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
              此邮件由 BinNav 系统自动发送，请勿回复。
            </div>
          </div>
        ` : `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">😔 审核结果通知</h1>
            </div>
            
            <div style="padding: 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px;">
              <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
                很抱歉，您提交的网站经过我们的审核后，暂时未能通过收录标准。
              </p>
              
              <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <h3 style="margin-top: 0; color: #dc2626;">网站信息</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #6b7280; width: 100px;">网站名称:</td>
                    <td style="padding: 8px 0;">${website.name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">网站链接:</td>
                    <td style="padding: 8px 0;"><a href="${website.url}" target="_blank" style="color: #2563eb;">${website.url}</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">拒绝原因:</td>
                    <td style="padding: 8px 0; color: #dc2626;">${website.rejectReason}</td>
                  </tr>
                </table>
              </div>
              
              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #991b1b;">
                  <strong>改进建议：</strong><br>
                  请根据拒绝原因改进您的网站，您可以在完善后重新提交。我们欢迎高质量、有价值的网站加入 BinNav。
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${request.headers.get('origin') || 'https://binnav.top'}" 
                   style="display: inline-block; background-color: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                  访问 BinNav
                </a>
              </div>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
              此邮件由 BinNav 系统自动发送，请勿回复。
            </div>
          </div>
        `;

        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: RESEND_DOMAIN ? `noreply@${RESEND_DOMAIN}` : 'onboarding@resend.dev',
            to: [website.contactEmail],
            subject: emailSubject,
            html: emailHtml
          })
        });

        if (!emailResponse.ok) {
          // 发送审核通知邮件失败
        }
      } catch (emailError) {
        // 邮件发送失败不影响审核操作
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: action === 'approve' ? '站点审核通过，已添加到网站列表' : '站点已拒绝',
      action: action
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('处理站点审核失败:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: '审核处理失败，请稍后重试'
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
} 