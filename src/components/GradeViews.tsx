// Kết quả AI chấm Writing / Speaking – dùng chung cho trang làm bài và trang xem lại trong Lịch sử.
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useDb } from '../db';
import { DeckSelect, SaveWordBtn, useDeckChoice } from './DeckPicker';
import { BandPill, CriteriaBars, WordDiff } from './misc';
import type { WritingGrade } from '../ai/writing';
import type { SpeakingGrade } from '../ai/speaking';

type WTab = 'fixes' | 'corrected' | 'improved' | 'upgrades';

export function WritingGradeView({ grade, text, task, from, title = 'Kết quả chấm', id }: { grade: WritingGrade; text: string; task: 1 | 2; from: string; title?: string; id?: string }) {
  useDb(); // vẽ lại khi lưu từ
  const [tab, setTab] = useState<WTab>('fixes');
  const [deck, setDeck] = useDeckChoice(from);
  return (
    <section className="card pad ai" id={id}>
      <div className="ai__head"><Sparkles size={18} /> <strong>{title}</strong></div>
      <div className="ai__top"><BandPill band={grade.overall} label="Band" /><p>{grade.summary}</p></div>
      <CriteriaBars items={[
        { label: task === 1 ? 'Task Achievement' : 'Task Response', band: grade.scores.task, reason: grade.reasons.task },
        { label: 'Coherence & Cohesion', band: grade.scores.coherence, reason: grade.reasons.coherence },
        { label: 'Lexical Resource', band: grade.scores.lexical, reason: grade.reasons.lexical },
        { label: 'Grammatical Range & Accuracy', band: grade.scores.grammar, reason: grade.reasons.grammar },
      ]} />
      <div className="ai__lists">
        <div><h4>Điểm mạnh</h4><ul>{grade.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
        <div><h4>Để lên band</h4><ul>{grade.improvements.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
      </div>
      <div className="tabs">
        {([['fixes', `Lỗi (${grade.corrections.length})`], ['corrected', 'Bản sửa lỗi'], ['improved', 'Bản nâng band'], ['upgrades', 'Nâng cấp cụm từ']] as const).map(([k, l]) => <button key={k} className={`tabs__btn${tab === k ? ' is-on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'fixes' && <ul className="fb-fixes">{grade.corrections.map((c, i) => <li key={i}><span className="tag">{c.kind}</span> <span className="fb-from">{c.original}</span> → <span className="fb-to">{c.corrected}</span><div className="fb-why">{c.explanation}</div></li>)}</ul>}
      {tab === 'corrected' && <div className="sample sample--long"><p className="small muted">Gạch đỏ = bỏ, xanh = thêm/sửa, so với bài của bạn.</p>{grade.corrected.split('\n').map((p, i) => <WordDiff key={i} from={(text.split('\n')[i] ?? '')} to={p} />)}</div>}
      {tab === 'improved' && <div className="sample sample--long">{grade.improved.split('\n').map((l, i) => <p key={i}>{l}</p>)}</div>}
      {tab === 'upgrades' && (<>
        <DeckSelect from={from} value={deck} onChange={setDeck} />
        <table className="table"><thead><tr><th>Bạn viết</th><th>Cách tốt hơn</th><th></th></tr></thead>
          <tbody>{grade.upgrades.map((u, i) => (<tr key={i}><td>{u.from}</td><td><strong>{u.to}</strong></td><td><SaveWordBtn deck={deck} f={{ word: u.to, meaning: `Thay cho: ${u.from}`, from }} /></td></tr>))}</tbody></table>
      </>)}
    </section>
  );
}

export function SpeakingGradeView({ g, part, from }: { g: SpeakingGrade; part: number; from: string }) {
  useDb();
  const [deck, setDeck] = useDeckChoice(from);
  return (
    <section className="card pad ai">
      <div className="ai__head"><Sparkles size={18} /> <strong>AI chấm Part {part}</strong></div>
      <div className="ai__result">
        <div className="ai__top"><BandPill band={g.overall} label="Band" /><p>{g.summary}</p></div>
        <CriteriaBars items={[
          { label: 'Fluency & Coherence', band: g.scores.fluency, reason: g.reasons.fluency },
          { label: 'Lexical Resource', band: g.scores.lexical, reason: g.reasons.lexical },
          { label: 'Grammatical Range & Accuracy', band: g.scores.grammar, reason: g.reasons.grammar },
          { label: 'Pronunciation', band: g.scores.pronunciation, reason: g.scores.pronunciation ? 'Theo tự đánh giá của bạn' : 'Không chấm được từ transcript – hãy nghe lại bản ghi và so với bài mẫu.' },
        ]} />
        <div className="ai__lists">
          <div><h4>Cần cải thiện</h4><ul>{g.improvements.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          <div><h4>Cụm từ nên học</h4><DeckSelect from={from} value={deck} onChange={setDeck} compact /><ul className="vlist">{g.vocabulary.map((v, i) => (<li key={i} className="vlist__row"><div className="vlist__body"><strong>{v.phrase}</strong> – {v.meaning}<div className="vocab__ex">{v.example}</div></div><SaveWordBtn deck={deck} f={{ word: v.phrase, meaning: v.meaning, example: v.example, from }} /></li>))}</ul></div>
        </div>
      </div>
    </section>
  );
}
