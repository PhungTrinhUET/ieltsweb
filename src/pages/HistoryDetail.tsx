// Xem lại một lượt làm bài (#/history/:attemptId): câu trả lời từng câu + đáp án + giải thích (Reading/Listening),
// bài viết + kết quả AI (Writing), câu hỏi + bản ghi + transcript (Speaking), từng câu đã chép (Nghe-chép / Điền từ).
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ExternalLink, RotateCcw, Trash2, X } from 'lucide-react';
import type { Attempt, ListeningMaterial, Material, Question, QuestionGroup, ReadingMaterial, WritingMaterial } from '../types';
import { deleteAttempt, resolveUrl, useDb } from '../db';
import { GroupsView, isCorrect, correctText, type Answer, type Answers } from '../components/Questions';
import { Collapse } from '../components/ui';
import { SpeakingGradeView, WritingGradeView } from '../components/GradeViews';
import type { WritingGrade } from '../ai/writing';
import type { SpeakingGrade } from '../ai/speaking';
import { fmtBand } from '../lib/band';
import { MODE_LABEL } from '../lib/attempts';
import { parseId, partLabel } from '../lib/tests';
import { SKILL_META } from './SkillList';
import { FullMockResult } from './FullMock';

const LET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const OLD = 'Bản ghi cũ – không có câu trả lời chi tiết.';
const short = (s: string, n = 70) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

type RLPart = { id: string; title?: string; answers?: Answers; score?: number; max?: number; wrong?: number[] };
type Item = { text: string; typed: string; score: number; shown?: boolean; wrongWords: string[] };
type Turn = { question: string; answer?: string; seconds?: number; audio?: string };

/** Câu trả lời của người học dạng chữ ngắn. */
export function answerText(q: Question, a: Answer | undefined, g?: QuestionGroup): string {
  if (a === null || a === undefined || a === '' || (Array.isArray(a) && !a.length)) return '';
  switch (q.type) {
    case 'mcq': return typeof a === 'number' ? LET[a] : String(a);
    case 'multi': return Array.isArray(a) ? [...a].sort().map((i) => LET[i]).join(', ') : String(a);
    case 'match': { const b = q.options ?? g?.bank ?? []; return typeof a === 'number' ? short(b[a] ?? LET[a]) : String(a); }
    default: return String(a);
  }
}

/** Đường dẫn "Làm lại" và "Mở đề" theo loại lượt. */
function links(a: Attempt): { redo?: string; open?: string } {
  const d = (a.detail ?? {}) as { lesson?: string; parts?: RLPart[] };
  const first = a.materialId.split('+')[0];
  const p = parseId(first);
  const testHref = p && (a.skill === 'reading' || a.skill === 'listening') ? `/test/${a.skill}/${p.key}` : undefined;
  switch (a.mode) {
    case 'dictation': return { redo: d.lesson ? `/dictation/${encodeURIComponent(d.lesson)}` : '/dictation', open: a.materialId.startsWith('vol') ? `/listening/${a.materialId}/practice` : undefined };
    case 'gapfill': return { redo: `/listening/${a.materialId}/gapfill`, open: testHref ?? `/listening/${a.materialId}/practice` };
    case 'practice': return { redo: `/${a.skill}/${a.materialId}/practice`, open: testHref };
    case 'full-mock': return { redo: '/mock/full', open: undefined };
    default:
      if (a.skill === 'writing' || a.skill === 'speaking') return { redo: `/${a.skill}/${a.materialId}`, open: `/${a.skill}/${a.materialId}` };
      if (a.materialId.includes('+') || d.parts?.length) return { redo: p ? `/test/${a.skill}/${p.key}/full` : `/mock/${a.skill}`, open: testHref };
      return { redo: `/${a.skill}/${a.materialId}`, open: testHref };
  }
}

export default function HistoryDetail() {
  const { aid } = useParams();
  const db = useDb();
  const nav = useNavigate();
  const a = db.attempts.find((x) => x.id === aid);
  if (!db.ready) return <div className="page"><p className="muted">Đang tải…</p></div>;
  if (!a) return <div className="page"><p className="empty">Không tìm thấy lượt làm bài này (có thể đã bị xoá).</p><Link to="/history" className="btn btn--ghost">← Lịch sử</Link></div>;
  const meta = SKILL_META[a.skill];
  const d = (a.detail ?? {}) as { minutes?: number; ms?: number; words?: number };
  const mins = d.minutes ?? (d.ms ? Math.round(d.ms / 60000) : undefined);
  const { redo, open } = links(a);
  const del = async () => { if (confirm('Xoá lượt làm bài này khỏi Lịch sử?')) { await deleteAttempt(a.id); nav('/history'); } };

  return (
    <div className="page hdetail" style={{ ['--skill' as string]: meta.color }} data-testid="hdetail">
      <Link to="/history" className="back-link small"><ArrowLeft size={15} /> Lịch sử</Link>
      <div className="page-head">
        <span className="skill__icon skill__icon--lg"><meta.icon size={26} /></span>
        <div>
          <h1 className="hdetail__title">{a.title}</h1>
          <p>{meta.label} · {MODE_LABEL[a.mode] ?? a.mode} · {new Date(a.at).toLocaleString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>
      {a.mode !== 'full-mock' && <div className="hdetail__kpis">
        {a.band ? <div className="st-kpi"><strong data-testid="hd-band">{fmtBand(a.band)}</strong><span>band{a.mode === 'ai' ? ' (AI chấm)' : ' ước tính'}</span></div> : null}
        {!a.band && a.selfBand ? <div className="st-kpi"><strong>{fmtBand(a.selfBand)}</strong><span>band tự ước lượng</span></div> : null}
        {a.max ? <div className="st-kpi"><strong data-testid="hd-score">{a.mode === 'dictation' ? `${a.score}%` : `${a.score}/${a.max}`}</strong><span>{a.mode === 'dictation' ? 'từ đúng' : 'câu đúng'}</span></div> : null}
        {d.words ? <div className="st-kpi"><strong>{d.words}</strong><span>từ</span></div> : null}
        {mins ? <div className="st-kpi"><strong>{mins}′</strong><span>thời gian làm</span></div> : null}
      </div>}
      <div className="row wrap">
        {redo && <Link to={redo} className="btn btn--primary btn--sm" data-testid="hd-redo"><RotateCcw size={15} /> Làm lại đề này</Link>}
        {open && <Link to={open} className="btn btn--ghost btn--sm"><ExternalLink size={15} /> Mở đề</Link>}
        <button className="btn btn--text btn--sm" onClick={del}><Trash2 size={15} /> Xoá lượt này</button>
      </div>
      {a.mode === 'practice' && <p className="small muted">Lượt Luyện tập (đã xem đáp án từng câu) – không tính vào band ước tính ở trang chủ.</p>}
      <Body a={a} materials={db.materials} />
    </div>
  );
}

function Body({ a, materials }: { a: Attempt; materials: Record<string, Material> }) {
  const d = (a.detail ?? {}) as Record<string, unknown>;
  if (a.mode === 'full-mock') return <FullMockResult a={a} />;
  if (a.mode === 'dictation' || a.mode === 'gapfill') {
    const items = d.items as Item[] | undefined;
    return items?.length ? <SentenceList items={items} gap={a.mode === 'gapfill'} /> : <p className="banner">{OLD}</p>;
  }
  if (a.skill === 'writing') {
    const m = materials[a.materialId] as WritingMaterial | undefined;
    const text = (d.text as string) ?? '';
    return (
      <>
        {m && <Collapse title="Đề bài"><p className="pre-wrap small">{m.prompt}</p></Collapse>}
        <section className="card pad stack">
          <h2 className="h3">Bài viết của bạn</h2>
          {text ? <div className="hd-essay" data-testid="hd-essay">{text.split(/\n+/).map((p, i) => <p key={i}>{p}</p>)}</div> : <p className="muted">{OLD}</p>}
        </section>
        <SelfChecked a={a} />
        {d.grade ? <WritingGradeView grade={d.grade as WritingGrade} text={text} task={m?.task ?? 2} from={a.materialId} title="Kết quả AI chấm" /> : null}
      </>
    );
  }
  if (a.skill === 'speaking') {
    const turns = (d.turns as Turn[] | undefined) ?? [];
    const g = d.grade as SpeakingGrade | undefined;
    return (
      <>
        {turns.length ? (
          <section className="card pad stack">
            <h2 className="h3">Câu hỏi và câu trả lời{d.part ? ` · Part ${d.part}` : ''}</h2>
            <ol className="hd-turns">
              {turns.map((t, i) => {
                const fb = g?.perQuestion.find((q) => q.question === t.question) ?? g?.perQuestion[i];
                return (
                  <li key={i} className="hd-turn">
                    <strong>{t.question}</strong>
                    {t.audio && <BlobAudio src={t.audio} />}
                    {t.answer?.trim() ? <p className="hd-turn__tr">{t.answer}</p> : <p className="small muted">(không có transcript)</p>}
                    {t.seconds ? <small className="muted">{t.seconds} giây</small> : null}
                    {fb && <div className="hd-turn__fb small"><p>{fb.comment}</p>{fb.improved && <p className="sample"><em>Gợi ý:</em> {fb.improved}</p>}</div>}
                  </li>
                );
              })}
            </ol>
          </section>
        ) : <p className="banner">{OLD}</p>}
        <SelfChecked a={a} />
        {g && <SpeakingGradeView g={g} part={(d.part as number) ?? 1} from={a.materialId} />}
      </>
    );
  }
  // Reading / Listening (một phần, cả đề, luyện tập)
  const parts: RLPart[] = (d.parts as RLPart[] | undefined) ?? [{ id: a.materialId, answers: d.answers as Answers | undefined, score: a.score, max: a.max }];
  return <>{parts.map((p) => <RLPartView key={p.id} p={p} m={materials[p.id] as ReadingMaterial | ListeningMaterial | undefined} multi={parts.length > 1} />)}</>;
}

export function RLPartView({ p, m, multi }: { p: RLPart; m?: ReadingMaterial | ListeningMaterial; multi: boolean }) {
  const [onlyWrong, setOnlyWrong] = useState(false);
  const head = <div className="row-between"><h2 className="h3">{m ? (multi ? `${partLabel(m)} · ${m.title.replace(/^.*?(?:Passage|Section)\s*\d+\s*[–:-]\s*/, '')}` : 'Câu trả lời') : p.title ?? p.id}</h2>{p.max ? <span className="tag">{p.score}/{p.max}</span> : null}</div>;
  if (!m) return <section className="card pad stack">{head}<p className="muted small">Đề này không còn trong thư viện.</p></section>;
  if (!p.answers) return <section className="card pad stack">{head}<p className="muted small" data-testid="hd-old">{OLD}</p></section>;
  const rows = m.groups.flatMap((g) => g.questions.map((q) => ({ q, g, ok: isCorrect(q, p.answers![q.no] ?? null), you: answerText(q, p.answers![q.no], g) })));
  const shown = onlyWrong ? rows.filter((r) => !r.ok) : rows;
  return (
    <section className="card pad stack">
      {head}
      <label className="small row"><input type="checkbox" checked={onlyWrong} onChange={(e) => setOnlyWrong(e.target.checked)} /> Chỉ hiện câu sai ({rows.filter((r) => !r.ok).length})</label>
      <div className="table-wrap">
        <table className="table hd-table" data-testid="hd-table">
          <thead><tr><th>Câu</th><th>Bạn trả lời</th><th>Đáp án</th><th aria-label="Kết quả" /></tr></thead>
          <tbody>
            {shown.map(({ q, g, ok, you }) => (
              <tr key={q.no} className={ok ? 'is-ok' : 'is-no'}>
                <td>{q.no}</td>
                <td className="hd-you">{you || <span className="muted">(bỏ trống)</span>}</td>
                <td className="hd-key">{short(String(correctText(q, g.bank)))}</td>
                <td>{ok ? <Check size={16} className="ok-text" aria-label="Đúng" /> : <X size={16} className="no-text" aria-label="Sai" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Collapse title="Xem từng câu kèm giải thích">
        <GroupsView groups={m.groups} answers={p.answers} onChange={() => {}} checked note={m.note} />
      </Collapse>
    </section>
  );
}

function SentenceList({ items, gap }: { items: Item[]; gap: boolean }) {
  const [onlyWrong, setOnlyWrong] = useState(false);
  const shown = items.map((x, i) => ({ ...x, i })).filter((x) => !onlyWrong || x.score < 0.9 || x.shown);
  return (
    <section className="card pad stack">
      <div className="row-between"><h2 className="h3">{gap ? 'Từng dòng có chỗ trống' : 'Từng câu đã chép'}</h2><label className="small row"><input type="checkbox" checked={onlyWrong} onChange={(e) => setOnlyWrong(e.target.checked)} /> Chỉ câu sai</label></div>
      <ol className="hd-sents" data-testid="hd-sents">
        {shown.map((x) => {
          const wrong = new Set(x.wrongWords.map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '')));
          return (
            <li key={x.i} className={x.score >= 0.9 && !x.shown ? 'is-ok' : 'is-no'}>
              <div className="hd-sent__orig">{x.text.split(/(\s+)/).map((w, k) => (wrong.has(w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '')) && /\S/.test(w) ? <mark key={k} className="hd-miss">{w}</mark> : w))}</div>
              <div className="hd-sent__typed small">{x.shown ? <em className="muted">Đã xem đáp án</em> : x.typed ? <>Bạn {gap ? 'điền' : 'gõ'}: {x.typed}</> : <span className="muted">(chưa gõ)</span>} · <strong>{Math.round(x.score * 100)}%</strong></div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function SelfChecked({ a }: { a: Attempt }) {
  if (!a.selfCheck?.length) return null;
  return <section className="card pad stack"><h2 className="h3">Tự chấm theo checklist{a.selfBand ? ` · band ${fmtBand(a.selfBand)}` : ''}</h2><ul className="small">{a.selfCheck.map((x, i) => <li key={i}>{x}</li>)}</ul></section>;
}

export function BlobAudio({ src }: { src: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [miss, setMiss] = useState(false);
  useEffect(() => { resolveUrl(src).then((u) => (u ? setUrl(u) : setMiss(true))).catch(() => setMiss(true)); }, [src]);
  if (miss) return <small className="muted">Bản ghi âm không còn trong trình duyệt.</small>;
  return url ? <audio controls preload="metadata" src={url} className="hd-audio" /> : null;
}
