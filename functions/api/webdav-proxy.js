/**
 * EdgeOne Functions - WebDAV 代理
 * 路由: /api/webdav-proxy
 * 用途: 中转 WebDAV 请求，绕过浏览器 CORS 限制
 */

export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  })
}

export async function onRequestPost({ request }) {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  }

  try {
    const { action, url, username, password, content, filename } = await request.json()

    if (!url || !username || !password) {
      return new Response(JSON.stringify({ success: false, message: '缺少WebDAV配置参数' }), {
        status: 400,
        headers: corsHeaders
      })
    }

    const authHeader = 'Basic ' + btoa(`${username}:${password}`)

    if (action === 'test') {
      const resp = await fetch(url, {
        method: 'PROPFIND',
        headers: {
          'Authorization': authHeader,
          'Depth': '0'
        }
      })

      return new Response(JSON.stringify({
        success: resp.ok || resp.status === 207,
        message: (resp.ok || resp.status === 207) ? '连接成功' : `连接失败: HTTP ${resp.status}`,
        status: resp.status
      }), {
        status: 200,
        headers: corsHeaders
      })
    }

    if (action === 'upload') {
      if (!content || !filename) {
        return new Response(JSON.stringify({ success: false, message: '缺少上传内容或文件名' }), {
          status: 400,
          headers: corsHeaders
        })
      }

      const uploadUrl = url.replace(/\/$/, '') + '/' + filename

      const resp = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'text/javascript; charset=utf-8'
        },
        body: content
      })

      if (resp.ok || resp.status === 201 || resp.status === 204) {
        return new Response(JSON.stringify({ success: true, message: '上传成功', filename }), {
          status: 200,
          headers: corsHeaders
        })
      } else {
        const text = await resp.text().catch(() => '')
        return new Response(JSON.stringify({ success: false, message: `上传失败: HTTP ${resp.status}`, detail: text }), {
          status: 200,
          headers: corsHeaders
        })
      }
    }

    return new Response(JSON.stringify({ success: false, message: '未知的action类型，支持: test, upload' }), {
      status: 400,
      headers: corsHeaders
    })

  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: `代理请求失败: ${error.message}` }), {
      status: 500,
      headers: corsHeaders
    })
  }
}
