// Netlify Function: DeepSeek API 代理
// 把前端请求转发给 DeepSeek，API Key 存在环境变量里，不暴露给浏览器
// 支持流式（SSE）转发，解决浏览器跨域（CORS）问题

exports.handler = async function(event, context) {
  // CORS 跨域头
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // 处理 CORS 预检请求（浏览器会先发一个 OPTIONS 请求）
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: headers
    };
  }

  // 只允许 POST 请求
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify({ error: '仅支持 POST 请求' })
    };
  }

  // 从 Netlify 环境变量读取 API Key
  const apiKey = process.env.DEEPSEEK_API_KEY;

  // 如果没有配置 API Key，返回明确的错误提示
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify({
        error: '服务器未配置 DEEPSEEK_API_KEY 环境变量。请在 Netlify 后台 Site settings → Environment variables 添加。'
      })
    };
  }

  // 解析前端发来的请求体
  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify({ error: '请求体不是合法 JSON' })
    };
  }

  // ✅ 确保有 model 字段（DeepSeek API 必需）
  if (!payload.model) {
    payload.model = "deepseek-chat";
  }

  // ✅ 如果 stream 未定义，默认启用流式
  if (payload.stream === undefined) {
    payload.stream = true;
  }

  // 转发请求到 DeepSeek API
  let response;
  try {
    response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    return {
      statusCode: 502,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify({ error: '无法连接 DeepSeek API: ' + e.message })
    };
  }

  // 如果上游返回错误，把错误信息透传给前端
  if (!response.ok) {
    let errText = '';
    try {
      errText = await response.text();
    } catch (e) {}
    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: errText || JSON.stringify({ error: '上游错误 ' + response.status })
    };
  }

  // 如果是流式请求（SSE），直接转发流
  if (payload.stream) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        ...headers
      },
      body: response.body
    };
  }

  // 非流式：解析 JSON 返回
  try {
    const data = await response.json();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify(data)
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify({ error: '解析 DeepSeek 响应失败: ' + e.message })
    };
  }
};
