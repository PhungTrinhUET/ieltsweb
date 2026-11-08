// Render & chấm mọi dạng câu hỏi Reading / Listening.
import ZoomImage, { publicUrl } from './ZoomImage';
import { Fragment, type ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import type { Question, QuestionGroup } from '../types';
import { answerMatches } from '../lib/text';
import { Options, PickMenu, RichText, Segmented } from './ui';
import { groupKind } from '../lib/qtypes';

const LETTERS = 'ABCDEFGHIJKLMNOP';
const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv'];

export type Answer =number | number[] | string | null;
export type Answers = Record<number, Answer>;

export function isCorrect(q: Question, a: Answer): boolean {
  if (a === null || a === undefined || a === '') return false;
  switch (q.type) {
    case 'mcq': case 'match': return a === q.answer;
    case 'multi': { const s = Array.isArray(a) ? [...a].sort().join(',') : ''; return s === [...q.answer].sort().join(','); }
    case 'tfng': case 'ynng': return a === q.answer;
    case 'fill': return typeof a === 'string' && answerMatches(a, q.answer);
  }
}
export function correctText(q: Question, bank?: string[]) {
  switch (q.type) {
    case 'mcq': return 'ABCDEFGH'[q.answer];
    case 'multi': return q.answer.map((i) => 'ABCDEFGH'[i]).join(', ');
    case 'match': { const b = q.options ?? bank ?? []; return b[q.answer] ?? String(q.answer); }
    case 'fill': return Array.isArray(q.answer) ? q.answer.join(' / ') : q.answer;
    default: return q.answer;
  }
}
export function scoreGroups(groups: QuestionGroup[], answers: Answers) {
  let score = 0, max = 0;
  const wrong: number[] = [];
  for (const g of groups) for (const q of g.questions) { max++; if (isCorrect(q, answers[q.no])) score++; else wrong.push(q.no); }
  return { score, max, wrong };
}
export const allQuestions = (groups: QuestionGroup[]) => groups.flatMap((g) => g.questions);

function BlankInput({ no, value, onChange, checked, ok, onFocus }: { no: number; value: string; onChange: (v: string) => void; checked: boolean; ok: boolean; onFocus?: () => void }) {
  return (
    <input
      className={`blank${checked ? (ok ? ' is-correct' : ' is-wrong') : ''}`} value={value} disabled={checked}
      onChange={(e) => onChange(e.target.value)} onFocus={onFocus} placeholder={String(no)} aria-label={`Câu ${no}`} spellCheck={false} autoComplete="off"
      style={{ width: `${Math.max(7, Math.min(24, (value.length || 6) + 2))}ch` }}
    />
  );
}

/** Hiển thị câu có ___ thành input. */
function FillText({ q, value, onChange, checked, ok, onFocus }: { q: Question; value: string; onChange: (v: string) => void; checked: boolean; ok: boolean; onFocus?: () => void }) {
  const parts = q.text.split(/_{3,}/);
  const input = <BlankInput no={q.no} value={value} onChange={onChange} checked={checked} ok={ok} onFocus={onFocus} />;
  if (parts.length === 1) return <span>{q.text} {input}</span>;
  return <span>{parts.map((p, i) => <Fragment key={i}>{p}{i < parts.length - 1 && input}</Fragment>)}</span>;
}

export function QuestionView({ q, group, value, onChange, checked, onFocus, compact, onReveal }: {
  q: Question; group: QuestionGroup; value: Answer; onChange: (a: Answer) => void; checked: boolean; onFocus?: () => void; compact?: boolean;
  /** Chế độ luyện tập: nút kiểm tra riêng câu này. */
  onReveal?: () => void;
}) {
  const ok = checked && isCorrect(q, value);
  let body: ReactNode;
  switch (q.type) {
    case 'mcq':
      body = <><div className="qtext">{q.text}</div><Options options={q.options} value={typeof value === 'number' ? value : null} onChange={(i) => onChange(i)} checked={checked} correct={q.answer} /></>;
      break;
    case 'multi': {
      const sel = Array.isArray(value) ? value : [];
      body = (
        <>
          <div className="qtext">{q.text}</div>
          <div className="options">
            {q.options.map((o, i) => {
              const on = sel.includes(i);
              let st = '';
              if (checked) st = q.answer.includes(i) ? ' is-correct' : on ? ' is-wrong' : ' is-dim';
              else if (on) st = ' is-selected';
              return (
                <button key={i} className={`option${st}`} disabled={checked} onClick={() => onChange(on ? sel.filter((x) => x !== i) : [...sel, i])}>
                  <span className="option__letter">{'ABCDEFGH'[i]}</span><span className="option__text">{o}</span>
                  {checked && q.answer.includes(i) && <Check size={18} className="option__icon" />}
                  {checked && on && !q.answer.includes(i) && <X size={18} className="option__icon" />}
                </button>
              );
            })}
          </div>
        </>
      );
      break;
    }
    case 'tfng': case 'ynng': {
      const opts = q.type === 'tfng' ? ['TRUE', 'FALSE', 'NOT GIVEN'] : ['YES', 'NO', 'NOT GIVEN'];
      body = <><div className="qtext">{q.text}</div><Segmented options={opts.map((v) => ({ value: v, label: v }))} value={typeof value === 'string' ? value : null} onChange={(v) => onChange(v)} checked={checked} correct={q.answer} /></>;
      break;
    }
    case 'fill':
      body = <div className="qtext qtext--fill"><FillText q={q} value={typeof value === 'string' ? value : ''} onChange={onChange} checked={checked} ok={ok} onFocus={onFocus} /></div>;
      break;
    case 'match': {
      const bank = q.options ?? group.bank ?? [];
      body = (
        <div className="qmatch">
          <div className="qtext">{q.text}</div>
          <PickMenu options={bank} value={typeof value === 'number' ? value : null} onChange={(i) => onChange(i)} checked={checked} correct={q.answer} prefer="down" />
        </div>
      );
      break;
    }
  }
  return (
    <div className={`q${compact ? ' q--compact' : ''}${checked ? (ok ? ' q--ok' : ' q--no') : ''}`} id={`q-${q.no}`}>
      <div className="q__no">{q.no}</div>
      <div className="q__body">
        {body}
        {checked && !ok && q.type === 'fill' && <div className="q__fix"><Check size={14} /> {correctText(q, group.bank)}</div>}
        {checked && q.explanation && <div className="q__explain"><RichText text={q.explanation} /></div>}
        {!checked && onReveal && (
          <div className="q__check">
            <button className="btn btn--text btn--sm" onClick={onReveal}>{value === null || value === '' || (Array.isArray(value) && !value.length) ? 'Xem đáp án' : 'Kiểm tra câu này'}</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function GroupsView({ groups, answers, onChange, checked, onFocus, revealed, onReveal, note }: {
  groups: QuestionGroup[]; answers: Answers; onChange: (no: number, a: Answer) => void; checked: boolean; onFocus?: (no: number) => void;
  /** Chế độ luyện tập: các câu đã kiểm tra riêng. */
  revealed?: Record<number, boolean>; onReveal?: (no: number) => void;
  /** Ghi chú của đề (Material.note), vd. câu thiếu trong đề gốc. */
  note?: string;
}) {
  return (
    <div className="qgroups">
      {note && <p className="qnote" role="note">{note}</p>}
      {groups.map((g, gi) => {
        const nos = g.questions.map((q) => q.no);
        const range = nos.length > 1 ? `Questions ${nos[0]}–${nos[nos.length - 1]}` : `Question ${nos[0]}`;
        return (
          <section key={gi} className="qgroup">
            <h3>{range}</h3>
            <p className="instruction"><Instruction text={g.instruction} limit={g.wordLimit} /></p>
            {g.bank && g.questions.some((q) => q.type === 'match') && !g.bank.every((b) => b.length <= 2) && (
              <ol className="qbank">{g.bank.map((b, i) => <li key={i}><span>{/heading/i.test(g.instruction) || (g.bank!.length > 8 && !/letter/i.test(g.instruction)) ? ROMAN[i] : LETTERS[i]}</span>{b}</li>)}</ol>
            )}
            {g.image && <figure className="qgroup__img"><ZoomImage src={publicUrl(g.image)} alt={g.imageAlt ?? 'Hình cho nhóm câu hỏi'} /></figure>}
            <GroupBody g={g} answers={answers} onChange={onChange} checked={checked} onFocus={onFocus} revealed={revealed} onReveal={onReveal} />
          </section>
        );
      })}
    </div>
  );
}

type BodyProps = {
  g: QuestionGroup; answers: Answers; onChange: (no: number, a: Answer) => void; checked: boolean; onFocus?: (no: number) => void;
  revealed?: Record<number, boolean>; onReveal?: (no: number) => void;
};

/** Bố cục của nhóm: khai báo trong content, hoặc suy từ instruction. */
export function groupLayout(g: QuestionGroup, skill: 'reading' | 'listening' = 'listening'): NonNullable<QuestionGroup['layout']> | null {
  if (g.layout === 'table') return g.table ? 'table' : null;
  if (g.layout) return g.layout;
  if (g.table) return 'table';
  if (g.image || !g.questions.every((q) => q.type === 'fill' || q.type === 'match')) return null;
  const k = groupKind(g, skill);
  return k === 'form' ? 'form' : k === 'note' ? 'notes' : k === 'flow' ? 'flowchart' : null;
}

function GroupBody({ g, answers, onChange, checked, onFocus, revealed, onReveal }: BodyProps) {
  const layout = groupLayout(g);
  const qv = (q: Question, compact = false) => (
    <QuestionView key={q.no} q={q} group={g} value={answers[q.no] ?? null} onChange={(a) => onChange(q.no, a)} checked={checked || !!revealed?.[q.no]} onFocus={() => onFocus?.(q.no)} onReveal={onReveal ? () => onReveal(q.no) : undefined} compact={compact} />
  );
  if (g.table && layout) return <TableBody layout={layout} g={g} answers={answers} onChange={onChange} checked={checked} onFocus={onFocus} revealed={revealed} onReveal={onReveal} />;
  if (layout === 'form' || layout === 'notes') {
    return (
      <div className={`paper paper--${layout}`}>
        {g.context && <div className="paper__title">{g.context}</div>}
        {g.questions.map((q) => qv(q, true))}
      </div>
    );
  }
  if (layout === 'flowchart') {
    return (
      <div className="flowc">
        {g.context && <div className="paper__title">{g.context}</div>}
        {g.questions.map((q) => <div key={q.no} className="flowc__step">{qv(q, true)}</div>)}
      </div>
    );
  }
  return <>{g.context && <div className="qcontext">{g.context}</div>}{g.questions.map((q) => qv(q))}</>;
}

/** Bảng như đề thật: ô có {{n}} là chỗ điền / chọn của câu n. Đáp án và giải thích hiện bên dưới bảng. */
function TableBody({ g, answers, onChange, checked, onFocus, revealed, onReveal, layout }: BodyProps & { layout: string }) {
  const t = g.table!;
  const byNo = new Map(g.questions.map((q) => [q.no, q]));
  const bank = g.bank ?? [];
  const cell = (text: string) => text.split(/\{\{(\d+)\}\}/).map((seg, i) => {
    if (i % 2 === 0) return seg ? <Fragment key={i}>{seg.split('\n').map((l, j) => <Fragment key={j}>{j > 0 && <br />}{l}</Fragment>)}</Fragment> : null;
    const q = byNo.get(+seg);
    if (!q) return <Fragment key={i}>({seg})</Fragment>;
    const v = answers[q.no] ?? null; const shown = checked || !!revealed?.[q.no]; const ok = shown && isCorrect(q, v);
    return (
      <span key={i} id={`q-${q.no}`} className={`tblank${shown ? (ok ? ' is-ok' : ' is-no') : ''}`}>
        {q.type === 'match'
          ? <PickMenu options={q.options ?? bank} value={typeof v === 'number' ? v : null} onChange={(a) => onChange(q.no, a)} checked={shown} correct={q.answer} prefer="down" placeholder="…" />
          : <BlankInput no={q.no} value={typeof v === 'string' ? v : ''} onChange={(a) => onChange(q.no, a)} checked={shown} ok={ok} onFocus={() => onFocus?.(q.no)} />}
      </span>
    );
  });
  const shownQs = g.questions.filter((q) => checked || revealed?.[q.no]);
  const hidden = g.questions.filter((q) => !checked && !revealed?.[q.no]);
  return (
    <>
      {layout === 'table' ? <>
        {t.title && <div className="paper__title">{t.title}</div>}
        <div className="qtable-wrap">
          <table className="qtable">
            {t.columns && <thead><tr>{t.columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>}
            <tbody>{t.rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => (ci === 0 && r.length > 1 ? <th key={ci} scope="row">{cell(c)}</th> : <td key={ci}>{cell(c)}</td>))}</tr>)}</tbody>
          </table>
        </div>
      </> : (
        <div className={`paper paper--${layout}`}>
          {t.title && <div className="paper__title">{t.title}</div>}
          {t.rows.map((r, ri) => r.length > 1
            ? <div key={ri} className="paper__row"><span className="paper__label">{cell(r[0])}</span><span>{cell(r[1])}</span></div>
            : r[0].startsWith('# ') ? <div key={ri} className="paper__h">{r[0].slice(2)}</div>
              : <div key={ri} className={`paper__line${r[0].startsWith('•') ? ' paper__line--b' : ''}`}>{cell(r[0])}</div>)}
        </div>
      )}
      {shownQs.length > 0 && (
        <div className="qtable-notes">
          {shownQs.map((q) => { const ok = isCorrect(q, answers[q.no] ?? null); return (
            <div key={q.no} className={`q q--compact ${ok ? 'q--ok' : 'q--no'}`}>
              <div className="q__no">{q.no}</div>
              <div className="q__body">
                <div className="q__fix">{ok ? <Check size={14} /> : <X size={14} />} {correctText(q, bank)}</div>
                {q.explanation && <div className="q__explain"><RichText text={q.explanation} /></div>}
              </div>
            </div>); })}
        </div>
      )}
      {onReveal && hidden.length > 0 && (
        <div className="q__check"><button className="btn btn--text btn--sm" onClick={() => hidden.forEach((q) => onReveal(q.no))}>Kiểm tra các câu trong bảng</button></div>
      )}
    </>
  );
}

/** Hướng dẫn của nhóm câu: bôi đậm giới hạn số từ (đã nằm sẵn trong câu, hoặc dạng chữ IN HOA như ONE WORD ONLY). Không nối thêm. */
const LIMIT_RE = /((?:NO MORE THAN |ONLY )?(?:ONE|TWO|THREE|FOUR|FIVE)(?: WORDS?)?(?: AND\/OR A NUMBER| OR A NUMBER)?(?: ONLY)?|A NUMBER)/;
function Instruction({ text, limit }: { text: string; limit?: string }) {
  const at = limit ? text.toUpperCase().indexOf(limit.toUpperCase().replace(/\.$/, '')) : -1;
  if (limit && at >= 0) {
    const len = limit.replace(/\.$/, '').length;
    return <>{text.slice(0, at)}<strong>{text.slice(at, at + len)}</strong>{text.slice(at + len)}</>;
  }
  const m = LIMIT_RE.exec(text);
  if (m && /[A-Z]{3}/.test(m[0]) && m[0] === m[0].toUpperCase() && /WORD|NUMBER/.test(m[0])) return <>{text.slice(0, m.index)}<strong>{m[0]}</strong>{text.slice(m.index + m[0].length)}</>;
  return <>{text}{limit && <> <strong>{limit}</strong>.</>}</>;
}
