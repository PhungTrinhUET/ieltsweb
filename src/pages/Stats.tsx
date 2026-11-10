// C. Thống kê chung Từ vựng + Nghe-chép: trạng thái thẻ, dự báo 7 ngày, retention 30 ngày, câu chép đúng, XP + chuỗi ngày, lịch hoạt động.
import { Link } from 'react-router-dom';
import { BarChart3, Flame, Keyboard, Sparkles } from 'lucide-react';
import { useDb } from '../db';
import { getStreak } from '../store';
import { STATE_NAMES, STATE_ORDER, startOfDay } from '../lib/srs';
import { activeDays, dayKey, dictStats, forecast, heatmap, logsSince, retention30, stateCounts, streakOf, xpSum } from '../lib/stats';

const DOW = ['T2', '', 'T4', '', 'T6', '', 'CN'];
const level = (xp: number, n: number) => (!n ? 0 : xp >= 60 ? 4 : xp >= 30 ? 3 : xp >= 10 ? 2 : 1);

export default function Stats() {
  const db = useDb();
  const cards = Object.values(db.vocab);
  const words = cards.filter((c) => c.kind !== 'sentence');
  const sentences = cards.length - words.length;
  const counts = stateCounts(cards);
  const fc = forecast(cards, 7);
  const fcMax = Math.max(1, ...fc);
  const ret = retention30(db.logs);
  const dict = dictStats(db.logs);
  const days = activeDays(db.logs, db.attempts, getStreak().days);
  const streak = streakOf(days);
  const xpToday = xpSum(logsSince(db.logs, startOfDay()));
  const xpAll = xpSum(db.logs);
  const cells = heatmap(db.logs, db.attempts, 18);
  const activeN = cells.filter((c) => c.n).length;

  return (
    <div className="page lt stats" data-testid="stats" style={{ ['--skill' as string]: 'var(--primary)' }}>
      <div className="page-head">
        <span className="skill__icon skill__icon--lg"><BarChart3 size={26} /></span>
        <div><h1>Thống kê</h1><p>Từ vựng và Nghe-chép dùng chung XP, chuỗi ngày học và lịch hoạt động.</p></div>
      </div>

      <div className="st-kpis">
        <div className="st-kpi"><Flame size={18} className="st-kpi__ic st-kpi__ic--fire" /><strong data-testid="st-streak">{streak}</strong><span>ngày liên tiếp</span></div>
        <div className="st-kpi"><Sparkles size={18} className="st-kpi__ic" /><strong data-testid="st-xp">{xpToday}</strong><span>XP hôm nay · tổng {xpAll}</span></div>
        <div className="st-kpi"><strong>{ret.rate == null ? '—' : `${Math.round(ret.rate * 100)}%`}</strong><span>nhớ khi ôn (30 ngày · {ret.n} lượt)</span></div>
        <div className="st-kpi"><Keyboard size={18} className="st-kpi__ic" /><strong data-testid="st-dict">{dict.right}</strong><span>câu chép đúng{dict.avg30 != null ? ` · TB 30 ngày ${Math.round(dict.avg30 * 100)}%` : ''}</span></div>
      </div>

      <section className="card pad stack">
        <div className="row-between"><h2 className="h3">Thẻ theo trạng thái</h2><Link to="/vocab" className="small">Sổ từ →</Link></div>
        <div className="lt-boxes">
          {STATE_ORDER.map((s) => <Link key={s} to="/vocab" className={`lt-box st--${s}`}><strong>{counts[s]}</strong><span>{STATE_NAMES[s]}</span></Link>)}
        </div>
        <p className="small muted">{words.length} từ · {sentences} câu hay sai (ôn bằng chép lại)</p>
      </section>

      <section className="card pad stack">
        <h2 className="h3">Dự báo ôn 7 ngày tới</h2>
        <div className="st-fc" role="img" aria-label={`Số thẻ đến hạn: ${fc.join(', ')}`}>
          {fc.map((n, i) => {
            const d = new Date(startOfDay() + i * 864e5);
            return (
              <div key={i} className="st-fc__col">
                <span className="st-fc__n">{n}</span>
                <span className="st-fc__bar" style={{ height: `${(n / fcMax) * 100}%` }} />
                <small>{i === 0 ? 'Nay' : i === 1 ? 'Mai' : ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()]}</small>
              </div>
            );
          })}
        </div>
        <p className="small muted">"Nay" gồm cả thẻ quá hạn.</p>
      </section>

      <section className="card pad stack">
        <div className="row-between"><h2 className="h3">Lịch hoạt động</h2><span className="small muted">{activeN} ngày có học / 18 tuần</span></div>
        <div className="st-heat-wrap">
          <div className="st-heat__dow">{DOW.map((d, i) => <small key={i}>{d}</small>)}</div>
          <div className="st-heat" data-testid="st-heat">
            {cells.map((c) => (
              <span key={c.key} className={`st-heat__c l${c.future ? 'x' : level(c.xp, c.n)}${c.key === dayKey() ? ' is-today' : ''}`}
                title={c.future ? '' : `${new Date(c.t).toLocaleDateString('vi-VN')}: ${c.n ? `${c.n} lượt · ${c.xp} XP` : 'không học'}`} />
            ))}
          </div>
        </div>
        <div className="st-heat__legend small muted">Ít <span className="st-heat__c l0" /><span className="st-heat__c l1" /><span className="st-heat__c l2" /><span className="st-heat__c l3" /><span className="st-heat__c l4" /> Nhiều</div>
      </section>

      <section className="card pad stack">
        <h2 className="h3">Nghe & chép</h2>
        <p className="small">Đã chép {dict.total} câu · đúng ≥ 90%: <strong>{dict.right}</strong> (30 ngày: {dict.right30}).</p>
        <Link to="/dictation" className="btn btn--ghost btn--sm" style={{ alignSelf: 'flex-start' }}><Keyboard size={15} /> Luyện tiếp</Link>
      </section>
    </div>
  );
}
