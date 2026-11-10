// Câu thật trong đề có chứa từ (A4): nguồn bấm được, câu Listening có audio thì có nút nghe đoạn.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Volume2 } from 'lucide-react';
import { useDb } from '../db';
import { contextFor, type CtxSent, matAudio, matHref, playClip, srcLabel, wordRe } from '../lib/context';

export function Marked({ text, word }: { text: string; word: string }) {
  const parts = text.split(wordRe(word, 'gi'));
  // split với nhóm bắt → phần lẻ là từ khớp
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i} className="ctx-hit">{p}</mark> : p))}</>;
}

export function useContext(word: string, max = 3) {
  const db = useDb();
  const [list, setList] = useState<CtxSent[] | null>(null);
  useEffect(() => {
    let on = true; setList(null);
    contextFor(word, db.materials, max).then((r) => on && setList(r));
    return () => { on = false; };
  }, [word, max, db.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  return list;
}

export default function ContextList({ word, max = 3, title = 'Trong đề thật' }: { word: string; max?: number; title?: string }) {
  const db = useDb();
  const list = useContext(word, max);
  if (!list?.length) return null;
  return (
    <div className="ctx" data-testid="ctx-list">
      <div className="ctx__title small muted">{title}</div>
      <ul>
        {list.map((s, i) => {
          const audio = matAudio(db.materials[s.mid]);
          return (
            <li key={i}>
              <p><Marked text={s.text} word={word} />
                {audio && s.start != null && s.end != null && (
                  <button className="icon-btn icon-btn--sm ctx__play" aria-label="Nghe đoạn này" title="Nghe đoạn trong audio đề" onClick={() => playClip(audio, s.start!, s.end!)}><Volume2 size={15} /></button>
                )}
              </p>
              <Link to={matHref(s.mid)} className="ctx__src small">{srcLabel(s.mid)}</Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
