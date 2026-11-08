import { useState } from 'react';
import { Bot, CheckCircle2, Eye, EyeOff, Loader2, XCircle } from 'lucide-react';
import { aiReady, getAiConfig, updateAiConfig, useAiConfig } from '../store';
import { EFFORT_NOTES, EFFORTS, GRADER_MODELS, effortOf, modelOf } from '../ai/models';

const usd = (n: number) => n.toLocaleString('vi-VN', { maximumSignificantDigits: 2 });

/** Cấu hình Claude: API key cá nhân hoặc proxy; model chấm bài và model nhẹ cho dịch/tra từ. */
export default function AiSettings() {
  const cfg = useAiConfig();
  const [show, setShow] = useState(false);
  const [test, setTest] = useState<{ state: 'idle' | 'busy' | 'ok' | 'fail'; msg?: string }>({ state: 'idle' });
  const model = modelOf(cfg.model);
  const effort = effortOf(cfg.effort);
  const cost = model.price[1] / 20;

  const runTest = async () => {
    setTest({ state: 'busy' });
    try {
      const { testConnection } = await import('../ai/client');
      setTest({ state: 'ok', msg: `Kết nối được (${await testConnection(getAiConfig())})` });
    } catch (e) { setTest({ state: 'fail', msg: e instanceof Error ? e.message : String(e) }); }
  };

  return (
    <section className="card settings">
      <div className="setting setting--col">
        <div className="setting__title"><Bot size={18} /> <strong>AI (Claude)</strong></div>
        <p>Dùng cho: chấm Writing & Speaking theo band descriptors, dịch bài, tra từ theo ngữ cảnh, sinh đề từ văn bản/transcript bạn cung cấp.</p>
        <div className="seg">
          <button className={`seg__btn${cfg.mode === 'key' ? ' is-selected' : ''}`} onClick={() => updateAiConfig({ mode: 'key' })}>API key cá nhân</button>
          <button className={`seg__btn${cfg.mode === 'proxy' ? ' is-selected' : ''}`} onClick={() => updateAiConfig({ mode: 'proxy' })}>Qua proxy</button>
        </div>
        {cfg.mode === 'key' ? (
          <>
            <label className="field-row">
              <span>API key hoặc access token</span>
              <span className="field-row__input">
                <input type={show ? 'text' : 'password'} value={cfg.apiKey} placeholder="sk-ant-api…" autoComplete="off" spellCheck={false}
                  onChange={(e) => { updateAiConfig({ apiKey: e.target.value }); setTest({ state: 'idle' }); }} />
                <button type="button" className="icon-btn" onClick={() => setShow(!show)} aria-label={show ? 'Ẩn' : 'Hiện'}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </span>
            </label>
            <p className="muted small">Lấy key tại console.anthropic.com. Key chỉ lưu trên thiết bị này và gửi thẳng tới api.anthropic.com – đừng nhập trên máy người khác.</p>
          </>
        ) : (
          <>
            <label className="field-row"><span>Địa chỉ proxy</span><span className="field-row__input">
              <input type="url" value={cfg.proxyUrl} placeholder="https://ielts-grader.<tên>.workers.dev" autoComplete="off" spellCheck={false} onChange={(e) => { updateAiConfig({ proxyUrl: e.target.value }); setTest({ state: 'idle' }); }} /></span></label>
            <label className="field-row"><span>Mã truy cập (nếu có)</span><span className="field-row__input">
              <input type={show ? 'text' : 'password'} value={cfg.accessCode} autoComplete="off" spellCheck={false} onChange={(e) => { updateAiConfig({ accessCode: e.target.value }); setTest({ state: 'idle' }); }} />
              <button type="button" className="icon-btn" onClick={() => setShow(!show)} aria-label="Hiện">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
            <p className="muted small">Proxy giữ API key phía máy chủ (thư mục <code>server/grader-proxy</code>). Nhớ thêm các model dùng vào <code>ALLOWED_MODELS</code>.</p>
          </>
        )}
        <div className="setting__actions">
          <button className="btn btn--ghost btn--sm" onClick={runTest} disabled={!aiReady(cfg) || test.state === 'busy'}>
            {test.state === 'busy' ? <><Loader2 size={15} className="spin" /> Đang kiểm tra…</> : 'Kiểm tra kết nối'}
          </button>
          {test.state === 'ok' && <span className="ok-text"><CheckCircle2 size={16} /> {test.msg}</span>}
          {test.state === 'fail' && <span className="no-text"><XCircle size={16} /> {test.msg}</span>}
        </div>
        <div className="field-row">
          <span>Model chấm bài / sinh đề</span>
          <div className="seg">{GRADER_MODELS.map((m) => <button key={m.id} className={`seg__btn${model.id === m.id ? ' is-selected' : ''}`} onClick={() => updateAiConfig({ model: m.id })}>{m.label}</button>)}</div>
          <p className="muted small">{model.note} Giá {usd(model.price[0])} / {usd(model.price[1])} USD mỗi 1 triệu token vào / ra. Ước tính {usd(0.03 * cost)}–{usd(0.12 * cost)} USD mỗi lần chấm.</p>
        </div>
        <div className="field-row">
          <span>Model nhẹ (dịch câu, tra từ)</span>
          <div className="seg">{GRADER_MODELS.map((m) => <button key={m.id} className={`seg__btn${cfg.lightModel === m.id ? ' is-selected' : ''}`} onClick={() => updateAiConfig({ lightModel: m.id })}>{m.label}</button>)}</div>
        </div>
        <div className="field-row">
          <span>Effort</span>
          <div className="seg">{EFFORTS.map((e) => <button key={e} className={`seg__btn${effort === e ? ' is-selected' : ''}`} onClick={() => updateAiConfig({ effort: e })}>{e}</button>)}</div>
          <p className="muted small">{EFFORT_NOTES[effort]}</p>
        </div>
      </div>
    </section>
  );
}
