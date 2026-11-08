// Checklist tự chấm theo 4 tiêu chí IELTS (Writing / Speaking) – dùng khi không có AI, hoặc để tự soát trước khi chấm AI.
import { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { fmtBand } from '../lib/band';
import { updateAttempt } from '../db';

type Crit = { name: string; items: string[] };
const WRITING: Record<1 | 2, Crit[]> = {
  1: [
    { name: 'Task Achievement', items: ['Có câu mở bài paraphrase đề (không chép nguyên)', 'Có đoạn overview nêu 2–3 đặc điểm/xu hướng chính, không kèm số liệu', 'Số liệu dẫn ra chính xác, chọn đúng điểm nổi bật', 'Có so sánh giữa các nhóm, không chỉ liệt kê', 'Không nêu ý kiến cá nhân'] },
    { name: 'Coherence & Cohesion', items: ['Chia đoạn hợp lý (nhóm số liệu theo đặc điểm)', 'Từ nối đa dạng (while, whereas, in contrast, followed by…), không lạm dụng', 'Dùng đại từ / từ thay thế, tránh lặp tên hạng mục'] },
    { name: 'Lexical Resource', items: ['Từ chỉ xu hướng đa dạng (rise, decline, plateau, fluctuate…)', 'Từ chỉ mức độ chính xác (slightly, sharply, roughly, approximately)', 'Không sai chính tả'] },
    { name: 'Grammatical Range & Accuracy', items: ['Có câu phức (mệnh đề quan hệ, while/whereas, bị động)', 'Thì động từ đúng với mốc thời gian của biểu đồ', 'Phần lớn câu không có lỗi'] },
  ],
  2: [
    { name: 'Task Response', items: ['Trả lời đủ mọi phần câu hỏi của đề', 'Quan điểm rõ ràng, nhất quán từ mở bài đến kết bài', 'Mỗi ý chính có lý do + giải thích + ví dụ cụ thể', 'Không lạc đề, không có ý thừa'] },
    { name: 'Coherence & Cohesion', items: ['Mỗi đoạn thân bài một ý chính, có câu chủ đề', 'Từ nối tự nhiên, đa dạng, không đặt máy móc đầu mọi câu', 'Dùng đại từ / từ thay thế để tránh lặp'] },
    { name: 'Lexical Resource', items: ['Paraphrase đề, không chép nguyên cụm', 'Dùng collocation / từ vựng chủ đề chính xác', 'Không sai chính tả, sai dạng từ'] },
    { name: 'Grammatical Range & Accuracy', items: ['Có nhiều loại câu phức (điều kiện, mệnh đề quan hệ, bị động…)', 'Phần lớn câu không có lỗi', 'Dấu câu, mạo từ, số ít/số nhiều đúng'] },
  ],
};
const SPEAKING: Crit[] = [
  { name: 'Fluency & Coherence', items: ['Nói liền mạch, ít ngập ngừng dài', 'Mở rộng câu trả lời (lý do, ví dụ), không chỉ trả lời một câu', 'Dùng từ nối khi nói (Well, Actually, The main reason is…)'] },
  { name: 'Lexical Resource', items: ['Dùng được từ vựng theo chủ đề, ít lặp từ', 'Có collocation / thành ngữ tự nhiên', 'Biết diễn đạt lại khi quên từ'] },
  { name: 'Grammatical Range & Accuracy', items: ['Có câu phức (because, although, if…)', 'Thì động từ đúng (quá khứ khi kể chuyện)', 'Phần lớn câu không có lỗi'] },
  { name: 'Pronunciation', items: ['Nghe lại bản ghi: phát âm rõ, người khác hiểu được', 'Có âm cuối (s, ed, t, k)', 'Trọng âm và ngữ điệu tự nhiên, không đều đều'] },
];

/** Band thô theo tỉ lệ mục đạt: 0% → 4, 100% → 8. */
const roughBand = (k: number, n: number) => Math.round((4 + (4 * k) / Math.max(1, n)) * 2) / 2;

export default function SelfCheck({ kind, task, attemptId, extra }: { kind: 'writing' | 'speaking'; task?: 1 | 2; attemptId?: string; extra?: string }) {
  const crits = kind === 'writing' ? WRITING[task ?? 2] : SPEAKING;
  const [on, setOn] = useState<Record<string, boolean>>({});
  const bands = crits.map((c) => roughBand(c.items.filter((it) => on[`${c.name}|${it}`]).length, c.items.length));
  const touched = Object.values(on).some(Boolean);
  const overall = Math.round((bands.reduce((a, b) => a + b, 0) / bands.length) * 2) / 2;
  const toggle = (k: string) => setOn((s) => {
    const next = { ...s, [k]: !s[k] };
    if (attemptId) {
      const bs = crits.map((c) => roughBand(c.items.filter((it) => next[`${c.name}|${it}`]).length, c.items.length));
      updateAttempt(attemptId, { selfBand: Math.round((bs.reduce((a, b) => a + b, 0) / bs.length) * 2) / 2, selfCheck: Object.keys(next).filter((x) => next[x]) });
    }
    return next;
  });
  return (
    <section className="card pad selfcheck">
      <div className="ai__head"><ClipboardCheck size={18} /> <strong>Tự chấm theo 4 tiêu chí</strong></div>
      <p className="small muted">So bài của bạn với bài mẫu, rồi đánh dấu những mục bạn đã làm được. {extra}</p>
      <div className="selfcheck__grid">
        {crits.map((c, ci) => (
          <div key={c.name} className="selfcheck__crit">
            <div className="row-between"><strong className="small">{c.name}</strong><span className="selfcheck__band">{touched ? fmtBand(bands[ci]) : '–'}</span></div>
            {c.items.map((it) => {
              const k = `${c.name}|${it}`;
              return <label key={k} className="selfcheck__item"><input type="checkbox" checked={!!on[k]} onChange={() => toggle(k)} /> <span>{it}</span></label>;
            })}
          </div>
        ))}
      </div>
      {touched && <p className="small">Band tự ước lượng: <strong>{fmtBand(overall)}</strong> <span className="muted">(rất thô, chỉ để tự theo dõi; không tính vào band ước tính ở trang chủ)</span></p>}
    </section>
  );
}
