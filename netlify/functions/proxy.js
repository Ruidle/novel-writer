exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ error: '仅支持 POST 请求' })
    };
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ error: '服务器未配置 DEEPSEEK_API_KEY 环境变量' })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ error: '请求体不是合法 JSON' })
    };
  }

  // ✅ 强制 model
  if (!payload.model) {
    payload.model = "deepseek-chat";
  }

  // ✅ 强制关闭流式
  payload.stream = false;

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
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ error: '无法连接 DeepSeek API: ' + e.message })
    };
  }

  if (!response.ok) {
    let errText = '';
    try { errText = await response.text(); } catch (e) {}
    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ error: 'DeepSeek API 错误: ' + errText })
    };
  }

  // ✅ 直接解析 JSON 响应
  let data;
  try {
    data = await response.json();
  } catch (e) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ error: '解析 DeepSeek 响应失败: ' + e.message })
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(data)
  };
};
