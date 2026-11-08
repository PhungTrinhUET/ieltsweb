import { useEffect, useState } from 'react';
import { Download, Moon, Sun, SunMoon, Upload, Volume2 } from 'lucide-react';
import { updateSettings, useSettings } from '../store';
import { exportAll, importBackup } from '../db';
import AiSettings from '../components/AiSettings';
import { englishVoices, speak, ttsAvailable } from '../lib/tts';

export default function Settings() {
  const s = useSettings();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    const load = () => setVoices(englishVoices());
    load();
    if (ttsAvailable()) speechSynthesis.addEventListener('voiceschanged', load);
    return () => { if (ttsAvailable()) speechSynthesis.removeEventListener('voiceschanged', load); };
  }, []);

  return (
    <div className="page">
      <div className="page-head"><div><h1>Cài đặt</h1></div></div>
      <section className="card settings">
        <div className="setting">
          <div className="setting__title"><strong>Giao diện</strong></div>
          <div className="seg">
            {([['system', 'Theo hệ thống', SunMoon], ['light', 'Sáng', Sun], ['dark', 'Tối', Moon]] as const).map(([v, l, I]) => <button key={v} className={`seg__btn${s.theme === v ? ' is-selected' : ''}`} onClick={() => updateSettings({ theme: v })}><I size={15} /> {l}</button>)}
          </div>
        </div>
        <div className="setting">
          <div className="setting__title"><strong>Mục tiêu band</strong></div>
          <div className="seg">{[5.5, 6, 6.5, 7, 7.5, 8].map((b) => <button key={b} className={`seg__btn${s.targetBand === b ? ' is-selected' : ''}`} onClick={() => updateSettings({ targetBand: b })}>{b}</button>)}</div>
        </div>
        <div className="setting">
          <div className="setting__title"><strong>Module Reading mặc định</strong></div>
          <div className="seg">{(['academic', 'general'] as const).map((m) => <button key={m} className={`seg__btn${s.module === m ? ' is-selected' : ''}`} onClick={() => updateSettings({ module: m })}>{m === 'academic' ? 'Academic' : 'General Training'}</button>)}</div>
        </div>
        <div className="setting">
          <div className="setting__title"><strong>Từ mới mỗi ngày</strong></div>
          <div className="seg">{[5, 10, 15, 20, 30].map((n) => <button key={n} className={`seg__btn${s.newCardsPerDay === n ? ' is-selected' : ''}`} onClick={() => updateSettings({ newCardsPerDay: n })}>{n}</button>)}</div>
        </div>
        <div className="setting setting--col">
          <div className="setting__title"><Volume2 size={18} /> <strong>Giọng đọc máy (TTS)</strong></div>
          <p className="small muted">Dùng cho Listening không có audio, chép chính tả, đọc bài Reading, đọc câu hỏi Speaking. Giọng phụ thuộc trình duyệt/hệ điều hành – Chrome có giọng "Google UK English" chất lượng tốt; Edge có giọng "Natural".</p>
          {!ttsAvailable() ? <p className="no-text small">Trình duyệt không hỗ trợ Web Speech API.</p> : (
            <>
              <select className="select" value={s.ttsVoice} onChange={(e) => updateSettings({ ttsVoice: e.target.value })}>
                <option value="en-GB">Tự chọn – Anh (en-GB)</option>
                <option value="en-US">Tự chọn – Mỹ (en-US)</option>
                <option value="en-AU">Tự chọn – Úc (en-AU)</option>
                {voices.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
              </select>
              <div className="row wrap">
                <span className="small muted">Tốc độ:</span>
                {[0.7, 0.85, 0.95, 1, 1.1].map((r) => <button key={r} className={`chip${s.ttsRate === r ? ' is-on' : ''}`} onClick={() => updateSettings({ ttsRate: r })}>{r}×</button>)}
                <button className="btn btn--ghost btn--sm" onClick={() => speak('Good morning. This is a test of the reading voice for IELTS practice.')}>Nghe thử</button>
              </div>
            </>
          )}
        </div>
      </section>

      <AiSettings />

      <section className="card settings">
        <div className="setting setting--col">
          <div className="setting__title"><strong>Sao lưu</strong></div>
          <p className="small muted">Toàn bộ tài liệu bạn nạp, kết quả, từ vựng, ghi chú nằm trong trình duyệt này (IndexedDB). Xuất file để chuyển máy hoặc đề phòng xoá dữ liệu trình duyệt. File audio/ảnh đã nạp không nằm trong bản sao lưu.</p>
          <div className="row wrap">
            <button className="btn btn--ghost btn--sm" onClick={async () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([await exportAll()], { type: 'application/json' })); a.download = `ielts-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); }}><Download size={15} /> Xuất sao lưu</button>
            <label className="btn btn--ghost btn--sm"><Upload size={15} /> Nhập sao lưu<input type="file" accept=".json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { await importBackup(await f.text()); setMsg('Đã nhập sao lưu.'); } catch (err) { setMsg(err instanceof Error ? err.message : String(err)); } }} /></label>
            {msg && <span className="small">{msg}</span>}
          </div>
        </div>
      </section>
    </div>
  );
}
