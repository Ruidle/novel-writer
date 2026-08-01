// Netlify Function: DeepSeek API 代理
export default async (req, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: '仅支持 POST 请求' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  // ✅ 正确的环境变量读取方式
  const apiKey = context.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({
      error: '服务器未配置 DEEPSEEK_API_KEY 环境变量。请在 Netlify 后台 Site settings → Environment variables 添加。'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  let payload;
  try {
    payload = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: '请求体不是合法 JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  // ✅ DeepSeek API 正确地址
  const upstream = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!upstream.ok) {
    let errText = '';
    try { errText = await upstream.text(); } catch (e) {}
    return new Response(errText || JSON.stringify({ error: '上游错误 ' + upstream.status }), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

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
        // 忽略客户端断开
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
