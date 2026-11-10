// Gọi AI. Claude dùng Anthropic SDK (structured output); DeepSeek / OpenAI / Gemini / OpenRouter / tuỳ chỉnh
// dùng chung một backend OpenAI-compatible (chat/completions + JSON + zod kiểm tra, sai thì hỏi lại một lần).
// Import động từ các module chức năng để trang bình thường không tải SDK.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as z from 'zod/v4';
import { activeKey, activeModels, type AiConfig } from '../store';
import { effortOf, modelOf, providerOf, type Effort } from './models';

export class AiError extends Error {
  constructor(message: string, readonly kind: 'config' | 'auth' | 'rate' | 'network' | 'refusal' | 'api' | 'parse') { super(message); }
}

export interface CallOpts { light?: boolean; maxTokens?: number; effort?: Effort }

const isClaude = (cfg: AiConfig) => providerOf(cfg.provider).id === 'anthropic';
const modelFor = (cfg: AiConfig, light?: boolean) => { const m = activeModels(cfg); return light ? m.light : m.main; };

/** Gọi với structured output (zod). `light` = dùng model rẻ cho tác vụ nhỏ. */
export function callStructured<T>(cfg: AiConfig, schema: z.ZodType<T>, system: string, prompt: string, opts: CallOpts = {}): Promise<T> {
  return isClaude(cfg) ? claudeStructured(cfg, schema, system, prompt, opts) : compatStructured(cfg, schema, system, prompt, opts);
}

/** Gọi trả văn bản thường. */
export async function callText(cfg: AiConfig, system: string, prompt: string, opts: CallOpts = {}): Promise<string> {
  return isClaude(cfg) ? claudeText(cfg, system, prompt, opts) : (await compatChat(cfg, [{ role: 'system', content: system }, { role: 'user', content: prompt }], opts, false)).text;
}

/** Gửi một câu ngắn, trả về tên model máy chủ báo lại. */
export async function testConnection(cfg: AiConfig): Promise<string> {
  if (isClaude(cfg)) {
    const client = makeClient(cfg);
    try {
      const res = await client.messages.create({
        model: modelOf(cfg.model).id, max_tokens: 64, output_config: { effort: 'low' },
        messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      }, isAccessToken(cfg) ? { headers: { 'anthropic-beta': OAUTH_BETA } } : undefined);
      return res.model;
    } catch (e) { wrap(e, cfg); }
  }
  const r = await compatChat(cfg, [{ role: 'user', content: 'Reply with exactly: OK' }], { maxTokens: 64, effort: 'low' }, false);
  return r.model;
}

/** Danh sách model thật của nhà cung cấp (GET /models). OpenRouter trả kèm giá. */
export async function listModels(cfg: AiConfig): Promise<{ id: string; price?: [number, number] }[]> {
  const { url, headers } = endpoint(cfg, '/models');
  let res: Response;
  try { res = await fetch(url, { headers }); } catch { throw new AiError(corsMsg(cfg), 'network'); }
  if (!res.ok) throw httpError(res.status, await res.text().catch(() => ''), cfg);
  const j = await res.json() as { data?: { id: string; pricing?: { prompt?: string; completion?: string } }[]; models?: { name: string }[] };
  const rows: { id: string; pricing?: { prompt?: string; completion?: string } }[] = j.data ?? j.models?.map((m) => ({ id: m.name.replace(/^models\//, '') })) ?? [];
  return rows.map((m) => {
    const p = m.pricing?.prompt != null ? [Number(m.pricing.prompt) * 1e6, Number(m.pricing.completion ?? 0) * 1e6] as [number, number] : undefined;
    return { id: m.id, price: p && p.every((n) => Number.isFinite(n)) ? p : undefined };
  }).sort((a, b) => a.id.localeCompare(b.id));
}

// ---------------- Claude (Anthropic SDK) ----------------

const isAccessToken = (cfg: AiConfig) => cfg.mode === 'key' && !cfg.apiKey.trim().startsWith('sk-ant-api');
const OAUTH_BETA = 'oauth-2025-04-20';

export function makeClient(cfg: AiConfig) {
  if (cfg.mode === 'proxy') {
    if (!/^https?:\/\//.test(cfg.proxyUrl.trim())) throw new AiError('Chưa nhập địa chỉ proxy trong Cài đặt.', 'config');
    return new Anthropic({ baseURL: cfg.proxyUrl.trim().replace(/\/+$/, ''), apiKey: cfg.accessCode.trim() || 'proxy', dangerouslyAllowBrowser: true });
  }
  const cred = cfg.apiKey.trim();
  if (!cred) throw new AiError('Chưa nhập API key trong Cài đặt → AI.', 'config');
  return isAccessToken(cfg)
    ? new Anthropic({ apiKey: null, authToken: cred, dangerouslyAllowBrowser: true })
    : new Anthropic({ apiKey: cred, dangerouslyAllowBrowser: true });
}

const authError = (cfg: AiConfig) =>
  cfg.mode === 'proxy' ? 'Proxy từ chối truy cập – kiểm tra mã truy cập.'
  : isClaude(cfg) && isAccessToken(cfg) ? 'Access token không hợp lệ hoặc đã hết hạn.'
  : 'Sai key (hoặc key đã bị xoá / không có quyền) – chép lại key, chú ý không thừa dấu cách.';

function wrap(e: unknown, cfg: AiConfig): never {
  if (e instanceof AiError) throw e;
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new AiError(authError(cfg), 'auth');
  if (e instanceof Anthropic.RateLimitError) throw new AiError(cfg.mode === 'proxy' && /daily|ngày/i.test(e.message) ? 'Đã hết lượt dùng hôm nay của mã truy cập này.' : 'Đang bị giới hạn tần suất – thử lại sau ít phút.', 'rate');
  if (e instanceof Anthropic.APIError && (e.status === 402 || /credit balance|insufficient|billing/i.test(e.message))) throw new AiError(TOPUP, 'auth');
  if (e instanceof Anthropic.APIConnectionError) throw new AiError(corsMsg(cfg), 'network');
  if (e instanceof Anthropic.APIError) throw new AiError(`Lỗi API ${e.status ?? ''}: ${e.message}`, 'api');
  throw new AiError(e instanceof Error ? e.message : String(e), 'api');
}

async function claudeStructured<T>(cfg: AiConfig, schema: z.ZodType<T>, system: string, prompt: string, opts: CallOpts): Promise<T> {
  const client = makeClient(cfg);
  const model = modelOf(opts.light ? cfg.lightModel : cfg.model);
  const betas = [...(model.fallback ? ['server-side-fallback-2026-07-01'] : []), ...(isAccessToken(cfg) ? [OAUTH_BETA] : [])];
  try {
    const res = await client.beta.messages.stream({
      model: model.id,
      max_tokens: opts.maxTokens ?? 16000,
      ...(betas.length ? { betas } : {}),
      ...(model.fallback ? { fallbacks: 'default' as const } : {}),
      output_config: { effort: opts.effort ?? (opts.light ? 'low' : effortOf(cfg.effort)), format: betaZodOutputFormat(schema) },
      system,
      messages: [{ role: 'user', content: prompt }],
    }).finalMessage();
    if (res.stop_reason === 'refusal') throw new AiError('Claude từ chối xử lý nội dung này.', 'refusal');
    if (res.stop_reason === 'max_tokens' || !res.parsed_output) throw new AiError('Kết quả bị thiếu – hãy thử lại.', 'parse');
    return res.parsed_output as T;
  } catch (e) { wrap(e, cfg); }
}

async function claudeText(cfg: AiConfig, system: string, prompt: string, opts: CallOpts): Promise<string> {
  const client = makeClient(cfg);
  const model = modelOf(opts.light ? cfg.lightModel : cfg.model);
  try {
    const res = await client.messages.create({
      model: model.id,
      max_tokens: opts.maxTokens ?? 4000,
      output_config: { effort: opts.effort ?? (opts.light ? 'low' : effortOf(cfg.effort)) },
      system,
      messages: [{ role: 'user', content: prompt }],
    }, isAccessToken(cfg) ? { headers: { 'anthropic-beta': OAUTH_BETA } } : undefined);
    return res.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('');
  } catch (e) { wrap(e, cfg); }
}

// ---------------- OpenAI-compatible ----------------

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

function endpoint(cfg: AiConfig, path: string) {
  const p = providerOf(cfg.provider);
  if (cfg.mode === 'proxy') {
    const base = cfg.proxyUrl.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//.test(base)) throw new AiError('Chưa nhập địa chỉ proxy trong Cài đặt.', 'config');
    return { url: `${base}/v1${path}`, headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.accessCode.trim() || 'proxy'}` } as Record<string, string> };
  }
  const base = (p.id === 'custom' ? cfg.baseUrl : p.baseUrl ?? '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base)) throw new AiError('Chưa nhập Base URL trong Cài đặt → AI.', 'config');
  const key = activeKey(cfg);
  if (!key && p.id !== 'custom') throw new AiError(`Chưa nhập API key ${p.label} trong Cài đặt → AI.`, 'config');
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (key) headers.authorization = `Bearer ${key}`;
  if (p.id === 'openrouter') { headers['HTTP-Referer'] = location.origin; headers['X-Title'] = 'IELTS Practice'; }
  return { url: `${base}${path}`, headers };
}

const corsMsg = (cfg: AiConfig) => cfg.mode === 'proxy'
  ? 'Không kết nối được tới proxy. Kiểm tra mạng và địa chỉ proxy.'
  : `Không kết nối được tới ${providerOf(cfg.provider).label} (mất mạng, hoặc dịch vụ chặn gọi từ trình duyệt – CORS). Kiểm tra mạng; nếu vẫn lỗi, chọn nhà cung cấp khác hoặc dùng mã lớp (proxy).`;
const TOPUP = 'Tài khoản hết tiền / hết hạn mức – nạp thêm ở trang của nhà cung cấp.';
const quotaMsg = (cfg: AiConfig, msg: string) => cfg.mode !== 'proxy' && cfg.provider === 'gemini'
  ? 'Đã hết hạn mức Gemini (miễn phí) hôm nay – đặt lại lúc 0h giờ Thái Bình Dương ≈ 14–15h giờ Việt Nam. Hoặc chọn model khác (Flash-Lite) / nhà cung cấp khác.'
  : /daily|ngày|quota|per day|free-models-per-day/i.test(msg) ? `Đã hết hạn mức: ${msg.slice(0, 160)}` : 'Đang bị giới hạn tần suất – thử lại sau ít phút.';

function httpError(status: number, body: string, cfg: AiConfig): AiError {
  let msg = body;
  try { const j = JSON.parse(body); msg = j.error?.message ?? j.message ?? (Array.isArray(j) ? j[0]?.error?.message : '') ?? body; } catch { /* body thường */ }
  if (status === 401 || status === 403) return new AiError(authError(cfg), 'auth');
  if (status === 402 || /insufficient|balance|credit/i.test(String(msg))) return new AiError(TOPUP, 'auth');
  if (status === 429) return new AiError(quotaMsg(cfg, String(msg)), 'rate');
  if (status === 404) return new AiError(`Không tìm thấy model hoặc địa chỉ (404). ${msg.slice(0, 160)}`, 'config');
  return new AiError(`Lỗi API ${status}: ${String(msg).slice(0, 240)}`, 'api');
}

/** Một lần gọi chat/completions. `json` = xin JSON (response_format json_object; dịch vụ không nhận thì gọi lại không có). */
async function compatChat(cfg: AiConfig, messages: Msg[], opts: CallOpts, json: boolean): Promise<{ text: string; model: string; finish?: string }> {
  const p = providerOf(cfg.provider);
  const { url, headers } = endpoint(cfg, '/chat/completions');
  const model = modelFor(cfg, opts.light);
  if (!model) throw new AiError('Chưa chọn model trong Cài đặt → AI.', 'config');
  const effort = opts.effort ?? (opts.light ? 'low' : effortOf(cfg.effort));
  const max = opts.maxTokens ?? (json ? 16000 : 4000);
  const body: Record<string, unknown> = { model, messages };
  if (p.id === 'openai') { body.max_completion_tokens = max; body.reasoning_effort = effort === 'xhigh' || effort === 'max' ? 'high' : effort; }
  else body.max_tokens = max;
  const send = async (withFormat: boolean) => {
    try { return await fetch(url, { method: 'POST', headers, body: JSON.stringify(withFormat ? { ...body, response_format: { type: 'json_object' } } : body) }); }
    catch { throw new AiError(corsMsg(cfg), 'network'); }
  };
  let res = await send(json);
  if (json && res.status === 400) {
    const t = await res.text();
    if (!/response_format|json_object/i.test(t)) throw httpError(400, t, cfg);
    res = await send(false);
  }
  if (!res.ok) throw httpError(res.status, await res.text().catch(() => ''), cfg);
  const j = await res.json() as { model?: string; choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[] };
  const c = j.choices?.[0];
  if (c?.message?.refusal) throw new AiError(`AI từ chối: ${c.message.refusal}`, 'refusal');
  if (c?.finish_reason === 'content_filter') throw new AiError('Nội dung bị bộ lọc an toàn của nhà cung cấp chặn.', 'refusal');
  return { text: c?.message?.content ?? '', model: j.model ?? model, finish: c?.finish_reason };
}

/** Lấy đối tượng JSON đầu tiên trong câu trả lời (bỏ ```json, chữ thừa). */
export function extractJson(text: string): unknown {
  const t = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  try { return JSON.parse(t); } catch { /* thử cắt */ }
  const a = t.indexOf('{'); const b = t.lastIndexOf('}');
  if (a !== -1 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new SyntaxError('không có JSON');
}

const schemaCache = new WeakMap<object, string>();
function schemaText(schema: z.ZodType): string {
  let s = schemaCache.get(schema);
  if (!s) { const js = z.toJSONSchema(schema, { unrepresentable: 'any' }) as Record<string, unknown>; delete js.$schema; s = JSON.stringify(js); schemaCache.set(schema, s); }
  return s;
}

async function compatStructured<T>(cfg: AiConfig, schema: z.ZodType<T>, system: string, prompt: string, opts: CallOpts): Promise<T> {
  const sys = `${system}\n\nOUTPUT FORMAT: reply with ONE valid JSON object only (no markdown, no commentary) that conforms to this JSON Schema. Use the exact property names; include every required property.\n${schemaText(schema)}`;
  const messages: Msg[] = [{ role: 'system', content: sys }, { role: 'user', content: prompt }];
  let problem = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await compatChat(cfg, messages, opts, true);
    if (r.finish === 'length') problem = 'Câu trả lời bị cắt vì quá dài.';
    let data: unknown;
    try { data = extractJson(r.text); } catch { problem ||= 'Câu trả lời không phải JSON.'; }
    if (data !== undefined) {
      const ok = schema.safeParse(data);
      if (ok.success) return ok.data;
      problem = ok.error.issues.slice(0, 8).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    }
    // Hỏi lại một lần, kèm lỗi cụ thể.
    messages.push({ role: 'assistant', content: r.text.slice(0, 12000) }, { role: 'user', content: `Your previous reply was invalid (${problem}). Reply again with ONLY the corrected JSON object that matches the schema.` });
  }
  throw new AiError(`Kết quả AI không đúng định dạng – hãy thử lại hoặc chọn model mạnh hơn. (${problem.slice(0, 200)})`, 'parse');
}
