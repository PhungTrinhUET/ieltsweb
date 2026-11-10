import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot, CheckCircle2, Eye, EyeOff, Gift, ListRestart, Loader2, XCircle } from 'lucide-react';
import { activeKey, activeModels, aiReady, getAiConfig, updateAiConfig, useAiConfig, type AiConfig } from '../store';
import { EFFORT_NOTES, EFFORTS, PROVIDERS, effortOf, modelInfo, priceNow, providerOf, type ProviderId } from '../ai/models';
import { METHODS, essayCost, fmtUsd, fmtVnd, freeOpenRouterModels, type MethodId } from '../ai/setup';
import { CompareTable, KeySteps, QuickPick } from './AiGuide';

const usd = (n: number) => n.toLocaleString('vi-VN', { maximumSignificantDigits: 2 });
const methodOf = (c: AiConfig): MethodId => c.mode === 'proxy' ? 'proxy'
  : c.provider === 'openrouter' && /:free$/.test(activeModels(c).main) ? 'or-free'
  : c.provider as MethodId;

type Test = { state: 'idle' | 'busy' | 'ok' | 'fail'; msg?: string; model?: string; ms?: number };

/** Cài AI theo 3 bước: chọn cách → lấy key → dán và kiểm tra. Model/effort/giá ở mục Nâng cao. */
export default function AiSettings() {
  const cfg = useAiConfig();
  const p = providerOf(cfg.provider);
  const [method, setMethod] = useState<MethodId>(() => methodOf(cfg));
  const [show, setShow] = useState(false);
  const [test, setTest] = useState<Test>({ state: 'idle' });
  const [list, setList] = useState<{ state: 'idle' | 'busy' | 'fail'; ids: string[]; msg?: string }>({ state: 'idle', ids: [] });
  const [free, setFree] = useState<{ state: 'idle' | 'busy' | 'fail'; rows: { id: string; name: string }[]; msg?: string }>({ state: 'idle', rows: [] });
  const effort = effortOf(cfg.effort);
  const { main, light } = activeModels(cfg);
  const reset = () => setTest({ state: 'idle' });
  const [sp] = useSearchParams();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { if (sp.get('ai')) ref.current?.scrollIntoView({ block: 'start' }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (id: MethodId) => {
    setMethod(id); reset(); setList({ state: 'idle', ids: [] });
    if (id === 'proxy') updateAiConfig({ mode: 'proxy' });
    else updateAiConfig({ mode: 'key', provider: METHODS.find((m) => m.id === id)?.provider ?? (id as ProviderId) });
  };
  const setProvider = (id: ProviderId) => { updateAiConfig({ provider: id }); reset(); setList({ state: 'idle', ids: [] }); if (cfg.mode === 'key') setMethod(id as MethodId); };
  const setKey = (v: string) => { updateAiConfig(cfg.provider === 'anthropic' ? { apiKey: v } : { keys: { ...cfg.keys, [cfg.provider]: v } }); reset(); };
  const setModel = (which: 'main' | 'light', id: string) => {
    if (p.id === 'anthropic') updateAiConfig(which === 'main' ? { model: id } : { lightModel: id });
    else updateAiConfig({ models: { ...cfg.models, [p.id]: { main, light, [which]: id } } });
    reset();
  };
  const priceOf = (id: string): [number, number] | undefined => cfg.prices?.[id] ?? priceNow(modelInfo(p, id));

  const runTest = async () => {
    setTest({ state: 'busy' });
    const t0 = performance.now();
    try {
      const { testConnection } = await import('../ai/client');
      const model = await testConnection(getAiConfig());
      setTest({ state: 'ok', model, ms: Math.round(performance.now() - t0) });
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
  const fetchFree = async () => {
    setFree({ state: 'busy', rows: [] });
    try { setFree({ state: 'idle', rows: await freeOpenRouterModels() }); }
    catch (e) { setFree({ state: 'fail', rows: [], msg: `Không lấy được danh sách (${e instanceof Error ? e.message : e}).` }); }
  };
  const chooseFree = (id: string) => { updateAiConfig({ models: { ...cfg.models, openrouter: { main: id, light: id } }, prices: { ...cfg.prices, [id]: [0, 0] } }); reset(); };

  const ready = aiReady(cfg);
  const canList = p.listModels && p.id !== 'anthropic' && (cfg.mode === 'key' ? (!!activeKey(cfg) || p.id === 'custom') && (p.id !== 'custom' || /^https?:\/\//.test(cfg.baseUrl)) : ready);
  const mainPrice = priceOf(main);
  const cost = mainPrice && essayCost(mainPrice);

  return (
    <section className="card settings" id="ai-setup" ref={ref} data-testid="ai-setup">
      <div className="setting setting--col">
        <div className="setting__title"><Bot size={18} /> <strong>AI chấm bài</strong> {ready && <span className="ok-text small"><CheckCircle2 size={14} /> đã cài</span>}</div>
        <p className="small">Dùng cho: chấm Writing & Speaking theo band descriptors, dịch bài, tra từ theo ngữ cảnh, sinh đề. Làm 3 bước, khoảng 3 phút.</p>
        <QuickPick />

        <h3 className="aiw-h">1. Chọn cách dùng</h3>
        <div className="aiw-methods" role="radiogroup" aria-label="Cách dùng AI">
          {METHODS.map((m) => (
            <button key={m.id} role="radio" aria-checked={method === m.id} className={`aiw-m${method === m.id ? ' is-on' : ''}`} onClick={() => pick(m.id)} data-testid={`aiw-m-${m.id}`}>
              <span className="aiw-m__t">{m.free && <Gift size={14} aria-hidden />} {m.title}</span>
              <span className={`aiw-tag${m.free ? ' is-free' : ''}`}>{m.tag}</span>
              <span className="aiw-m__d small muted">{m.desc}</span>
            </button>
          ))}
        </div>
        <button className={`btn btn--text btn--sm${method === 'custom' ? ' is-on' : ''}`} onClick={() => pick('custom')}>Khác: dịch vụ tương thích OpenAI (Ollama, LM Studio…)</button>

        <h3 className="aiw-h">2. {method === 'proxy' ? 'Xin mã lớp' : method === 'custom' ? 'Chuẩn bị dịch vụ' : `Lấy key ${p.label}`}</h3>
        <KeySteps method={method} />

        <h3 className="aiw-h">3. Dán và kiểm tra</h3>
        {cfg.mode === 'key' ? (
          <>
            {p.id === 'custom' && (
              <>
                <label className="field-row"><span>Base URL (OpenAI-compatible)</span><span className="field-row__input">
                  <input type="url" value={cfg.baseUrl} placeholder="https://…/v1  (vd. http://localhost:11434/v1 cho Ollama)" autoComplete="off" spellCheck={false} onChange={(e) => { updateAiConfig({ baseUrl: e.target.value }); reset(); }} /></span></label>
                <ModelPicker title="Tên model" value={main} provider={p.id} options={[]} ids={list.ids} onChange={(id) => updateAiConfig({ models: { ...cfg.models, custom: { main: id, light: light || id } } })} />
              </>
            )}
            <label className="field-row">
              <span>API key {p.label}{p.id === 'anthropic' ? ' hoặc access token' : ''}{p.id === 'custom' ? ' (bỏ trống nếu không cần)' : ''}</span>
              <span className="field-row__input">
                <input type={show ? 'text' : 'password'} value={cfg.provider === 'anthropic' ? cfg.apiKey : cfg.keys?.[cfg.provider] ?? ''} placeholder={p.keyHint} autoComplete="off" spellCheck={false} onChange={(e) => setKey(e.target.value)} data-testid="aiw-key" aria-label={`API key ${p.label}`} />
                <button type="button" className="icon-btn" onClick={() => setShow(!show)} aria-label={show ? 'Ẩn' : 'Hiện'}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </span>
            </label>
            <p className="muted small">Key chỉ lưu trên thiết bị này và gửi thẳng tới {p.id === 'custom' ? 'địa chỉ trên' : new URL(p.baseUrl ?? 'https://api.anthropic.com').host} – đừng nhập trên máy người khác.</p>
            {method === 'or-free' && (
              <div className="aiw-free">
                <div className="row wrap">
                  <button className="btn btn--ghost btn--sm" onClick={fetchFree} disabled={free.state === 'busy'} data-testid="aiw-free">{free.state === 'busy' ? <><Loader2 size={15} className="spin" /> Đang lấy…</> : <><Gift size={15} /> Chỉ hiện model miễn phí</>}</button>
                  <span className="small muted">Đang dùng: <code>{main || '—'}</code></span>
                </div>
                {free.state === 'fail' && <p className="no-text small">{free.msg}</p>}
                {free.rows.length > 0 && (
                  <div className="aiw-free__list" data-testid="aiw-free-list">
                    {free.rows.slice(0, 40).map((m) => <button key={m.id} className={`chip${main === m.id ? ' is-on' : ''}`} onClick={() => chooseFree(m.id)} title={m.id}>{m.name.replace(/\s*\(free\)$/i, '')}</button>)}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <label className="field-row"><span>Địa chỉ proxy</span><span className="field-row__input">
              <input type="url" value={cfg.proxyUrl} placeholder="https://ielts-grader.<tên>.workers.dev" autoComplete="off" spellCheck={false} onChange={(e) => { updateAiConfig({ proxyUrl: e.target.value }); reset(); }} aria-label="Địa chỉ proxy" /></span></label>
            <label className="field-row"><span>Mã truy cập</span><span className="field-row__input">
              <input type={show ? 'text' : 'password'} value={cfg.accessCode} autoComplete="off" spellCheck={false} onChange={(e) => { updateAiConfig({ accessCode: e.target.value }); reset(); }} aria-label="Mã truy cập" />
              <button type="button" className="icon-btn" onClick={() => setShow(!show)} aria-label="Hiện">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
            <p className="muted small">Người dựng proxy (thư mục <code>server/grader-proxy</code>) giữ API key và cấp mã truy cập. Nhà cung cấp và model ở mục Nâng cao phải khớp với proxy cho phép.</p>
          </>
        )}

        <div className="setting__actions">
          <button className="btn btn--primary btn--sm" onClick={runTest} disabled={!ready || test.state === 'busy'} data-testid="aiw-test">
            {test.state === 'busy' ? <><Loader2 size={15} className="spin" /> Đang kiểm tra…</> : 'Kiểm tra kết nối'}
          </button>
          {!ready && <span className="small muted">{cfg.mode === 'proxy' ? 'Nhập địa chỉ proxy trước.' : 'Dán key trước.'}</span>}
        </div>
        {test.state === 'ok' && (
          <div className="aiw-result is-ok" data-testid="aiw-ok">
            <p><CheckCircle2 size={16} /> <strong>Kết nối được.</strong> Model: <code>{test.model}</code> · phản hồi {(test.ms! / 1000).toFixed(1)} giây</p>
            <p className="small">{cfg.mode === 'proxy' ? 'Chi phí: giáo viên trả, học viên 0 đ.' : cost === 0 ? 'Chi phí: 0 đ (model miễn phí, có giới hạn lượt).' : cost ? <>Ước tính mỗi bài chấm: <strong>{fmtUsd(cost)}</strong> ({fmtVnd(cost)}).</> : 'Chưa biết giá model này – nhập ở mục Nâng cao để ước tính.'}</p>
          </div>
        )}
        {test.state === 'fail' && <p className="aiw-result is-fail no-text" data-testid="aiw-fail"><XCircle size={16} /> {test.msg}</p>}

        <details className="aiw-more">
          <summary>Model và tuỳ chọn nâng cao</summary>
          <div className="stack">
            <div className="field-row">
              <span>Nhà cung cấp{cfg.mode === 'proxy' ? ' (proxy cho phép)' : ''}</span>
              <div className="seg">{PROVIDERS.map((x) => <button key={x.id} className={`seg__btn${p.id === x.id ? ' is-selected' : ''}`} onClick={() => setProvider(x.id)}>{x.label}</button>)}</div>
            </div>
            <ModelPicker title="Model chấm bài / sinh đề" value={main} provider={p.id} options={p.models} ids={list.ids} onChange={(id) => setModel('main', id)} />
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
            <div className="field-row">
              <span>Chi phí</span>
              {mainPrice ? (
                <p className="muted small">
                  {main}: {usd(mainPrice[0])} / {usd(mainPrice[1])} USD mỗi 1 triệu token vào / ra → khoảng {fmtUsd(essayCost(mainPrice))} ({fmtVnd(essayCost(mainPrice))}) mỗi bài chấm.
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
        </details>

        <details className="aiw-more">
          <summary>So sánh các cách (miễn phí, giá, hạn mức)</summary>
          <CompareTable />
        </details>
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
