// Netlify Function: DeepSeek API 代理
exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // 处理 OPTIONS 预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: headers
    };
  }

  // 只允许 POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ error: '仅支持 POST 请求' })
    };
  }

  // 读取 API Key
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        error: '服务器未配置 DEEPSEEK_API_KEY 环境变量'
      })
    };
  }

  // 解析请求体
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

  // 确保有 model 字段
  if (!payload.model) {
    payload.model = "deepseek-chat";
  }

  // 调用 DeepSeek API
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

  // 如果上游返回错误
  if (!response.ok) {
    let errText = '';
    try {
      errText = await response.text();
    } catch (e) {}
    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ error: 'DeepSeek API 错误: ' + errText })
    };
  }

  // 获取响应数据
  const data = await response.json();

  // 如果是流式请求，需要特殊处理
  if (payload.stream) {
    // 对于流式，我们需要从 data 中提取内容并构造 SSE 格式
    // 但简单起见，这里直接返回非流式响应
    // 因为前端代码也支持非流式
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(data)
    };
  }

  // 非流式：直接返回 JSON
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(data)
  };
};
