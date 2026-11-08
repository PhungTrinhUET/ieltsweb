// Gọi Claude (SDK chạy trên trình duyệt). Import động từ các module chức năng để trang bình thường không tải SDK.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type * as z from 'zod/v4';
import type { AiConfig } from '../store';
import { effortOf, modelOf, type Effort } from './models';

export class AiError extends Error {
  constructor(message: string, readonly kind: 'config' | 'auth' | 'rate' | 'network' | 'refusal' | 'api' | 'parse') { super(message); }
}

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
  : isAccessToken(cfg) ? 'Access token không hợp lệ hoặc đã hết hạn.'
  : 'API key không hợp lệ hoặc không có quyền.';

function wrap(e: unknown, cfg: AiConfig): never {
  if (e instanceof AiError) throw e;
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new AiError(authError(cfg), 'auth');
  if (e instanceof Anthropic.RateLimitError) throw new AiError('Đang bị giới hạn tần suất – thử lại sau ít phút.', 'rate');
  if (e instanceof Anthropic.APIConnectionError) throw new AiError('Không kết nối được tới máy chủ AI. Kiểm tra mạng hoặc địa chỉ proxy.', 'network');
  if (e instanceof Anthropic.APIError) throw new AiError(`Lỗi API ${e.status ?? ''}: ${e.message}`, 'api');
  throw new AiError(e instanceof Error ? e.message : String(e), 'api');
}

export interface CallOpts { light?: boolean; maxTokens?: number; effort?: Effort }

/** Gọi với structured output (zod). `light` = dùng model rẻ cho tác vụ nhỏ. */
export async function callStructured<T>(cfg: AiConfig, schema: z.ZodType<T>, system: string, prompt: string, opts: CallOpts = {}): Promise<T> {
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

/** Gọi trả văn bản thường. */
export async function callText(cfg: AiConfig, system: string, prompt: string, opts: CallOpts = {}): Promise<string> {
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

export async function testConnection(cfg: AiConfig) {
  const client = makeClient(cfg);
  try {
    const res = await client.messages.create({
      model: modelOf(cfg.model).id, max_tokens: 64, output_config: { effort: 'low' },
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
    }, isAccessToken(cfg) ? { headers: { 'anthropic-beta': OAUTH_BETA } } : undefined);
    return res.model;
  } catch (e) { wrap(e, cfg); }
}
