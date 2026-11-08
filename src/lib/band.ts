// Quy đổi điểm thô → band IELTS (bảng tham khảo công bố rộng rãi của IELTS, đề 40 câu).
// Với đề ngắn hơn 40 câu, app nhân tỉ lệ về thang 40 rồi tra bảng (ước lượng).

const LISTENING: [number, number][] = [[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5]];
const READING_AC: [number, number][] = [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5]];
const READING_GT: [number, number][] = [[40, 9], [39, 8.5], [37, 8], [36, 7.5], [34, 7], [32, 6.5], [30, 6], [27, 5.5], [23, 5], [19, 4.5], [15, 4], [12, 3.5], [9, 3], [6, 2.5]];

export function rawToBand(skill: 'listening' | 'reading', raw: number, max: number, module: 'academic' | 'general' = 'academic') {
  if (max <= 0) return 0;
  const scaled = Math.round((raw / max) * 40);
  const table = skill === 'listening' ? LISTENING : module === 'general' ? READING_GT : READING_AC;
  for (const [cut, band] of table) if (scaled >= cut) return band;
  return scaled > 0 ? 2 : 1;
}

/** Band tổng Writing/Speaking = trung bình 4 tiêu chí, làm tròn xuống 0.5 (cách IELTS tính overall band ở cấp tiêu chí). */
export function criteriaBand(scores: number[]) {
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.floor(avg * 2) / 2;
}

/** Band tổng cả 4 kỹ năng: trung bình, .25 → lên .5, .75 → lên 1. */
export function overallBand(bands: number[]) {
  const avg = bands.reduce((a, b) => a + b, 0) / bands.length;
  const floor = Math.floor(avg);
  const frac = avg - floor;
  if (frac >= 0.75) return floor + 1;
  if (frac >= 0.25) return floor + 0.5;
  return floor;
}

export const fmtBand = (b: number | null | undefined) => (b == null ? '–' : Number.isInteger(b) ? String(b) : b.toFixed(1));

export function bandColor(b: number) {
  return b >= 7 ? 'var(--ok)' : b >= 5.5 ? 'var(--mid)' : 'var(--no)';
}

export const BAND_DESC: Record<number, string> = {
  9: 'Expert – thành thạo hoàn toàn',
  8: 'Very good – rất tốt, hiếm lỗi',
  7: 'Good – tốt, thỉnh thoảng sai',
  6: 'Competent – khá, còn lỗi nhưng hiểu được',
  5: 'Modest – trung bình, nhiều lỗi',
  4: 'Limited – hạn chế',
  3: 'Extremely limited',
};
