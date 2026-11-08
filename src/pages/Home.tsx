import { Link } from 'react-router-dom';
import { ArrowRight, Flame, FolderInput, Layers, Sparkles } from 'lucide-react';
import { useDb } from '../db';
import { getStreak, useSettings } from '../store';
import { SKILL_META } from './SkillList';
import type { Skill } from '../types';
import { dueCards } from '../lib/srs';
import { fmtBand, overallBand } from '../lib/band';
import { Logo } from '../App';

const SKILLS: Skill[] = ['reading', 'listening', 'speaking', 'writing'];

export default function Home() {
  const db = useDb();
  const s = useSettings();
  const streak = getStreak();
  const due = dueCards(Object.values(db.vocab)).length;
  const latest = (skill: Skill) => db.attempts.find((a) => a.skill === skill && a.band);
  const bands = SKILLS.map((k) => latest(k)?.band).filter((b): b is number => !!b);
  const overall = bands.length === 4 ? overallBand(bands) : null;
  const count = (skill: Skill) => Object.values(db.materials).filter((m) => m.skill === skill).length;
  const recent = db.attempts.slice(0, 5);

  return (
    <div className="page">
      <div className="topbar topbar--home"><div className="topbar__brand"><Logo /> <strong>IELTS Practice</strong></div></div>
      <section className="hero">
        <div className="hero__text">
          <h1>Luyện IELTS theo cách của bạn</h1>
          <p>Nạp đề của riêng bạn, làm bài đúng format thi thật, học từ vựng theo lặp lại ngắt quãng, và để Claude chấm Writing / Speaking theo band descriptors.</p>
          <div className="hero__actions">
            <Link to="/library" className="btn btn--primary"><FolderInput size={18} /> Nạp tài liệu</Link>
            {due > 0 && <Link to="/vocab" className="btn btn--ghost"><Layers size={18} /> Ôn {due} từ đến hạn</Link>}
          </div>
        </div>
        <div className="hero__stats">
          <div className="hero__nums">
            <div><strong>{overall !== null ? fmtBand(overall) : '–'}</strong><span>band ước tính {overall === null && '(cần đủ 4 kỹ năng)'}</span></div>
            <div><strong>{s.targetBand}</strong><span>mục tiêu</span></div>
            <div><strong><Flame size={18} style={{ verticalAlign: -3 }} /> {streak.count}</strong><span>ngày liên tiếp</span></div>
          </div>
        </div>
      </section>

      <div className="part-grid part-grid--home">
        {SKILLS.map((k) => {
          const m = SKILL_META[k]; const Icon = m.icon; const l = latest(k);
          return (
            <Link key={k} to={`/${k}`} className="part-card" style={{ ['--skill' as string]: m.color }}>
              <div className="part-card__top"><span className="part-card__label"><Icon size={14} /> {m.label}</span><span className="part-card__count">{count(k)} bài</span></div>
              <div className="part-card__title">{m.desc}</div>
              <div className="part-card__meta">{l ? <>Gần nhất: band {fmtBand(l.band)}</> : 'Chưa có kết quả'}</div>
            </Link>
          );
        })}
      </div>

      <section className="card pad">
        <h2 className="h2"><Sparkles size={18} /> Lộ trình gợi ý mỗi ngày</h2>
        <ol className="plan">
          <li><strong>10 phút</strong> ôn từ vựng đến hạn (Từ vựng) – gõ lại, nghe phát âm.</li>
          <li><strong>20 phút</strong> một bài Reading có bấm giờ → chuyển sang <em>chế độ học</em>: đọc lại, dịch, lưu từ mới.</li>
          <li><strong>15 phút</strong> chép chính tả một đoạn Listening (Section 1–2 nếu mới bắt đầu, 3–4 khi quen).</li>
          <li><strong>15 phút</strong> Speaking Part 2: chuẩn bị 1 phút, nói 2 phút, nghe lại, để AI chấm và học câu mẫu.</li>
          <li>Cách ngày: <strong>40 phút</strong> viết Task 2 (hoặc 20 phút Task 1), nộp cho AI chấm, học bảng “nâng cấp cụm từ”.</li>
        </ol>
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="h2">Hoạt động gần đây <Link to="/history" className="muted small">Xem tất cả <ArrowRight size={13} /></Link></h2>
          <ul className="items items--1">
            {recent.map((a) => (
              <li key={a.id} className="item">
                <div className="item__no">{a.band ? fmtBand(a.band) : a.max ? `${a.score}/${a.max}` : '✓'}</div>
                <div className="item__body"><div className="item__title">{a.title}</div><div className="item__sub">{SKILL_META[a.skill].label} · {a.mode === 'test' ? 'Làm đề' : a.mode === 'dictation' ? 'Chép chính tả' : a.mode === 'gapfill' ? 'Điền từ' : 'AI chấm'} · {new Date(a.at).toLocaleDateString('vi-VN')}</div></div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
