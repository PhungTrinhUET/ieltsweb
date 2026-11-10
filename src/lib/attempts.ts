// Lượt làm bài: nhãn chế độ, lượt nào tính vào band ước tính.
import type { Attempt } from '../types';

export const MODE_LABEL: Record<Attempt['mode'], string> = {
  test: 'Thi thử', dictation: 'Nghe-chép', gapfill: 'Điền từ', ai: 'AI chấm', self: 'Tự chấm', practice: 'Luyện tập', 'full-mock': 'Thi thử 4 kỹ năng',
};
/** Luyện tập (xem đáp án từng câu) không tính vào band trang chủ / biểu đồ. */
export const countsForBand = (a: Attempt) => !!a.band && a.mode !== 'practice' && a.mode !== 'full-mock';
