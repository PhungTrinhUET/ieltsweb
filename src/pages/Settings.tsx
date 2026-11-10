import { useEffect, useState } from 'react';
import { Download, Moon, Play, Sun, SunMoon, Upload, Volume2 } from 'lucide-react';
import { EX_NAMES, updateSettings, useSettings } from '../store';
import type { ExKind } from '../types';
import { exportAll, importBackup } from '../db';
import AiSettings from '../components/AiSettings';
import { englishVoices, speak, ttsAvailable, voiceGender } from '../lib/tts';

const SAMPLE = 'Good morning. This is a test of the reading voice for IELTS practice.';

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
        <div className="setting setting--col">
          <div className="setting__title"><Volume2 size={18} /> <strong>Giọng đọc máy (TTS)</strong></div>
          <p className="small muted">Dùng cho Listening không có audio, chép chính tả, đọc bài Reading, đọc câu hỏi Speaking. Giọng phụ thuộc trình duyệt/hệ điều hành – Chrome có giọng "Google UK English" chất lượng tốt; Edge có giọng "Natural".</p>
          {!ttsAvailable() ? <p className="no-text small">Trình duyệt không hỗ trợ Web Speech API.</p> : (
            <>
              <div className="row wrap">
                <select className="select voice-select" value={s.ttsVoice} onChange={(e) => updateSettings({ ttsVoice: e.target.value })} aria-label="Giọng người dẫn">
                  <option value="en-GB">Tự động – giọng tốt nhất{voices[0] ? ` (${voices[0].name})` : ''}</option>
                  {voices.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang}{voiceGender(v) ? `, ${voiceGender(v) === 'f' ? 'nữ' : 'nam'}` : ''})</option>)}
                </select>
                <button className="btn btn--ghost btn--sm" onClick={() => speak(SAMPLE)}><Play size={14} /> Nghe thử</button>
              </div>
              {voices.length === 0 && <p className="small muted">Máy chưa có giọng tiếng Anh dùng được (đã ẩn giọng robot/“Compact”).</p>}
              {voices.length > 0 && (
                <ul className="voice-list">
                  {voices.slice(0, 12).map((v) => (
                    <li key={v.name} className={s.ttsVoice === v.name ? 'is-on' : ''}>
                      <button className="icon-btn" onClick={() => speak(SAMPLE, { voice: v.name })} aria-label={`Nghe giọng ${v.name}`}><Play size={14} /></button>
                      <button className="voice-list__name" onClick={() => updateSettings({ ttsVoice: v.name })}>{v.name}</button>
                      <small className="muted">{v.lang}{voiceGender(v) && ` · ${voiceGender(v) === 'f' ? 'nữ' : 'nam'}`}</small>
                    </li>
                  ))}
                </ul>
              )}
              <p className="small muted">Listening không có audio: người dẫn đọc bằng giọng đã chọn, các nhân vật khác lần lượt dùng 3–4 giọng tốt nhất (xen kẽ nam/nữ).</p>
              <label className="row small"><input type="checkbox" checked={!!s.ttsOneVoice} onChange={(e) => updateSettings({ ttsOneVoice: e.target.checked })} /> Một giọng cho cả bài</label>
              <div className="row wrap">
                <span className="small muted">Tốc độ:</span>
                {[0.7, 0.85, 0.95, 1, 1.1].map((r) => <button key={r} className={`chip${s.ttsRate === r ? ' is-on' : ''}`} onClick={() => updateSettings({ ttsRate: r })}>{r}×</button>)}
              </div>
            </>
          )}
        </div>
      </section>

      <section className="card settings" id="vocab-settings">
        <div className="setting setting--col">
          <div className="setting__title"><strong>Từ vựng & ôn tập (FSRS)</strong></div>
          <p className="small muted">Lịch ôn tính bằng thuật toán FSRS: từ càng nhớ chắc thì càng lâu mới hỏi lại. Tỉ lệ nhớ mong muốn càng cao thì ôn càng nhiều.</p>
          <label className="row wrap small">Tỉ lệ nhớ mong muốn: <strong>{Math.round(s.retention * 100)}%</strong>
            <input type="range" min={85} max={95} step={1} value={Math.round(s.retention * 100)} onChange={(e) => updateSettings({ retention: +e.target.value / 100 })} aria-label="Tỉ lệ nhớ mong muốn" />
          </label>
        </div>
        <div className="setting">
          <div className="setting__title"><strong>Từ mới mỗi ngày</strong></div>
          <div className="seg">{[5, 10, 15, 20, 30].map((n) => <button key={n} className={`seg__btn${s.newCardsPerDay === n ? ' is-selected' : ''}`} onClick={() => updateSettings({ newCardsPerDay: n })}>{n}</button>)}</div>
        </div>
        <div className="setting">
          <div className="setting__title"><strong>Giới hạn ôn mỗi ngày</strong></div>
          <div className="seg">{[50, 100, 200, 500].map((n) => <button key={n} className={`seg__btn${s.reviewLimit === n ? ' is-selected' : ''}`} onClick={() => updateSettings({ reviewLimit: n })}>{n}</button>)}</div>
        </div>
        <div className="setting setting--col">
          <div className="setting__title"><strong>Dạng bài tập</strong></div>
          <div className="row wrap">{(Object.keys(EX_NAMES) as ExKind[]).map((k) => (
            <label key={k} className="chip-check"><input type="checkbox" checked={s.exercises[k] !== false} onChange={(e) => updateSettings({ exercises: { ...s.exercises, [k]: e.target.checked } })} /> {EX_NAMES[k]}</label>
          ))}</div>
          <p className="small muted">Tắt hết thì vẫn giữ "chọn nghĩa".</p>
        </div>
        <div className="setting setting--col">
          <div className="setting__title"><strong>Nghe & chép</strong></div>
          <label className="row small"><input type="checkbox" checked={s.dictSupport} onChange={(e) => updateSettings({ dictSupport: e.target.checked })} /> Hỗ trợ người mới ở cấp 1–2 (khung chữ cái đầu, chỉ điền từ khoá)</label>
          <div className="row wrap"><span className="small muted">Tự phát lại mỗi câu:</span>{[0, 1, 2, 3].map((n) => <button key={n} className={`chip${s.dictAutoReplay === n ? ' is-on' : ''}`} onClick={() => updateSettings({ dictAutoReplay: n })}>{n ? `${n} lần` : 'Không'}</button>)}</div>
          <div className="row wrap"><span className="small muted">Tốc độ giọng máy (cấp 1):</span>{[0.7, 0.85, 1].map((r) => <button key={r} className={`chip${s.dictRate === r ? ' is-on' : ''}`} onClick={() => updateSettings({ dictRate: r })}>{r}×</button>)}</div>
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
