import { useState } from 'react';
import { Bot, CheckCircle2, Eye, EyeOff, ExternalLink, ListRestart, Loader2, XCircle } from 'lucide-react';
import { activeKey, activeModels, aiReady, getAiConfig, updateAiConfig, useAiConfig, type AiConfig } from '../store';
import { EFFORT_NOTES, EFFORTS, PROVIDERS, effortOf, modelInfo, providerOf, type ProviderId } from '../ai/models';

const usd = (n: number) => n.toLocaleString('vi-VN', { maximumSignificantDigits: 2 });
/** Ước tính một lần chấm Writing/Speaking: ~4k token vào (đề + bài + rubric), 2–6k token ra. */
const estimate = ([i, o]: [number, number]) => [(4000 * i + 2000 * o) / 1e6, (4000 * i + 6000 * o) / 1e6];

/** Cấu hình AI theo thứ tự: nhà cung cấp → model → key → kiểm tra → chi phí. */
export default function AiSettings() {
  const cfg = useAiConfig();
  const p = providerOf(cfg.provider);
  const [show, setShow] = useState(false);
  const [test, setTest] = useState<{ state: 'idle' | 'busy' | 'ok' | 'fail'; msg?: string }>({ state: 'idle' });
  const [list, setList] = useState<{ state: 'idle' | 'busy' | 'fail'; ids: string[]; msg?: string }>({ state: 'idle', ids: [] });
  const effort = effortOf(cfg.effort);
  const { main, light } = activeModels(cfg);
  const reset = () => setTest({ state: 'idle' });

  const setProvider = (id: ProviderId) => { updateAiConfig({ provider: id }); reset(); setList({ state: 'idle', ids: [] }); };
  const setKey = (v: string) => { updateAiConfig(cfg.provider === 'anthropic' ? { apiKey: v } : { keys: { ...cfg.keys, [cfg.provider]: v } }); reset(); };
  const setModel = (which: 'main' | 'light', id: string) => {
    if (p.id === 'anthropic') updateAiConfig(which === 'main' ? { model: id } : { lightModel: id });
    else updateAiConfig({ models: { ...cfg.models, [p.id]: { main, light, [which]: id } } });
    reset();
  };
  const priceOf = (id: string): [number, number] | undefined => cfg.prices?.[id] ?? modelInfo(p, id).price;

  const runTest = async () => {
    setTest({ state: 'busy' });
    try {
      const { testConnection } = await import('../ai/client');
      setTest({ state: 'ok', msg: `Kết nối được (${await testConnection(getAiConfig())})` });
    } catch (e) { setTest({ state: 'fail', msg: e instanceof Error ? e.message : String(e) }); }
  };
  const fetchModels = async () => {
    setList({ state: 'busy', ids: [] });
    try {
      const { listModels } = await import('../ai/client');
      const rows = await listModels(getAiConfig());
      const prices = { ...getAiConfig().prices };
      for (const r of rows) if (r.price) prices[r.id] = r.price;
      updateAiConfig({ prices });
      setList({ state: 'idle', ids: rows.map((r) => r.id) });
    } catch (e) { setList({ state: 'fail', ids: [], msg: e instanceof Error ? e.message : String(e) }); }
  };

  const ready = aiReady(cfg);
  const canList = p.listModels && p.id !== 'anthropic' && (cfg.mode === 'key' ? (!!activeKey(cfg) || p.id === 'custom') && (p.id !== 'custom' || /^https?:\/\//.test(cfg.baseUrl)) : ready);
  const mainPrice = priceOf(main);

  return (
    <section className="card settings">
      <div className="setting setting--col">
        <div className="setting__title"><Bot size={18} /> <strong>AI chấm bài</strong></div>
        <p>Dùng cho: chấm Writing & Speaking theo band descriptors, dịch bài, tra từ theo ngữ cảnh, sinh đề từ văn bản/transcript bạn cung cấp.</p>

        <div className="field-row">
          <span>1. Nhà cung cấp</span>
          <div className="seg">{PROVIDERS.map((x) => <button key={x.id} className={`seg__btn${p.id === x.id ? ' is-selected' : ''}`} onClick={() => setProvider(x.id)}>{x.label}</button>)}</div>
          <div className="seg">
            <button className={`seg__btn${cfg.mode === 'key' ? ' is-selected' : ''}`} onClick={() => { updateAiConfig({ mode: 'key' }); reset(); }}>Key của tôi</button>
            <button className={`seg__btn${cfg.mode === 'proxy' ? ' is-selected' : ''}`} onClick={() => { updateAiConfig({ mode: 'proxy' }); reset(); }}>Qua proxy (mã truy cập)</button>
          </div>
        </div>

        <ModelPicker title="2. Model chấm bài / sinh đề" value={main} provider={p.id} options={p.models} ids={list.ids} onChange={(id) => setModel('main', id)} />
        {(() => { const info = modelInfo(p, main); return info.note ? <p className="muted small">{info.note}</p> : null; })()}
        <ModelPicker title="Model nhẹ (dịch câu, tra từ)" value={light} provider={p.id} options={p.models} ids={list.ids} onChange={(id) => setModel('light', id)} />
        {canList && (
          <div className="setting__actions">
            <button className="btn btn--ghost btn--sm" onClick={fetchModels} disabled={list.state === 'busy'}>
              {list.state === 'busy' ? <><Loader2 size={15} className="spin" /> Đang lấy…</> : <><ListRestart size={15} /> Lấy danh sách model từ {p.label}</>}
            </button>
            {list.ids.length > 0 && <span className="muted small">{list.ids.length} model – gõ vào ô model để chọn.</span>}
            {list.state === 'fail' && <span className="no-text"><XCircle size={16} /> {list.msg}</span>}
          </div>
        )}

        {cfg.mode === 'key' ? (
          <>
            {p.id === 'custom' && (
              <label className="field-row"><span>Base URL (OpenAI-compatible)</span><span className="field-row__input">
                <input type="url" value={cfg.baseUrl} placeholder="https://…/v1  (vd. http://localhost:11434/v1 cho Ollama)" autoComplete="off" spellCheck={false} onChange={(e) => { updateAiConfig({ baseUrl: e.target.value }); reset(); }} /></span></label>
            )}
            <label className="field-row">
              <span>3. API key {p.label}{p.id === 'anthropic' ? ' hoặc access token' : ''}{p.id === 'custom' ? ' (bỏ trống nếu không cần)' : ''}</span>
              <span className="field-row__input">
                <input type={show ? 'text' : 'password'} value={cfg.provider === 'anthropic' ? cfg.apiKey : cfg.keys?.[cfg.provider] ?? ''} placeholder={p.keyHint} autoComplete="off" spellCheck={false} onChange={(e) => setKey(e.target.value)} />
                <button type="button" className="icon-btn" onClick={() => setShow(!show)} aria-label={show ? 'Ẩn' : 'Hiện'}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </span>
            </label>
            <p className="muted small">
              {p.keyUrl && <><a href={p.keyUrl} target="_blank" rel="noreferrer">Lấy key {p.label} <ExternalLink size={12} /></a>. </>}
              Key chỉ lưu trên thiết bị này và gửi thẳng tới {p.id === 'custom' ? 'địa chỉ trên' : new URL(p.baseUrl ?? 'https://api.anthropic.com').host} – đừng nhập trên máy người khác.
            </p>
          </>
        ) : (
          <>
            <label className="field-row"><span>3. Địa chỉ proxy</span><span className="field-row__input">
              <input type="url" value={cfg.proxyUrl} placeholder="https://ielts-grader.<tên>.workers.dev" autoComplete="off" spellCheck={false} onChange={(e) => { updateAiConfig({ proxyUrl: e.target.value }); reset(); }} /></span></label>
            <label className="field-row"><span>Mã truy cập</span><span className="field-row__input">
              <input type={show ? 'text' : 'password'} value={cfg.accessCode} autoComplete="off" spellCheck={false} onChange={(e) => { updateAiConfig({ accessCode: e.target.value }); reset(); }} />
              <button type="button" className="icon-btn" onClick={() => setShow(!show)} aria-label="Hiện">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
            <p className="muted small">Người dựng proxy (thư mục <code>server/grader-proxy</code>) giữ API key và cấp mã truy cập, có giới hạn lượt mỗi ngày. Nhà cung cấp và model ở trên phải khớp với proxy cho phép.</p>
          </>
        )}

        <div className="setting__actions">
          <button className="btn btn--ghost btn--sm" onClick={runTest} disabled={!ready || test.state === 'busy'}>
            {test.state === 'busy' ? <><Loader2 size={15} className="spin" /> Đang kiểm tra…</> : '4. Kiểm tra kết nối'}
          </button>
          {test.state === 'ok' && <span className="ok-text"><CheckCircle2 size={16} /> {test.msg}</span>}
          {test.state === 'fail' && <span className="no-text"><XCircle size={16} /> {test.msg}</span>}
        </div>

        <div className="field-row">
          <span>5. Chi phí</span>
          {mainPrice ? (
            <p className="muted small">
              {main}: {usd(mainPrice[0])} / {usd(mainPrice[1])} USD mỗi 1 triệu token vào / ra → ước tính {usd(estimate(mainPrice)[0])}–{usd(estimate(mainPrice)[1])} USD mỗi lần chấm.
              {' '}Giá tham khảo{cfg.prices?.[main] ? ' lấy từ danh sách model' : ' ghi 11/2026'}{p.pricingUrl && <> – <a href={p.pricingUrl} target="_blank" rel="noreferrer">xem giá hiện tại</a></>}.
            </p>
          ) : <PriceInput cfg={cfg} id={main} />}
        </div>

        {(p.id === 'anthropic' || p.id === 'openai') && (
          <div className="field-row">
            <span>Effort</span>
            <div className="seg">{EFFORTS.map((e) => <button key={e} className={`seg__btn${effort === e ? ' is-selected' : ''}`} onClick={() => updateAiConfig({ effort: e })}>{e}</button>)}</div>
            <p className="muted small">{EFFORT_NOTES[effort]}{p.id === 'openai' && (effort === 'xhigh' || effort === 'max') ? ' (OpenAI: tính như high.)' : ''}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function ModelPicker({ title, value, provider, options, ids, onChange }: { title: string; value: string; provider: string; options: { id: string; label: string }[]; ids: string[]; onChange: (id: string) => void }) {
  const listId = `models-${provider}-${title.length}`;
  const preset = options.some((o) => o.id === value);
  return (
    <div className="field-row">
      <span>{title}</span>
      {options.length > 0 && <div className="seg">{options.map((m) => <button key={m.id} className={`seg__btn${value === m.id ? ' is-selected' : ''}`} onClick={() => onChange(m.id)}>{m.label}</button>)}</div>}
      {provider !== 'anthropic' && (
        <span className="field-row__input">
          <input value={value} list={listId} placeholder="Tên model, vd. deepseek-v4-pro" autoComplete="off" spellCheck={false} aria-label={`${title} (gõ tên)`}
            className={preset ? 'is-preset' : ''} onChange={(e) => onChange(e.target.value.trim())} />
          <datalist id={listId}>{ids.map((id) => <option key={id} value={id} />)}</datalist>
        </span>
      )}
    </div>
  );
}

function PriceInput({ cfg, id }: { cfg: AiConfig; id: string }) {
  const cur = cfg.prices?.[id];
  const set = (i: 0 | 1, v: string) => {
    const n = Number(v.replace(',', '.'));
    const next: [number, number] = [...(cur ?? [0, 0])] as [number, number];
    next[i] = Number.isFinite(n) ? n : 0;
    updateAiConfig({ prices: { ...cfg.prices, [id]: next } });
  };
  return (
    <>
      <p className="muted small">Chưa biết giá của {id || 'model này'}. Nhập giá (USD / 1 triệu token) để app ước tính chi phí:</p>
      <span className="price-in">
        <label>vào <input inputMode="decimal" defaultValue={cur?.[0] ?? ''} onChange={(e) => set(0, e.target.value)} /></label>
        <label>ra <input inputMode="decimal" defaultValue={cur?.[1] ?? ''} onChange={(e) => set(1, e.target.value)} /></label>
      </span>
    </>
  );
}
