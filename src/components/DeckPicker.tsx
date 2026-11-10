// Chọn bộ khi lưu từ: "Lưu vào: [bộ]" + "＋ Tạo bộ mới…" (gợi ý tên theo đề, vd "VOL 5 · Test 7").
//   Bộ được nhớ theo đề (testId → bộ) và bộ dùng gần nhất – xem defaultDeck() trong lib/decks.ts.
import { useState } from 'react';
import { BookmarkPlus, Check } from 'lucide-react';
import { useDb } from '../db';
import { GENERAL, createDeck, defaultDeck, findMine, isGeneral, rememberDeck, saveWordTo, testOf, type SaveFields } from '../lib/decks';
import { GENERAL_NAME, userDecks } from '../lib/vocab';

const NEW = '__new';

/** Ô chọn bộ; `value` do nơi gọi giữ (mặc định defaultDeck(from)). */
export function DeckSelect({ from, value, onChange, compact }: { from?: string; value: string; onChange: (id: string) => void; compact?: boolean }) {
  const db = useDb();
  const mine = userDecks(db.kv);
  const [creating, setCreating] = useState(false);
  const t = testOf(from);
  const [name, setName] = useState(t?.name ?? '');
  const create = async () => {
    if (!name.trim()) return;
    const id = await createDeck({ name: name.trim(), source: t ? 'test' : 'custom', emoji: t ? '📄' : '📚', ref: t?.id, description: t ? `Từ lưu khi làm ${t.name}` : undefined });
    rememberDeck(from, id); onChange(id); setCreating(false);
  };
  if (creating) return (
    <div className="deckpick deckpick--new" data-testid="deckpick-new">
      <input className="input input--sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên bộ mới" autoFocus aria-label="Tên bộ mới"
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } if (e.key === 'Escape') setCreating(false); }} />
      <button className="btn btn--primary btn--sm" onClick={create} disabled={!name.trim()} data-testid="deckpick-create">Tạo</button>
      <button className="btn btn--text btn--sm" onClick={() => setCreating(false)}>Huỷ</button>
    </div>
  );
  return (
    <label className={`deckpick small${compact ? ' deckpick--compact' : ''}`}>
      <span>Lưu vào:</span>
      <select className="input input--sm" value={value} data-testid="deckpick"
        onChange={(e) => { if (e.target.value === NEW) { setName(t?.name ?? ''); setCreating(true); } else { rememberDeck(from, e.target.value); onChange(e.target.value); } }}>
        <option value={GENERAL}>📒 {GENERAL_NAME}</option>
        {mine.map((d) => <option key={d.id} value={d.id}>{d.emoji ?? '📚'} {d.name}</option>)}
        <option value={NEW}>＋ Tạo bộ mới…</option>
      </select>
    </label>
  );
}

/** Dùng chung: giữ bộ đang chọn cho một bài. */
export function useDeckChoice(from?: string) {
  useDb(); // vẽ lại khi bộ thay đổi
  const [deck, setDeck] = useState(() => defaultDeck(from));
  const valid = deck === GENERAL || !!findMine(deck) ? deck : GENERAL;
  return [valid, setDeck] as const;
}

/** Nút lưu nhanh một từ/cụm (Writing, Speaking, nhận xét AI) vào bộ đang chọn. */
export function SaveWordBtn({ deck, f }: { deck: string; f: SaveFields }) {
  const db = useDb();
  const c = Object.values(db.vocab).find((x) => x.word.toLowerCase() === f.word.trim().toLowerCase());
  const inIt = !!c && ((c.decks ?? []).includes(deck) || (deck === GENERAL && isGeneral(c)));
  return (
    <button className="icon-btn" disabled={inIt} aria-label={inIt ? 'Đã có trong bộ' : `Lưu "${f.word}"`} title={inIt ? 'Đã có trong bộ này' : c ? 'Thêm vào bộ đang chọn' : 'Lưu vào bộ đang chọn'}
      onClick={() => saveWordTo(deck, f)}>{inIt ? <Check size={16} /> : <BookmarkPlus size={16} />}</button>
  );
}
