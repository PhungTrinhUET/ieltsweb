// Nhà cung cấp + model AI. Tách khỏi client.ts để trang Cài đặt không phải tải SDK.
// Giá là giá tham khảo (USD / 1 triệu token vào, ra) ghi 11/2026 từ trang giá chính thức – có thể đã đổi.

export type ProviderId = 'anthropic' | 'deepseek' | 'openai' | 'gemini' | 'openrouter' | 'custom';

export interface ModelInfo {
  id: string;
  label: string;
  /** Giá USD / 1 triệu token (input, output). */
  price?: [number, number];
  /** Claude: hỗ trợ fallbacks: 'default' (chạy lại trên model dự phòng khi bị bộ lọc an toàn từ chối). */
  fallback?: boolean;
  note?: string;
}
/** Giữ tên cũ cho chỗ khác còn import. */
export type GraderModel = ModelInfo;

export interface Provider {
  id: ProviderId;
  label: string;
  /** OpenAI-compatible base URL (không có ở anthropic – dùng SDK). */
  baseUrl?: string;
  keyHint: string;
  keyUrl?: string;
  models: ModelInfo[];
  /** Model mặc định cho chấm bài và cho tác vụ nhẹ (dịch, tra từ). */
  main: string;
  light: string;
  /** Gọi được GET {baseUrl}/models để lấy danh sách thật. */
  listModels?: boolean;
  pricingUrl?: string;
}

export const PROVIDERS: Provider[] = [
  {
    id: 'anthropic', label: 'Claude', keyHint: 'sk-ant-api…', keyUrl: 'https://console.anthropic.com/settings/keys', pricingUrl: 'https://www.anthropic.com/pricing',
    main: 'claude-opus-5-5', light: 'claude-haiku-5-5',
    models: [
      { id: 'claude-opus-5-5', label: 'Opus 5.5', price: [4, 20], fallback: true, note: 'Mặc định – chấm kỹ, cân bằng giá.' },
      { id: 'claude-fable-5-1', label: 'Fable 5.1', price: [10, 50], fallback: true, note: 'Mạnh nhất, chậm và đắt nhất. Tổ chức bật zero data retention sẽ bị từ chối.' },
      { id: 'claude-opus-5', label: 'Opus 5', price: [5, 25], fallback: true, note: 'Đời Opus trước.' },
      { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5', price: [2, 10], fallback: true, note: 'Nhanh, rẻ bằng nửa Opus 5.5 – chấm vẫn tốt.' },
      { id: 'claude-haiku-5-5', label: 'Haiku 5.5', price: [0.1, 0.5], note: 'Rất rẻ và nhanh, nhận xét sơ sài hơn.' },
    ],
  },
  {
    id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', keyHint: 'sk-…', keyUrl: 'https://platform.deepseek.com/api_keys', pricingUrl: 'https://api-docs.deepseek.com/quick_start/pricing',
    main: 'deepseek-v4-pro', light: 'deepseek-flash', listModels: true,
    models: [
      { id: 'deepseek-v4-pro', label: 'V4 Pro', price: [1.74, 3.48], note: 'Model lớn của DeepSeek, rẻ hơn Claude nhiều; tiếng Việt khá.' },
      { id: 'deepseek-flash', label: 'Flash', price: [0.15, 0.6], note: 'Rất rẻ, hợp cho dịch/tra từ. Giá thay đổi theo giờ cao/thấp điểm.' },
    ],
  },
  {
    id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', keyHint: 'sk-proj-…', keyUrl: 'https://platform.openai.com/api-keys', pricingUrl: 'https://developers.openai.com/api/docs/pricing',
    main: 'gpt-6.1-terra', light: 'gpt-6-luna', listModels: true,
    models: [
      { id: 'gpt-6.1-terra', label: 'GPT-6.1 Terra', price: [1, 5], note: 'Cân bằng giá/chất lượng.' },
      { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol', price: [2, 10], note: 'Mạnh hơn, đắt gấp đôi.' },
      { id: 'gpt-6-luna', label: 'GPT-6 Luna', price: [0.1, 0.5], note: 'Rẻ, nhanh – hợp tác vụ nhẹ.' },
    ],
  },
  {
    id: 'gemini', label: 'Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', keyHint: 'AIza…', keyUrl: 'https://aistudio.google.com/apikey', pricingUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    main: 'gemini-3.8-flash', light: 'gemini-3.5-flash-lite', listModels: true,
    models: [
      { id: 'gemini-3.8-flash', label: '3.8 Flash', price: [0.75, 3.75], note: 'Nhanh, rẻ; có hạn mức miễn phí ở AI Studio.' },
      { id: 'gemini-4-argon', label: '4 Argon', price: [2, 10], note: 'Model suy luận mạnh nhất của Google.' },
      { id: 'gemini-3.5-flash-lite', label: '3.5 Flash-Lite', price: [0.3, 2.5], note: 'Rẻ nhất – cho dịch/tra từ.' },
    ],
  },
  {
    id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', keyHint: 'sk-or-…', keyUrl: 'https://openrouter.ai/settings/keys', pricingUrl: 'https://openrouter.ai/models',
    main: 'deepseek/deepseek-v4-pro', light: 'google/gemini-3.5-flash-lite', listModels: true,
    models: [
      { id: 'deepseek/deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
      { id: 'anthropic/claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
      { id: 'openai/gpt-6.1-terra', label: 'GPT-6.1 Terra' },
      { id: 'google/gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' },
    ],
  },
  {
    id: 'custom', label: 'Tuỳ chỉnh', keyHint: 'key của dịch vụ', main: '', light: '', listModels: true,
    models: [],
  },
];

export const providerOf = (id: string | undefined) => PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
export const GRADER_MODELS = PROVIDERS[0].models;
export const DEFAULT_MODEL = PROVIDERS[0].main;

export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Effort = (typeof EFFORTS)[number];
export const DEFAULT_EFFORT: Effort = 'medium';

export const EFFORT_NOTES: Record<Effort, string> = {
  low: 'Nhanh, rẻ nhất, nghĩ ít.',
  medium: 'Mặc định – đủ kỹ cho chấm bài.',
  high: 'Kỹ hơn, lâu và tốn hơn.',
  xhigh: 'Rất kỹ, tốn đáng kể.',
  max: 'Tối đa – lâu nhất, đắt nhất.',
};

/** Model Claude đang chọn; id lạ thì về mặc định. */
export const modelOf = (id: string) => GRADER_MODELS.find((m) => m.id === id) ?? GRADER_MODELS[0];
/** Thông tin model của nhà cung cấp bất kỳ; model gõ tay thì chỉ có id. */
export const modelInfo = (p: Provider, id: string): ModelInfo => p.models.find((m) => m.id === id) ?? { id, label: id };
export const effortOf = (e: string): Effort => ((EFFORTS as readonly string[]).includes(e) ? (e as Effort) : DEFAULT_EFFORT);
