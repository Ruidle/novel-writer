// Cloudflare Pages Function：代理前端请求到 DeepSeek API
// 在 Cloudflare Pages 后台 → Settings → Environment variables 添加 DEEPSEEK_API_KEY
// 部署后 /api/proxy 即可生效

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

export async function onRequestPost(context) {
  const { request, env } = context;

  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: '服务器未配置 DEEPSEEK_API_KEY，请在 Cloudflare Pages 后台添加环境变量，或在前端填写你自己的 Key。' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: '请求体不是合法 JSON' }, 400);
  }

  // 透传字段，默认模型 deepseek-chat，强制非流式以保证兼容性
  const upstreamBody = {
    model: body.model || 'deepseek-chat',
    messages: body.messages,
    max_tokens: body.max_tokens,
    temperature: body.temperature,
    stream: false
  };

  try {
    const resp = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify(upstreamBody)
    });

    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  } catch (e) {
    return jsonResponse({ error: '调用 DeepSeek 失败：' + e.message }, 502);
  }
}

// 处理 OPTIONS 预检（虽然同源不需要，留作兼容）
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
