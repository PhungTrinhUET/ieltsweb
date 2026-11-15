// Transcript Listening dạng từng lượt lời, mỗi lượt có nút dịch (như bài đọc ở Luyện tập) + nút "Dịch tất cả".
// Dùng ở Thi thử sau khi nộp bài. Bản dịch lấy từ material.translation nếu có, không thì dịch máy miễn phí (translateText).
import { useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { translateText } from '../lib/freeTranslate';
import { HlText } from './Highlight';
import type { WordSel } from './WordPopover';

type Line = { speaker: string; text: string };

export function scriptLines(transcript: string): Line[] {
  return transcript.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const body = l.replace(/^\[\d+:\d\d\]\s*/, '');
    const m = body.match(/^([^:]{1,30}):\s*/);
    return m ? { speaker: m[1], text: body.slice(m[0].length) } : { speaker: '', text: body };
  });
}

export default function ScriptLines({ transcript, stored = [], onWord }: { transcript: string; stored?: string[]; onWord?: (s: WordSel) => void }) {
  const lines = scriptLines(transcript);
  const [vi, setVi] = useState<Record<number, string | 'busy'>>({});
  const [err, setErr] = useState('');
  const [all, setAll] = useState(false);

  const one = async (i: number) => {
    if (vi[i] && vi[i] !== 'busy') { setVi((v) => { const n = { ...v }; delete n[i]; return n; }); return; }
    if (stored[i]) { setVi((v) => ({ ...v, [i]: stored[i] })); return; }
    setVi((v) => ({ ...v, [i]: 'busy' })); setErr('');
    try { const t = await translateText(lines[i].text); setVi((v) => ({ ...v, [i]: t })); }
    catch (e) { setVi((v) => { const n = { ...v }; delete n[i]; return n; }); setErr(e instanceof Error ? e.message : String(e)); }
  };
  // Dịch lần lượt từng lượt lời chưa có bản dịch (tránh gửi dồn một lúc).
  const translateAll = async () => {
    if (all) { setAll(false); setVi({}); return; }
    setAll(true); setErr('');
    for (let i = 0; i < lines.length; i++) {
      if (vi[i] && vi[i] !== 'busy') continue;
      if (stored[i]) { setVi((v) => ({ ...v, [i]: stored[i] })); continue; }
      setVi((v) => ({ ...v, [i]: 'busy' }));
      try { const t = await translateText(lines[i].text); setVi((v) => ({ ...v, [i]: t })); }
      catch (e) { setVi((v) => { const n = { ...v }; delete n[i]; return n; }); setErr(e instanceof Error ? e.message : String(e)); break; }
    }
  };

  return (
    <article className="passage passage--script passage--practice script-lines">
      <div className="script-lines__head">
        <strong>Transcript</strong>
        <button className={`btn btn--sm ${all ? 'btn--primary' : 'btn--ghost'}`} onClick={translateAll}><Languages size={15} /> {all ? 'Ẩn bản dịch' : 'Dịch tất cả'}</button>
      </div>
      {err && <p className="no-text small">{err}</p>}
      {lines.map((l, i) => {
        const t = vi[i];
        return (
          <div key={i} className="pp">
            <div className="pp__en">
              {l.speaker && <strong className="pp__speaker">{l.speaker}:</strong>}{' '}
              <HlText text={l.text} onWord={onWord} />{' '}
              <button className={`pp__tr${t && t !== 'busy' ? ' is-on' : ''}`} onClick={() => one(i)} title={t && t !== 'busy' ? 'Ẩn bản dịch' : 'Dịch lượt lời này'} aria-label="Dịch lượt lời">
                {t === 'busy' ? <Loader2 size={13} className="spin" /> : <Languages size={13} />}
              </button>
            </div>
            {t && t !== 'busy' && <p className="pp__vi">{t}</p>}
          </div>
        );
      })}
    </article>
  );
}
