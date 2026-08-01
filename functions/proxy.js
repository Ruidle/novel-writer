// Netlify Function: DeepSeek API 代理
// 作用:把前端请求转发给 DeepSeek,API Key 存在环境变量里,不暴露给浏览器
// 支持流式(SSE)转发,解决浏览器跨域(CORS)问题

export default async (req, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: '仅支持 POST 请求' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  // 从 Netlify 环境变量读取 API Key
  const apiKey = process.env.DEEPSEEK_API_KEY || (context.env && context.env.DEEPSEEK_API_KEY) || (Netlify && Netlify.env && Netlify.env.get ? Netlify.env.get('DEEPSEEK_API_KEY') : null);

  if (!apiKey) {
    return new Response(JSON.stringify({
      error: '服务器未配置 DEEPSEEK_API_KEY 环境变量。请在 Netlify 后台 Site settings → Environment variables 添加。'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  // 解析前端请求体
  let payload;
  try {
    payload = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: '请求体不是合法 JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  // 转发给 DeepSeek
  const upstream = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  // 非 2xx:把错误信息透传回前端
  if (!upstream.ok) {
    let errText = '';
    try { errText = await upstream.text(); } catch (e) {}
    return new Response(errText || JSON.stringify({ error: '上游错误 ' + upstream.status }), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  // 流式转发:SSE 原样回传
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } catch (e) {
        // 客户端断开等,忽略
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      ...corsHeaders
    }
  });
};

export const config = {
  path: '/api/proxy'
};
