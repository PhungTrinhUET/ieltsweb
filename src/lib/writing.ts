// Dạng bài Writing: nhãn, cấu trúc gợi ý, mẹo, lỗi hay gặp – dùng chung cho trang đề và trang danh sách.
import type { Chart, WritingMaterial, WritingType } from '../types';

export const TYPE_LABEL: Record<WritingType, string> = {
  opinion: 'Opinion (agree/disagree)', discussion: 'Discussion (both views + opinion)', advantage: 'Advantages / disadvantages', problem: 'Problem / solution', double: 'Double question',
  development: 'Positive/Negative development',
  line: 'Line graph', bar: 'Bar chart', pie: 'Pie chart', table: 'Table', process: 'Process', map: 'Map', mixed: 'Mixed charts',
  'letter-formal': 'Formal letter', 'letter-semi': 'Semi-formal letter', 'letter-informal': 'Informal letter',
};

export type WTab = 't1a' | 't1g' | 't2';
export const TAB_TYPES: Record<WTab, WritingType[]> = {
  t1a: ['line', 'bar', 'pie', 'table', 'mixed', 'process', 'map'],
  t1g: ['letter-formal', 'letter-semi', 'letter-informal'],
  t2: ['opinion', 'discussion', 'advantage', 'problem', 'double', 'development'],
};
export const TAB_LABEL: Record<WTab, string> = { t1a: 'Task 1 Academic', t1g: 'Task 1 General', t2: 'Task 2' };
export const tabOf = (m: WritingMaterial): WTab => (m.task === 2 ? 't2' : m.module === 'general' || m.type.startsWith('letter') ? 't1g' : 't1a');

export const STRUCTURE: Record<WritingType, string[]> = {
  opinion: ['Intro: paraphrase + thesis rõ (I completely/partly agree…)', 'Body 1: lý do 1 + giải thích + ví dụ', 'Body 2: lý do 2 (hoặc mặt đối lập rồi phản bác nếu partly)', 'Conclusion: nhắc lại quan điểm'],
  discussion: ['Intro: paraphrase + nêu sẽ bàn cả hai + opinion', 'Body 1: quan điểm A – lý do, ví dụ', 'Body 2: quan điểm B – lý do, ví dụ', 'Conclusion: quan điểm cá nhân'],
  advantage: ['Intro: paraphrase + outline', 'Body 1: lợi ích (1–2 ý)', 'Body 2: bất lợi (1–2 ý)', 'Conclusion: cái nào lớn hơn (nếu đề hỏi outweigh)'],
  problem: ['Intro: paraphrase + outline', 'Body 1: vấn đề/nguyên nhân + hệ quả', 'Body 2: giải pháp tương ứng + ai thực hiện', 'Conclusion'],
  double: ['Intro: paraphrase + trả lời ngắn cả hai câu', 'Body 1: trả lời câu hỏi 1', 'Body 2: trả lời câu hỏi 2', 'Conclusion'],
  development: ['Intro: paraphrase + nêu rõ đây là thay đổi tích cực hay tiêu cực (hay tích cực nhiều hơn)', 'Body 1: mặt lợi – lý do, ví dụ', 'Body 2: mặt hại – lý do, ví dụ (hoặc vì sao hại nhỏ hơn lợi)', 'Đánh giá: cân hai mặt, vì sao nghiêng về một bên', 'Conclusion: nhắc lại positive/negative'],
  line: ['Intro: paraphrase (what, where, when)', 'Overview: 2 xu hướng chính (không số liệu)', 'Body 1: nhóm 1 – số liệu đầu/cuối, so sánh', 'Body 2: nhóm 2 – điểm nổi bật'],
  bar: ['Intro: paraphrase', 'Overview: cao nhất/thấp nhất, xu hướng chung', 'Body 1 + Body 2: nhóm theo danh mục, có số liệu'],
  pie: ['Intro', 'Overview: phần lớn nhất/nhỏ nhất, thay đổi lớn nhất', 'Body: so sánh các phần, số liệu'],
  table: ['Intro', 'Overview: hàng/cột nổi bật', 'Body: so sánh theo nhóm'],
  mixed: ['Intro: paraphrase cả hai biểu đồ trong 1 câu', 'Overview: ý chính của mỗi biểu đồ + liên hệ giữa chúng', 'Body 1: biểu đồ 1 – số liệu nổi bật', 'Body 2: biểu đồ 2 – số liệu nổi bật'],
  process: ['Intro: paraphrase', 'Overview: số bước, bắt đầu/kết thúc, tuần hoàn hay tuyến tính', 'Body 1: nửa đầu quy trình – câu bị động (is heated, are collected), từ nối trình tự (first, next, after that)', 'Body 2: nửa sau (finally, once…, the cycle then begins again)'],
  map: ['Intro: paraphrase (nơi nào, 2 thời điểm)', 'Overview: thay đổi lớn nhất giữa 2 thời điểm', 'Body 1: khu vực A – thêm/bớt/chuyển (has been replaced / was demolished)', 'Body 2: khu vực B; kế hoạch tương lai dùng will be + V3'],
  'letter-formal': ['Dear Sir or Madam,', 'Đoạn 1: lý do viết (I am writing to…)', 'Đoạn 2–3: lần lượt từng gạch đầu dòng của đề', 'Đoạn cuối: hành động mong muốn (I would be grateful if…)', 'Yours faithfully, + họ tên đầy đủ'],
  'letter-semi': ['Dear Mr/Ms + họ (Dear Ms Smith,)', 'Lý do viết', 'Chi tiết theo từng gạch đầu dòng, lịch sự nhưng không cứng', 'Yours sincerely, / Kind regards, + họ tên'],
  'letter-informal': ['Dear + tên (Dear Anna,)', 'Mở thân mật (How are you? Sorry I haven\'t written…)', 'Chi tiết theo gạch đầu dòng, giọng tự nhiên, dùng contractions', 'Best wishes, / Love, + tên'],
};

const T2_TIPS = ['Đọc kỹ đề: gạch chân từ khoá, xác định đề hỏi mấy ý', 'Mỗi body 1 ý chính + giải thích + ví dụ cụ thể', 'Viết 260–300 từ, 4–5 đoạn, ~40 phút'];
export const TIPS: Record<WritingType, { tips: string[]; mistake: string }> = {
  opinion: { tips: [...T2_TIPS, 'Nêu quan điểm ngay ở mở bài và giữ nhất quán đến kết bài'], mistake: 'Bàn cả hai phía mà không nói rõ mình đồng ý đến mức nào.' },
  discussion: { tips: [...T2_TIPS, 'Hai body cân nhau; ý kiến riêng nêu ở mở bài và kết bài'], mistake: 'Quên nêu quan điểm cá nhân ("and give your own opinion").' },
  advantage: { tips: [...T2_TIPS, 'Nếu đề hỏi "outweigh" phải kết luận rõ bên nào lớn hơn'], mistake: 'Đề hỏi outweigh nhưng chỉ liệt kê lợi/hại, không so sánh.' },
  problem: { tips: [...T2_TIPS, 'Giải pháp phải khớp với từng vấn đề đã nêu'], mistake: 'Giải pháp chung chung ("the government should do something").' },
  double: { tips: [...T2_TIPS, 'Trả lời đủ cả 2 câu hỏi, mỗi câu một body'], mistake: 'Dồn hết vào câu hỏi 1, câu hỏi 2 chỉ 1–2 câu.' },
  development: { tips: [...T2_TIPS, 'Đề hỏi "positive or negative development" → phải chọn một bên (hoặc nói rõ bên nào nhiều hơn)'], mistake: 'Viết như dạng advantages/disadvantages mà không kết luận positive hay negative.' },
  line: { tips: ['Overview nêu xu hướng chung, không số liệu', 'Nhóm các đường có xu hướng giống nhau', 'Dùng đa dạng: rose sharply, levelled off, peaked at', 'Viết 160–190 từ, ~20 phút'], mistake: 'Mô tả từng năm một (mechanical recounting) thay vì chọn điểm nổi bật.' },
  bar: { tips: ['Tìm cột cao nhất/thấp nhất và khác biệt lớn nhất', 'So sánh: twice as many as, slightly higher than', 'Nhóm danh mục thay vì kể từng cột', 'Viết 160–190 từ, ~20 phút'], mistake: 'Không có overview.' },
  pie: { tips: ['Dùng phân số/ngôn ngữ tỉ lệ: a quarter, just under half', 'So sánh 2 biểu đồ: phần nào tăng, giảm, đổi thứ hạng', 'Động từ: account for, make up, represent', 'Viết 160–190 từ'], mistake: 'Dùng "increase" cho tỉ lệ mà quên nói đó là tỉ lệ (the proportion of…).' },
  table: { tips: ['Đọc theo hàng và theo cột để tìm điểm nổi bật', 'Không cần nhắc mọi con số', 'Nhóm các hàng tương tự', 'Viết 160–190 từ'], mistake: 'Chép lại cả bảng thành chữ.' },
  mixed: { tips: ['Overview phải có ý chính của CẢ HAI biểu đồ', 'Mỗi body một biểu đồ, có thể nối ý giữa hai', 'Chọn lọc số liệu – không đủ chỗ cho mọi con số'], mistake: 'Chỉ mô tả một biểu đồ, bỏ quên biểu đồ còn lại.' },
  process: { tips: ['Đếm số bước, xác định điểm đầu/cuối', 'Dùng bị động hiện tại: is collected, are heated', 'Từ nối trình tự: first, then, after that, once, finally', 'Viết 160–180 từ'], mistake: 'Dùng chủ động và "I" ("we put the leaves…") hoặc bỏ sót bước.' },
  map: { tips: ['So sánh 2 thời điểm: cái gì mới, mất, chuyển chỗ', 'Quá khứ → hiện tại: has been replaced/converted', 'Kế hoạch: will be built', 'Dùng hướng: to the north of, adjacent to'], mistake: 'Mô tả từng bản đồ riêng mà không so sánh.' },
  'letter-formal': { tips: ['Đủ 3 gạch đầu dòng, mỗi ý một đoạn', 'Không viết tắt (I am, không phải I\'m)', 'Dear Sir or Madam → Yours faithfully', 'Viết 160–190 từ, ~20 phút'], mistake: 'Kết thư "Yours sincerely" khi mở bằng "Dear Sir or Madam".' },
  'letter-semi': { tips: ['Đủ 3 gạch đầu dòng', 'Biết tên người nhận: Dear Mr Brown → Yours sincerely / Kind regards', 'Lịch sự nhưng tự nhiên hơn thư formal'], mistake: 'Gọi người nhận bằng tên riêng (Dear John) trong thư bán trang trọng.' },
  'letter-informal': { tips: ['Đủ 3 gạch đầu dòng', 'Giọng thân mật: contractions, phrasal verbs', 'Dear Anna → Best wishes / Love', 'Đừng quá suồng sã (không dùng "wanna", emoji)'], mistake: 'Viết quá trang trọng ("I am writing to inform you…") cho thư gửi bạn.' },
};

/** Đề: bỏ dòng "You should spend about…" (đã có ở banner), tách đoạn theo dòng trống. */
export function promptParas(prompt: string): string[] {
  return prompt.replace(/\r/g, '').split(/\n\s*\n/).map((p) => p.split('\n').filter((l) => !/^\s*You should spend about/i.test(l)).join('\n').trim()).filter(Boolean);
}

/** Danh sách biểu đồ của một đề (chart + charts). */
export const chartsOf = (m: WritingMaterial): Chart[] => [...(m.chart ? [m.chart] : []), ...(m.charts ?? [])];

/** "Đề tự soạn" | "VOL N · Test M" | "VOL N · Đề Writing lẻ" (vol 0 không bao giờ hiện "VOL 0"). */
export function sourceLabel(m: { id: string }, parsed: { vol: number; test: number } | null, bankTest: number): string {
  if (!parsed || !parsed.vol) return m.id.startsWith('wr-') ? 'Đề tự soạn' : 'Bài mẫu / tự nạp';
  return `VOL ${parsed.vol} · ${parsed.test === bankTest ? 'Đề Writing lẻ' : `Test ${parsed.test}`}`;
}
