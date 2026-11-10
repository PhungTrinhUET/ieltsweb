// Trang chủ dạng bảng điều khiển: tiếp tục bài dở, nhiệm vụ hôm nay, tiến độ band, 4 kỹ năng, từ vựng.
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, BookMarked, CheckCircle2, Circle, Flame, Sparkles, GraduationCap, Keyboard, Layers, PlayCircle, Target, Timer, Trophy, ChevronRight } from 'lucide-react';
import { useDb } from '../db';
import { getLastOpen, getStreak, useSettings } from '../store';
import { BackupReminder } from '../components/BackupPanel';
import { MODE_LABEL, countsForBand } from '../lib/attempts';
import { AUTHORS, Avatar } from './About';
import { SKILL_META } from './SkillList';
import type { Attempt, Skill } from '../types';
import { dueCards, startOfDay } from '../lib/srs';
import { activeDays, dayKey as localDay, logsSince, streakOf, todayPlan, xpSum } from '../lib/stats';
import { fmtBand, overallBand } from '../lib/band';
import { Ring } from '../components/ui';
import { Logo } from '../App';

const SKILLS: Skill[] = ['reading', 'listening', 'speaking', 'writing'];

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? 'Chào buổi sáng' : h < 14 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
}

export default function Home() {
  const db = useDb();
  const s = useSettings();
  const days = activeDays(db.logs, db.attempts, getStreak().days);
  const streak = streakOf(days);
  const xpToday = xpSum(logsSince(db.logs, startOfDay()));
  const cards = Object.values(db.vocab);
  const due = dueCards(cards).length;
  const latest = (skill: Skill) => db.attempts.find((a) => a.skill === skill && countsForBand(a));
  const bands = SKILLS.map((k) => latest(k)?.band).filter((b): b is number => !!b);
  const overall = bands.length ? overallBand(bands) : null;
  const all = Object.values(db.materials);
  const count = (skill: Skill) => all.filter((m) => m.skill === skill).length;
  const done = (skill: Skill) => new Set(db.attempts.filter((a) => a.skill === skill).map((a) => a.materialId)).size;
  const recent = db.attempts.slice(0, 4);

  // Bài đang học dở → nút Tiếp tục; chưa có thì gợi ý bài Reading đầu tiên.
  const last = getLastOpen();
  const lastM = last ? db.materials[last.id] : undefined;
  const firstReading = all.filter((m) => m.skill === 'reading' && m.id.startsWith('vol')).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))[0];
  const resume = lastM ? { m: lastM, path: last!.path, mode: last!.mode } : firstReading ? { m: firstReading, path: `/reading/${firstReading.id}/practice`, mode: 'practice' as const } : null;

  // Kế hoạch hôm nay: Ôn N từ → Học 5 từ mới → Nghe chép 10 câu → Đoạn ngữ cảnh (+ một bài luyện đề).
  const today = localDay();
  const plan = todayPlan(cards, db.logs, { newPerDay: s.newCardsPerDay });
  const examDone = db.attempts.some((a) => localDay(a.at) === today);
  const tasks = [
    ...plan.map((p) => ({ id: p.id, done: p.done, label: p.label, sub: p.sub, to: p.to })),
    { id: 'exam', done: examDone, label: 'Một bài luyện đề', sub: 'Reading, Listening, Speaking hoặc Writing', to: resume?.path ?? '/reading' },
  ];
  const doneN = tasks.filter((t) => t.done).length;

  // 7 ngày gần nhất cho dải chuỗi ngày học.
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 864e5);
    return { d, on: days.has(localDay(d)) };
  });

  return (
    <div className="page home">
      <div className="topbar topbar--home"><div className="topbar__brand"><Logo /> <strong>IELTS Practice</strong></div></div>

      <header className="home__head">
        <div>
          <p className="home__date">{new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="home__hello">{greeting()} 👋</h1>
        </div>
        <div className="home__pills">
          <span className="pill pill--fire" title="Số ngày học liên tiếp"><Flame size={16} /> <span data-testid="home-streak">{streak}</span> ngày</span>
          <Link to="/stats" className="pill pill--xp" title="XP hôm nay (từ vựng + nghe-chép) – xem Thống kê"><Sparkles size={16} /> <span data-testid="home-xp">{xpToday}</span> XP</Link>
          <Link to="/settings" className="pill" title="Đổi mục tiêu trong Cài đặt"><Target size={16} /> Mục tiêu {fmtBand(s.targetBand)}</Link>
        </div>
      </header>
      <BackupReminder />

      <div className="home__grid">
        {/* Tiếp tục học */}
        <section className="hcard hcard--resume">
          <div className="hcard__eyebrow">{lastM ? 'Tiếp tục học' : 'Bắt đầu từ đây'}</div>
          {resume ? (
            <>
              <h2 className="resume__title">{resume.m.title}</h2>
              <p className="resume__sub">
                {SKILL_META[resume.m.skill].label} · {resume.mode === 'practice' ? 'Luyện tập' : 'Thi thử'}
                {!lastM && ' · không tính giờ, bấm từ để tra nghĩa'}
              </p>
              <div className="resume__actions">
                <Link to={resume.path} className="btn btn--light"><PlayCircle size={18} /> {lastM ? 'Học tiếp' : 'Bắt đầu'}</Link>
                <Link to={`/${resume.m.skill}`} className="btn btn--glass">Chọn bài khác</Link>
              </div>
            </>
          ) : (
            <>
              <h2 className="resume__title">Chưa có đề nào</h2>
              <div className="resume__actions"><Link to="/library" className="btn btn--light">Nạp tài liệu</Link></div>
            </>
          )}
          <div className="resume__week" aria-label="7 ngày gần nhất">
            {week.map(({ d, on }, i) => (
              <span key={i} className={`wday${on ? ' is-on' : ''}${i === 6 ? ' is-today' : ''}`}>
                <i>{on ? <Flame size={13} /> : null}</i>
                <small>{i === 6 ? 'Nay' : ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()]}</small>
              </span>
            ))}
          </div>
        </section>

        {/* Nhiệm vụ hôm nay */}
        <section className="hcard" data-testid="home-plan">
          <div className="hcard__head">
            <h2 className="hcard__title">Hôm nay</h2>
            <Link to="/stats" className="muted small"><BarChart3 size={13} /> {doneN}/{tasks.length} việc</Link>
          </div>
          <div className="today__bar"><span style={{ width: `${(doneN / tasks.length) * 100}%` }} /></div>
          <ul className="today">
            {tasks.map((t) => (
              <li key={t.id}>
                <Link to={t.to} className={`today__item${t.done ? ' is-done' : ''}`} data-plan={t.id} data-done={t.done ? '' : undefined}>
                  {t.done ? <CheckCircle2 size={20} className="today__ic" /> : <Circle size={20} className="today__ic" />}
                  <span className="today__label">{t.label}<span className="today__sub">{t.sub}</span></span>
                  <ArrowRight size={15} className="today__time" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Band */}
        <section className="hcard hcard--band">
          <div className="hcard__head">
            <h2 className="hcard__title">Band ước tính</h2>
            <Link to="/history" className="muted small">Lịch sử <ArrowRight size={13} /></Link>
          </div>
          <div className="band">
            <Ring value={overall ? overall / 9 : 0} size={96} stroke={9}>
              <strong className="band__num">{fmtBand(overall)}</strong>
              <small className="muted">/ {fmtBand(s.targetBand)}</small>
            </Ring>
            <ul className="band__list">
              {SKILLS.map((k) => {
                const b = latest(k)?.band;
                return (
                  <li key={k} style={{ ['--skill' as string]: SKILL_META[k].color }}>
                    <span className="band__k">{SKILL_META[k].label}</span>
                    <span className="band__track"><span style={{ width: `${b ? (b / 9) * 100 : 0}%` }} /><i style={{ left: `${(s.targetBand / 9) * 100}%` }} /></span>
                    <strong className="band__v">{fmtBand(b)}</strong>
                  </li>
                );
              })}
            </ul>
          </div>
          {overall === null && <p className="small muted">Làm một bài Thi thử Reading/Listening hoặc cho AI chấm Writing/Speaking để có band.</p>}
        </section>
      </div>

      {/* 4 kỹ năng */}
      <h2 className="home__h2">Kỹ năng</h2>
      <div className="skills4">
        {SKILLS.map((k) => {
          const meta = SKILL_META[k]; const Icon = meta.icon; const n = count(k); const d = done(k);
          const dual = k === 'reading' || k === 'listening';
          return (
            <div key={k} className="skill4" style={{ ['--skill' as string]: meta.color }}>
              <Link to={`/${k}`} className="skill4__main">
                <span className="skill4__icon"><Icon size={22} /></span>
                <span className="skill4__name">{meta.label}</span>
                <span className="skill4__count">{n} bài · đã làm {d}</span>
                <span className="skill4__bar"><span style={{ width: `${n ? Math.max(d ? 3 : 0, (d / n) * 100) : 0}%` }} /></span>
              </Link>
              <div className="skill4__links">
                {dual ? (
                  <>
                    <Link to={`/${k}`} onClick={() => { try { localStorage.setItem(`ielts-mode-${k}`, 'practice'); } catch { /* */ } }}><GraduationCap size={14} /> Luyện tập</Link>
                    <Link to={`/${k}`} onClick={() => { try { localStorage.setItem(`ielts-mode-${k}`, 'test'); } catch { /* */ } }}><Timer size={14} /> Thi thử</Link>
                  </>
                ) : <Link to={`/${k}`}>{k === 'speaking' ? 'Luyện nói' : 'Viết & chấm'} <ArrowRight size={13} /></Link>}
              </div>
            </div>
          );
        })}
      </div>
      <Link to="/mock/full" className="dict-entry card fm-entry" data-testid="home-fullmock">
        <span className="dict-entry__ic"><Trophy size={22} /></span>
        <span><strong>Thi thử đủ 4 kỹ năng</strong><span className="small muted">Listening → Reading → Writing liền nhau như ngày thi (~2 giờ 40) + Speaking · ra band Overall</span></span>
        <ChevronRight size={18} />
      </Link>

      <div className="home__grid home__grid--2">
        {/* Từ vựng */}
        <section className="hcard hcard--vocab">
          <span className="vocab__ic"><BookMarked size={22} /></span>
          <div className="vocab__body">
            <h2 className="hcard__title">Vốn từ của bạn</h2>
            <p className="muted small">{cards.length ? <>{cards.length} từ đã lưu · <strong>{due}</strong> từ đến hạn ôn</> : 'Bấm vào từ bất kỳ trong bài ở chế độ Luyện tập để lưu kèm nghĩa, phiên âm và câu ví dụ.'}</p>
          </div>
          <Link to="/vocab" className={`btn ${due ? 'btn--primary' : 'btn--ghost'} btn--sm`}><Layers size={16} /> {due ? 'Ôn ngay' : 'Xem vốn từ'}</Link>
        </section>

        {/* Nghe & chép */}
        <section className="hcard hcard--vocab">
          <span className="vocab__ic"><Keyboard size={22} /></span>
          <div className="vocab__body">
            <h2 className="hcard__title">Nghe & chép</h2>
            <p className="muted small">Nghe từng câu rồi gõ lại: số, tên, đánh vần (cấp 1) đến bài giảng Section 4 (cấp 4).</p>
          </div>
          <Link to="/dictation" className="btn btn--ghost btn--sm" data-testid="home-dict"><Keyboard size={16} /> Luyện</Link>
        </section>

        {/* Hoạt động gần đây */}
        <section className="hcard">
          <div className="hcard__head">
            <h2 className="hcard__title">Gần đây</h2>
            {recent.length > 0 && <Link to="/history" className="muted small">Xem tất cả <ArrowRight size={13} /></Link>}
          </div>
          {recent.length ? (
            <ul className="recent">
              {recent.map((a) => (
                <li key={a.id} style={{ ['--skill' as string]: SKILL_META[a.skill].color }}>
                  <Link to={`/history/${a.id}`} className="recent__link">
                  <span className="recent__score">{a.band ? fmtBand(a.band) : a.max ? `${a.score}/${a.max}` : '✓'}</span>
                  <span className="recent__body"><span className="recent__title">{a.title}</span><small className="muted">{SKILL_META[a.skill].label} · {MODE_LABEL[a.mode]} · {new Date(a.at).toLocaleDateString('vi-VN')}</small></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="muted small">Chưa có bài nào. Kết quả các bài Thi thử và bài được AI chấm sẽ hiện ở đây.</p>}
        </section>
      </div>

      <Link to="/about" className="card home-about" data-testid="home-about">
        <span className="home-about__av">{AUTHORS.map((a) => <Avatar key={a.initials} a={a} size={40} />)}</span>
        <span><strong>Về nhóm tác giả</strong><span className="small muted">{AUTHORS.map((a) => a.name).join(' · ')} · Trường ĐH Công nghệ, ĐHQG HN</span></span>
        <ChevronRight size={18} />
      </Link>

      <p className="home__foot muted small">
        Kho đề: {count('reading')} bài Reading · {count('listening')} section Listening · {count('speaking')} bộ Speaking · {count('writing')} đề Writing ·{' '}
        <Link to="/guide">Cẩm nang dùng app</Link>
      </p>
    </div>
  );
}
