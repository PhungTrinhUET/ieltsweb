// Nhận bộ từ qua link #/vocab/share?d=… (JSON → deflate → base64url, xem lib/decks.ts).
//   Xem trước rồi "Thêm vào bộ của tôi" → bộ mới (source 'shared'). Không kèm tiến độ học của người gửi.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Volume2 } from 'lucide-react';
import { createDeck, decodeShare } from '../lib/decks';
import type { DeckMeta, DeckWord } from '../lib/vocab';
import { sayWord } from '../components/VocabEx';

export default function DeckShare() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const code = sp.get('d') ?? '';
  const [data, setData] = useState<{ meta: DeckMeta & { name: string }; words: DeckWord[] } | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!code) { setErr('Link không có dữ liệu bộ từ.'); return; }
    decodeShare(code).then(setData).catch(() => setErr('Link hỏng hoặc bị cắt mất một phần. Nhờ người gửi chép lại link, hoặc gửi file .json.'));
  }, [code]);
  const add = async () => {
    if (!data) return;
    setBusy(true);
    const id = await createDeck({ ...data.meta, source: 'shared' }, data.words);
    nav(`/vocab/deck/${encodeURIComponent(id)}`, { replace: true });
  };
  return (
    <div className="page lt dk-page" data-testid="deck-share">
      <Link to="/vocab" className="back small">← Từ vựng</Link>
      {err ? <p className="empty">{err}</p> : !data ? <p className="muted">Đang mở bộ từ…</p> : <>
        <header className="dk-head card" style={{ ['--dk' as string]: data.meta.color ?? 'var(--primary)' }}>
          <span className="dk-head__emoji" aria-hidden>{data.meta.emoji ?? '📚'}</span>
          <div className="dk-head__txt">
            <small className="muted">Bộ từ được chia sẻ</small>
            <h1 className="dk-head__name">{data.meta.name}</h1>
            {data.meta.description && <p className="small muted">{data.meta.description}</p>}
            <div className="row wrap small"><span className="chip">{data.words.length} từ</span>{data.meta.topic && <span className="chip">{data.meta.topic}</span>}{data.meta.level && <span className="chip">Band {data.meta.level}</span>}</div>
          </div>
        </header>
        <div className="row wrap">
          <button className="btn btn--primary" onClick={add} disabled={busy} data-testid="share-add"><Plus size={16} /> Thêm vào bộ của tôi</button>
          <span className="small muted">Chỉ có từ và nghĩa – tiến độ học bắt đầu từ đầu.</span>
        </div>
        <ul className="vlist card dk-words">
          {data.words.map((w) => (
            <li key={w.word} className="vlist__row">
              <div className="vlist__body"><strong className="vocab__w">{w.word}</strong> {w.ipa && <span className="small muted">{w.ipa}</span>} {w.pos && <em className="vocab__pos">{w.pos}</em>}
                <div className="vocab__vi">{w.vi}</div>{w.ex && <div className="vocab__ex">{w.ex}</div>}</div>
              <button className="icon-btn" onClick={() => sayWord(w.word)} aria-label={`Phát âm ${w.word}`}><Volume2 size={16} /></button>
            </li>
          ))}
        </ul>
      </>}
    </div>
  );
}
