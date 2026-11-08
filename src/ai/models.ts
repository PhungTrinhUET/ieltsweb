// Danh sách model / effort cho phần chấm Writing. Tách khỏi grader.ts để trang Cài đặt không phải tải SDK.

export interface GraderModel {
  id: string;
  label: string;
  /** Giá USD / 1 triệu token (input, output). */
  price: [number, number];
  /** Hỗ trợ fallbacks: 'default' (tự chạy lại trên model dự phòng khi bị bộ lọc an toàn từ chối). */
  fallback: boolean;
  note: string;
}

export const GRADER_MODELS: GraderModel[] = [
  { id: 'claude-opus-5-5', label: 'Opus 5.5', price: [4, 20], fallback: true, note: 'Mặc định – chấm kỹ, cân bằng giá.' },
  { id: 'claude-fable-5-1', label: 'Fable 5.1', price: [10, 50], fallback: true, note: 'Mạnh nhất, chậm và đắt nhất. Tổ chức bật zero data retention sẽ bị từ chối.' },
  { id: 'claude-opus-5', label: 'Opus 5', price: [5, 25], fallback: true, note: 'Đời Opus trước.' },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5', price: [2, 10], fallback: true, note: 'Nhanh, rẻ bằng nửa Opus 5.5 – chấm vẫn tốt.' },
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5', price: [0.1, 0.5], fallback: false, note: 'Rất rẻ và nhanh, nhận xét sơ sài hơn.' },
];

export const DEFAULT_MODEL = GRADER_MODELS[0].id;

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

/** Model đang chọn; id lạ (vd. model đã bỏ khỏi danh sách) thì về mặc định. */
export const modelOf = (id: string) => GRADER_MODELS.find((m) => m.id === id) ?? GRADER_MODELS[0];
export const effortOf = (e: string): Effort => ((EFFORTS as readonly string[]).includes(e) ? (e as Effort) : DEFAULT_EFFORT);
