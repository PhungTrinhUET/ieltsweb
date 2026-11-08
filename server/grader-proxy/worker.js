// Proxy AI cho IELTS Practice → Anthropic Messages API (Cloudflare Worker).
// Giữ ANTHROPIC_API_KEY phía máy chủ; app gửi ACCESS_CODE (nếu đặt) trong header x-api-key.
//
// Biến môi trường:
//   ANTHROPIC_API_KEY  (secret, bắt buộc)  – API key thật
//   ACCESS_CODE        (secret, nên đặt)   – mã truy cập người dùng nhập trong app
//   ALLOWED_MODELS     (var)               – danh sách model cho phép, phân tách bằng dấu phẩy
//   ALLOWED_ORIGINS    (var)               – origin được gọi (vd. https://localhost cho app Android), "*" = mọi nơi

const UPSTREAM = 'https://api.anthropic.com';
const FORWARD_HEADERS = ['content-type', 'anthropic-version', 'anthropic-beta'];

const list = (v, fallback) => (v || fallback).split(',').map((s) => s.trim()).filter(Boolean);

function errorResponse(status, type, message, cors) {
  return new Response(JSON.stringify({ type: 'error', error: { type, message } }), {
    status,
    headers: { 'content-type': 'application/json', ...cors },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const origins = list(env.ALLOWED_ORIGINS, '*');
    const originOk = origins.includes('*') || (origin !== null && origins.includes(origin));
    const cors = {
      'Access-Control-Allow-Origin': origins.includes('*') ? '*' : originOk ? origin : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/v1/messages') {
      return errorResponse(404, 'not_found_error', 'Only POST /v1/messages is proxied.', cors);
    }
    if (!originOk) return errorResponse(403, 'permission_error', 'Origin not allowed.', cors);
    if (env.ACCESS_CODE && request.headers.get('x-api-key') !== env.ACCESS_CODE) {
      return errorResponse(401, 'authentication_error', 'Invalid access code.', cors);
    }
    if (!env.ANTHROPIC_API_KEY) return errorResponse(500, 'api_error', 'Proxy is missing ANTHROPIC_API_KEY.', cors);

    const body = await request.text();
    let model;
    try {
      model = JSON.parse(body).model;
    } catch {
      return errorResponse(400, 'invalid_request_error', 'Body must be JSON.', cors);
    }
    if (!list(env.ALLOWED_MODELS, 'claude-opus-5-5').includes(model)) {
      return errorResponse(400, 'invalid_request_error', `Model "${model}" is not allowed by this proxy.`, cors);
    }

    const headers = new Headers({ 'x-api-key': env.ANTHROPIC_API_KEY });
    for (const h of FORWARD_HEADERS) {
      const v = request.headers.get(h);
      if (v) headers.set(h, v);
    }

    const upstream = await fetch(`${UPSTREAM}${url.pathname}${url.search}`, { method: 'POST', headers, body });
    const res = new Response(upstream.body, upstream);
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
    return res;
  },
};
