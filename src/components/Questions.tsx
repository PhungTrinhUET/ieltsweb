// Render & chấm mọi dạng câu hỏi Reading / Listening.
import { Fragment, type ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import type { Question, QuestionGroup } from '../types';
import { answerMatches } from '../lib/text';
import { Options, PickMenu, RichText, Segmented } from './ui';

export type Answer = number | number[] | string | null;
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

/** Hiển thị câu có ___ thành input. */
function FillText({ q, value, onChange, checked, ok, onFocus }: { q: Question; value: string; onChange: (v: string) => void; checked: boolean; ok: boolean; onFocus?: () => void }) {
  const parts = q.text.split(/_{3,}/);
  const input = (
    <input
      className={`blank${checked ? (ok ? ' is-correct' : ' is-wrong') : ''}`} value={value} disabled={checked}
      onChange={(e) => onChange(e.target.value)} onFocus={onFocus} placeholder={String(q.no)} aria-label={`Câu ${q.no}`} spellCheck={false} autoComplete="off"
      style={{ width: `${Math.max(7, Math.min(24, (value.length || 6) + 2))}ch` }}
    />
  );
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

export function GroupsView({ groups, answers, onChange, checked, onFocus, revealed, onReveal }: {
  groups: QuestionGroup[]; answers: Answers; onChange: (no: number, a: Answer) => void; checked: boolean; onFocus?: (no: number) => void;
  /** Chế độ luyện tập: các câu đã kiểm tra riêng. */
  revealed?: Record<number, boolean>; onReveal?: (no: number) => void;
}) {
  return (
    <div className="qgroups">
      {groups.map((g, gi) => {
        const nos = g.questions.map((q) => q.no);
        const range = nos.length > 1 ? `Questions ${nos[0]}–${nos[nos.length - 1]}` : `Question ${nos[0]}`;
        return (
          <section key={gi} className="qgroup">
            <h3>{range}</h3>
            <p className="instruction">{g.instruction}{g.wordLimit && <> <strong>{g.wordLimit}</strong>.</>}</p>
            {g.bank && g.questions.some((q) => q.type === 'match') && !g.bank.every((b) => b.length <= 2) && (
              <ol className="qbank">{g.bank.map((b, i) => <li key={i}><span>{g.bank!.length > 8 || /heading/i.test(g.instruction) ? ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii'][i] : 'ABCDEFGH'[i]}</span>{b}</li>)}</ol>
            )}
            {g.context && <div className="qcontext">{g.context}</div>}
            {g.questions.map((q) => (
              <QuestionView key={q.no} q={q} group={g} value={answers[q.no] ?? null} onChange={(a) => onChange(q.no, a)} checked={checked || !!revealed?.[q.no]} onFocus={() => onFocus?.(q.no)} onReveal={onReveal ? () => onReveal(q.no) : undefined} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
