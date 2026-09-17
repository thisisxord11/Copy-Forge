const OPENAI_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5.6-luna';

function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function extractText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const parts = [];
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (typeof content?.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: { message: 'Method not allowed. Use POST.' } });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return send(res, 500, { error: { message: 'OPENAI_API_KEY is missing on the Vercel server. Add it in Project Settings → Environment Variables, then redeploy.' } });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = null; }
  }
  if (!body || typeof body !== 'object') {
    return send(res, 400, { error: { message: 'Invalid JSON request.' } });
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const system = typeof body.system === 'string' ? body.system.trim() : '';
  if (!prompt) return send(res, 400, { error: { message: 'Prompt is required.' } });

  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);

  try {
    const payload = {
      model,
      input: prompt
    };
    if (system) payload.instructions = system;

    // Deliberately no `temperature`: current reasoning models do not need it,
    // and sending unsupported sampling parameters can cause API errors.
    const upstream = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const raw = await upstream.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch (_) {}

    if (!upstream.ok) {
      const message = data?.error?.message || raw.slice(0, 800) || `OpenAI returned HTTP ${upstream.status}.`;
      if (upstream.status === 401) return send(res, 502, { error: { message: 'OpenAI authentication failed. The server API key is invalid, expired, or not authorized.' } });
      if (upstream.status === 403) return send(res, 502, { error: { message: 'OpenAI rejected this request (403). Check the server key/project permissions and model access.' } });
      if (upstream.status === 404) return send(res, 502, { error: { message: `OpenAI could not find the configured model or endpoint. Server model: ${model}. ${message}` } });
      if (upstream.status === 429) return send(res, 502, { error: { message: 'OpenAI rate limit or quota was reached. Check the owner account billing/usage and try again.' } });
      return send(res, 502, { error: { message: `OpenAI error (${upstream.status}): ${message}` } });
    }

    const text = extractText(data);
    if (!text) return send(res, 502, { error: { message: 'OpenAI returned no text output. Please try the generation again.' } });
    return send(res, 200, { text, model });
  } catch (error) {
    if (error?.name === 'AbortError') {
      return send(res, 504, { error: { message: 'The AI request timed out after 90 seconds. Please try again.' } });
    }
    return send(res, 502, { error: { message: `Could not reach OpenAI: ${error?.message || 'network error'}` } });
  } finally {
    clearTimeout(timer);
  }
};
