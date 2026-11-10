// Trình hướng dẫn cài AI (Cài đặt → AI, Cẩm nang): các cách dùng, bước lấy key, bảng so sánh giá.
//   Số liệu ghi ngày UPDATED – giá và hạn mức đổi thường xuyên, luôn kèm link trang chính thức.
import type { ProviderId } from './models';

export const UPDATED = '10/11/2026';
/** Tỉ giá tham khảo để quy ra VND. */
export const USD_VND = 26_300;
/** Một bài chấm Writing/Speaking ≈ 3000 token vào (đề + bài + rubric) + 2500 token ra (chưa tính token suy luận). */
export const ESSAY_TOKENS = { in: 3000, out: 2500 };
export const essayCost = ([i, o]: [number, number]) => (ESSAY_TOKENS.in * i + ESSAY_TOKENS.out * o) / 1e6;
export const fmtUsd = (n: number) => `$${n < 0.01 ? n.toFixed(4) : n < 1 ? n.toFixed(3) : n.toFixed(2)}`;
export const fmtVnd = (n: number) => `≈ ${Math.max(1, Math.round((n * USD_VND) / 10) * 10).toLocaleString('vi-VN')} đ`;

export type MethodId = 'proxy' | 'gemini' | 'or-free' | 'anthropic' | 'openai' | 'deepseek' | 'openrouter' | 'custom';
export interface Method { id: MethodId; provider: ProviderId; title: string; tag: string; free?: boolean; desc: string }

export const METHODS: Method[] = [
  { id: 'proxy', provider: 'anthropic', title: 'Mã lớp (proxy)', tag: 'Miễn phí cho học viên', free: true, desc: 'Giáo viên/người quản lý lớp cấp địa chỉ + mã truy cập. Không cần tài khoản hay thẻ.' },
  { id: 'gemini', provider: 'gemini', title: 'Gemini miễn phí', tag: 'Không cần thẻ', free: true, desc: 'Key Google AI Studio, có hạn mức miễn phí mỗi ngày (Flash / Flash-Lite).' },
  { id: 'or-free', provider: 'openrouter', title: 'OpenRouter :free', tag: 'Không cần thẻ', free: true, desc: 'Các model đuôi “:free”: 50 lượt/ngày, nhiều hơn nếu đã nạp ≥ $10.' },
  { id: 'anthropic', provider: 'anthropic', title: 'Claude', tag: 'Trả phí · kỹ nhất', desc: 'Nhận xét chi tiết, tiếng Việt tự nhiên. Opus ≈ $0.06/bài, Sonnet ≈ $0.03.' },
  { id: 'openai', provider: 'openai', title: 'OpenAI', tag: 'Trả phí · kỹ', desc: 'GPT-6.1 Terra ≈ $0.016/bài. Nạp tối thiểu $5.' },
  { id: 'deepseek', provider: 'deepseek', title: 'DeepSeek', tag: 'Trả phí · rẻ', desc: 'V4 Pro ≈ $0.014/bài, nạp trước bao nhiêu dùng bấy nhiêu.' },
  { id: 'openrouter', provider: 'openrouter', title: 'OpenRouter', tag: 'Trả phí · một key', desc: 'Một key dùng được Claude, GPT, Gemini, DeepSeek… giá theo từng model.' },
];

export const QUICK_PICK = 'Mới thử → Gemini miễn phí (chọn Flash-Lite cho dịch/tra từ để đỡ tốn lượt); học thường xuyên, muốn rẻ → DeepSeek; muốn nhận xét kỹ nhất → Claude.';

export interface KeyGuide { url?: string; urlLabel?: string; steps: string[]; prefix?: string; notes?: string[] }
export const KEY_STEPS: Record<MethodId, KeyGuide> = {
  proxy: { steps: ['Xin giáo viên / người quản lý lớp hai thứ: địa chỉ proxy (dạng https://…) và mã truy cập.', 'Dán vào bước 3 rồi bấm “Kiểm tra kết nối”.'],
    notes: ['Số lượt mỗi ngày do người cấp mã đặt. Hết lượt thì chờ sang ngày mới hoặc hỏi lại giáo viên.'] },
  gemini: { url: 'https://aistudio.google.com/apikey', urlLabel: 'aistudio.google.com/apikey', prefix: 'AIza…',
    steps: ['Mở aistudio.google.com/apikey, đăng nhập tài khoản Google.', 'Bấm “Create API key” (chọn hoặc tạo một project).', 'Chép key bắt đầu bằng AIza… – không cần thẻ thanh toán.'],
    notes: ['Bậc miễn phí: Google có thể dùng nội dung bạn gửi để cải thiện sản phẩm → đừng dán thông tin cá nhân vào bài.', 'Hạn mức tính theo project mỗi ngày (người dùng báo 3.8 Flash khoảng 20 lượt/ngày), đặt lại lúc 0h giờ Thái Bình Dương ≈ 14–15h giờ Việt Nam.'] },
  'or-free': { url: 'https://openrouter.ai/settings/keys', urlLabel: 'openrouter.ai/settings/keys', prefix: 'sk-or-…',
    steps: ['Đăng ký openrouter.ai (Google hoặc GitHub).', 'Settings → Keys → Create key.', 'Chép key sk-or-…, dán ở bước 3, rồi bấm “Chỉ hiện model miễn phí” và chọn một model.'],
    notes: ['Model “:free”: 50 lượt/ngày nếu chưa từng nạp, 1000 lượt/ngày khi đã nạp ≥ $10; khoảng 20 lượt/phút. Model miễn phí hay thay đổi hoặc quá tải.'] },
  openrouter: { url: 'https://openrouter.ai/settings/keys', urlLabel: 'openrouter.ai/settings/keys', prefix: 'sk-or-…',
    steps: ['Đăng ký openrouter.ai, vào Credits để nạp tiền.', 'Settings → Keys → Create key, đặt Credit limit (vd $2) để không tiêu quá tay.', 'Chép key sk-or-…'] },
  deepseek: { url: 'https://platform.deepseek.com', urlLabel: 'platform.deepseek.com', prefix: 'sk-…',
    steps: ['Đăng ký platform.deepseek.com.', 'Top up: nạp tiền trước (số dư được tặng, nếu có, dùng trước).', 'API keys → Create new API key → chép key sk-… (chỉ hiện một lần).'] },
  anthropic: { url: 'https://console.anthropic.com', urlLabel: 'console.anthropic.com', prefix: 'sk-ant-api…',
    steps: ['Đăng ký console.anthropic.com.', 'Tuỳ chọn: bấm Claim – có thể nhận $5 dùng thử một lần sau khi xác minh số điện thoại (không nhận số ảo/VoIP).', 'Billing → nạp credit.', 'API keys → Create Key → chép key sk-ant-api…'] },
  openai: { url: 'https://platform.openai.com', urlLabel: 'platform.openai.com', prefix: 'sk-proj-…',
    steps: ['Đăng ký platform.openai.com.', 'Billing → thêm thẻ, nạp tối thiểu $5 (credit hết hạn sau 1 năm, không hoàn tiền).', 'API keys → Create new secret key → chép key sk-proj-…'] },
  custom: { steps: ['Nhập Base URL của dịch vụ tương thích OpenAI (vd Ollama: http://localhost:11434/v1), tên model và key nếu có.'] },
};
export const KEY_NOTES = [
  'Key giống mật khẩu, không gửi cho ai.',
  'Key chỉ lưu trong trình duyệt này; không nằm trong file sao lưu trừ khi bạn tự chọn kèm.',
  'Đặt giới hạn chi tiêu ở trang nhà cung cấp; lộ key thì xoá key đó ngay và tạo key mới.',
  'Nạp tiền cần thẻ Visa/Mastercard quốc tế.',
];

export interface CompareRow { name: string; free: string; paid: string; essay: string; note: string; url?: string }
export const COMPARE: CompareRow[] = [
  { name: 'Mã lớp (proxy)', free: 'Học viên 0 đ', paid: 'Giáo viên trả', essay: '0 đ', note: 'Giới hạn lượt/ngày do giáo viên đặt.' },
  { name: 'Gemini', free: 'Flash / Flash-Lite miễn phí, không cần thẻ; hạn mức theo project/ngày (3.8 Flash ~20 lượt/ngày theo người dùng). Pro/Argon không miễn phí.', paid: '3.8 Flash $0.75 / $3.75 đến 31/12/2026, sau đó $1.50 / $7.50 · 4 Argon $2 / $10 đến 30/11/2026, sau đó $4 / $20', essay: '3.8 Flash ≈ $0.012 (≈ $0.023 từ 2027)', note: 'Bậc miễn phí: nội dung có thể được Google dùng → không dán thông tin cá nhân.', url: 'https://ai.google.dev/gemini-api/docs/pricing' },
  { name: 'OpenRouter', free: 'Model “:free”: 50 lượt/ngày nếu chưa nạp, 1000 lượt/ngày khi đã nạp ≥ $10, ~20 lượt/phút', paid: 'Theo giá từng model', essay: 'Tuỳ model', note: 'Một key cho nhiều hãng.', url: 'https://openrouter.ai/models' },
  { name: 'DeepSeek', free: '—', paid: 'Nạp trước (số dư tặng dùng trước) · V4 Pro $1.74 / $3.48 · Flash $0.15 / $0.60', essay: 'V4 Pro ≈ $0.014', note: 'Rẻ, tiếng Việt khá.', url: 'https://api-docs.deepseek.com/quick_start/pricing' },
  { name: 'Claude', free: 'Có thể nhận $5 một lần sau khi xác minh số điện thoại (không nhận VoIP)', paid: 'Opus 5.5 $4 / $20 · Sonnet 5.5 $2 / $10 · Haiku 5.5 $0.10 / $0.50', essay: 'Opus ≈ $0.06 · Sonnet ≈ $0.03', note: 'Nhận xét kỹ nhất.', url: 'https://support.anthropic.com/en/articles/8994925' },
  { name: 'OpenAI', free: 'Không có bậc miễn phí', paid: 'Nạp trước tối thiểu $5, credit hết hạn sau 1 năm, không hoàn tiền · GPT-6.1 Terra $1 / $5', essay: 'Terra ≈ $0.016', note: '', url: 'https://help.openai.com/en/articles/8264778' },
];
export const SOURCES = [
  ['Gemini – giá', 'https://ai.google.dev/gemini-api/docs/pricing'],
  ['Gemini – hạn mức', 'https://ai.google.dev/gemini-api/docs/rate-limits'],
  ['OpenRouter – model miễn phí', 'https://openrouter.ai/blog/tutorials/free-llm-apis-compared'],
  ['Claude – credit dùng thử', 'https://support.anthropic.com/en/articles/8994925'],
  ['OpenAI – nạp trước', 'https://help.openai.com/en/articles/8264778'],
  ['DeepSeek – giá', 'https://api-docs.deepseek.com/quick_start/pricing'],
] as const;

/** Model miễn phí của OpenRouter (giá vào và ra đều 0). Không cần key. */
export async function freeOpenRouterModels(): Promise<{ id: string; name: string; ctx?: number }[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models');
  if (!res.ok) throw new Error(`OpenRouter trả lỗi ${res.status}`);
  const j = await res.json() as { data?: { id: string; name?: string; context_length?: number; pricing?: { prompt?: string; completion?: string } }[] };
  return (j.data ?? []).filter((m) => Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0)
    .map((m) => ({ id: m.id, name: m.name ?? m.id, ctx: m.context_length })).sort((a, b) => (b.ctx ?? 0) - (a.ctx ?? 0));
}
