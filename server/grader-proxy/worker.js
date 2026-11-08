// Proxy AI cho IELTS Practice (Cloudflare Worker).
// Giữ API key phía máy chủ; người dùng chỉ nhập địa chỉ proxy + mã truy cập trong app.
//
//   POST /v1/messages          → Anthropic Messages API (Claude)
//   POST /v1/chat/completions  → dịch vụ OpenAI-compatible (DeepSeek, OpenAI, Gemini, OpenRouter…)
//   GET  /v1/models            → danh sách ALLOWED_MODELS (app dùng để gợi ý)
//
// Biến môi trường:
//   ANTHROPIC_API_KEY   (secret)  – key Claude; bỏ trống nếu không dùng Claude
//   COMPAT_BASE_URL     (var)     – vd. https://api.deepseek.com  hoặc https://openrouter.ai/api/v1
//   COMPAT_API_KEY      (secret)  – key của dịch vụ OpenAI-compatible ở trên
//   ACCESS_CODES        (secret)  – các mã truy cập, phân tách dấu phẩy; "mã:số" = giới hạn riêng mỗi ngày
//                                   (ACCESS_CODE kiểu cũ, một mã, vẫn nhận)
//   DAILY_LIMIT         (var)     – số lượt gọi mỗi mã mỗi ngày (mặc định 30; 0 = không giới hạn)
//   USAGE               (KV)      – nơi đếm lượt; không gắn KV thì không giới hạn được
//   ALLOWED_MODELS      (var)     – model cho phép, phân tách dấu phẩy
//   ALLOWED_ORIGINS     (var)     – origin được gọi, "*" = mọi nơi

const ANTHROPIC = 'https://api.anthropic.com';
const FORWARD_ANTHROPIC = ['content-type', 'anthropic-version', 'anthropic-beta'];

const list = (v, fallback = '') => (v || fallback).split(',').map((s) => s.trim()).filter(Boolean);

function json(status, body, cors) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors } });
}
const err = (status, type, message, cors) => json(status, { type: 'error', error: { type, message } }, cors);

/** Mã truy cập → giới hạn/ngày (null = không có mã nào được đặt → proxy mở). */
function codes(env) {
  const raw = list(env.ACCESS_CODES || env.ACCESS_CODE);
  if (!raw.length) return null;
  const def = Number(env.DAILY_LIMIT ?? 30);
  return new Map(raw.map((c) => { const [code, n] = c.split(':'); return [code, n ? Number(n) : def]; }));
}

const credential = (req) => req.headers.get('x-api-key') || (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');

/** Tăng bộ đếm ngày (giờ UTC) của mã; trả về false nếu đã hết lượt. */
async function spend(env, code, limit) {
  if (!env.USAGE || !limit) return { ok: true };
  const day = new Date().toISOString().slice(0, 10);
  const key = `u:${day}:${code}`;
  const used = Number((await env.USAGE.get(key)) || 0);
  if (used >= limit) return { ok: false, used };
  await env.USAGE.put(key, String(used + 1), { expirationTtl: 3 * 86400 });
  return { ok: true, used: used + 1 };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const origins = list(env.ALLOWED_ORIGINS, '*');
    const originOk = origins.includes('*') || (origin !== null && origins.includes(origin));
    const cors = {
      'Access-Control-Allow-Origin': origins.includes('*') ? '*' : originOk ? origin : 'null',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Expose-Headers': 'x-usage-today, x-usage-limit',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!originOk) return err(403, 'permission_error', 'Origin not allowed.', cors);

    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname.replace(/\/+$/, '')}`;
    const allowed = list(env.ALLOWED_MODELS, 'claude-opus-5-5');

    const table = codes(env);
    const code = credential(request);
    if (table && !table.has(code)) return err(401, 'authentication_error', 'Invalid access code.', cors);

    if (route === 'GET /v1/models') return json(200, { object: 'list', data: allowed.map((id) => ({ id, object: 'model' })) }, cors);
    if (route !== 'POST /v1/messages' && route !== 'POST /v1/chat/completions') {
      return err(404, 'not_found_error', 'Only POST /v1/messages, POST /v1/chat/completions and GET /v1/models are proxied.', cors);
    }

    const body = await request.text();
    let model;
    try { model = JSON.parse(body).model; } catch { return err(400, 'invalid_request_error', 'Body must be JSON.', cors); }
    if (!allowed.includes(model)) return err(400, 'invalid_request_error', `Model "${model}" is not allowed by this proxy.`, cors);

    let upstreamUrl; const headers = new Headers();
    if (route === 'POST /v1/messages') {
      if (!env.ANTHROPIC_API_KEY) return err(500, 'api_error', 'Proxy is missing ANTHROPIC_API_KEY.', cors);
      upstreamUrl = `${ANTHROPIC}/v1/messages${url.search}`;
      headers.set('x-api-key', env.ANTHROPIC_API_KEY);
      for (const h of FORWARD_ANTHROPIC) { const v = request.headers.get(h); if (v) headers.set(h, v); }
    } else {
      if (!env.COMPAT_BASE_URL || !env.COMPAT_API_KEY) return err(500, 'api_error', 'Proxy is missing COMPAT_BASE_URL / COMPAT_API_KEY.', cors);
      upstreamUrl = `${env.COMPAT_BASE_URL.replace(/\/+$/, '')}/chat/completions`;
      headers.set('content-type', 'application/json');
      headers.set('authorization', `Bearer ${env.COMPAT_API_KEY}`);
    }

    const limit = table ? table.get(code) : Number(env.DAILY_LIMIT ?? 0);
    const usage = await spend(env, code || 'open', limit);
    if (!usage.ok) return err(429, 'rate_limit_error', `Daily limit reached for this access code (${limit}/day). Try again tomorrow.`, cors);

    const upstream = await fetch(upstreamUrl, { method: 'POST', headers, body });
    const res = new Response(upstream.body, upstream);
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
    if (usage.used) { res.headers.set('x-usage-today', String(usage.used)); res.headers.set('x-usage-limit', String(limit)); }
    return res;
  },
};
