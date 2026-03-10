import React, { useState, useRef, useCallback, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import ResultsView from './components/ResultsView';
import { parseExcel, parseApprovedSheet } from './utils/parseExcel';
import { analyzeAll } from './utils/youtube';
import { scoreCreators, summarizeResults, DEFAULTS, detectCategoryProfile } from './utils/scorer';
import { detectFacesForAll } from './utils/faceDetect';
import { analyzeCreativeAll } from './utils/creative';
import HelpModal from './components/HelpModal';
import CampaignResults from './components/CampaignResults';

const DEFAULT_API_KEY    = 'AIzaSyAhUmhy4INV8O7m7Q2sVSqoy0a3TXh5MH0';

const CAT_ORDER_APP  = ['mobile', 'non_gaming', 'gaming'];
const CAT_LABEL_APP  = { mobile: '📱 Mobile', non_gaming: '🌐 Non-Gaming', gaming: '🎮 Gaming' };
const CAT_COLOR_APP  = { mobile: '#9eff6f', non_gaming: '#4a9eff', gaming: '#cf9fff' };
const CAT_BG_APP     = { mobile: '#1a3a0d', non_gaming: '#0d1f3a', gaming: '#2a1a3a' };
const PRICE_BANDS    = [
  { label: '$200–$2,000',    min: 200,  max: 2000  },
  { label: '$2,000–$8,500',  min: 2000, max: 8500  },
  { label: '$8,500–$20,000', min: 8500, max: 20000 },
];
const fmtM = n => typeof n === 'number' && n ? `$${n.toLocaleString()}` : '—';
const fmtN = n => typeof n === 'number' && n ? n.toLocaleString() : '—';

function ApprovedSheetView({ creators }) {
  if (!creators) return (
    <div style={{ color: '#555', padding: '48px 0', textAlign: 'center' }}>
      No Approved sheet found — upload an Excel file that contains an "Approved" tab.
    </div>
  );
  if (!creators.length) return (
    <div style={{ color: '#555', padding: '48px 0', textAlign: 'center' }}>Approved sheet is empty.</div>
  );

  // Exclude declined creators
  const active = creators.filter(c => !/declined/i.test(c.status || ''));

  const byCat = {};
  for (const cat of [...CAT_ORDER_APP, 'unknown']) byCat[cat] = [];
  for (const c of active) {
    const cat = CAT_ORDER_APP.includes(detectCategoryProfile(c.category))
      ? detectCategoryProfile(c.category) : 'unknown';
    byCat[cat].push(c);
  }

  const totalAll = active.reduce((s, c) => s + (c.price || 0), 0);
  const globalBands = PRICE_BANDS.map(b => {
    const inBand = active.filter(c => (c.price || 0) >= b.min && (c.price || 0) < b.max);
    return { ...b, count: inBand.length, sum: inBand.reduce((s, c) => s + (c.price || 0), 0) };
  });
  const declined = creators.length - active.length;

  return (
    <div>
      {/* ── Global summary ── */}
      <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '16px 20px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={{ color: '#6fcf6f', fontWeight: 700, fontSize: '1rem' }}>Total Budget</span>
          <span style={{ color: '#6fcf6f', fontWeight: 800, fontSize: '1.3rem' }}>{fmtM(totalAll)}</span>
          <span style={{ color: '#555', fontSize: '0.78rem' }}>{active.length} creators{declined > 0 ? ` · ${declined} declined excluded` : ''}</span>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {globalBands.map(b => (
            <div key={b.label} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, padding: '10px 16px', minWidth: 160 }}>
              <div style={{ color: '#666', fontSize: '0.72rem', marginBottom: 4 }}>{b.label}</div>
              <div style={{ color: '#6fcf6f', fontWeight: 700, fontSize: '1.05rem' }}>{b.sum ? fmtM(b.sum) : '—'}</div>
              <div style={{ color: '#555', fontSize: '0.72rem', marginTop: 2 }}>{b.count} creator{b.count !== 1 ? 's' : ''}</div>
            </div>
          ))}
        </div>
      </div>

      {[...CAT_ORDER_APP, 'unknown'].filter(cat => byCat[cat]?.length > 0).map(cat => {
        const rows  = byCat[cat];
        const color = CAT_COLOR_APP[cat] || '#aaa';
        const bg    = CAT_BG_APP[cat]    || '#1a1a1a';
        const label = CAT_LABEL_APP[cat] || cat;
        const catTotal = rows.reduce((s, r) => s + (r.price || 0), 0);

        const bands = PRICE_BANDS.map(b => {
          const inBand = rows.filter(r => (r.price || 0) >= b.min && (r.price || 0) < b.max);
          return { ...b, count: inBand.length, sum: inBand.reduce((s, r) => s + (r.price || 0), 0) };
        });

        return (
          <div key={cat} style={{ marginBottom: 36 }}>
            {/* Category header */}
            <div style={{ background: bg, borderTop: `2px solid ${color}`, borderBottom: `1px solid ${color}40`, padding: '8px 14px', marginBottom: 12 }}>
              <span style={{ color, fontWeight: 700, fontSize: '0.9rem' }}>{label}</span>
              <span style={{ marginLeft: 12, color: `${color}aa`, fontSize: '0.78rem' }}>
                {rows.length} creator{rows.length !== 1 ? 's' : ''} · {fmtM(catTotal)}
              </span>
            </div>

            {/* Price-band summary */}
            <table style={{ marginBottom: 14, width: 'auto', fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', color: '#666', paddingRight: 24 }}>Price Range</th>
                  <th style={{ textAlign: 'right', color: '#666', paddingRight: 24 }}>Creators</th>
                  <th style={{ textAlign: 'right', color: '#666' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {bands.map(b => (
                  <tr key={b.label}>
                    <td style={{ color: '#aaa', paddingRight: 24 }}>{b.label}</td>
                    <td style={{ textAlign: 'right', paddingRight: 24, color: b.count ? '#ccc' : '#444' }}>{b.count || '—'}</td>
                    <td style={{ textAlign: 'right', color: b.sum ? '#6fcf6f' : '#444' }}>{b.sum ? fmtM(b.sum) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Creator table */}
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Name</th><th>Status</th><th>Release Date</th>
                    <th>Format</th><th>Category</th><th>Followers</th>
                    <th>Expected Views</th><th>Price</th><th>CPM</th>
                    <th>ER</th><th>Geos</th><th>GOAT Comment</th><th>Zorka Comment</th>
                    <th>Scripts/Drafts</th><th>Release Link</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} style={{ background: '#0d1f0d' }}>
                      <td>{i + 1}</td>
                      <td>{r.link ? <a href={r.link} target="_blank" rel="noreferrer" style={{ color: '#4a9eff', textDecoration: 'none' }}>{r.name}</a> : r.name}</td>
                      <td style={{ fontSize: '0.78rem', color: '#aaa' }}>{r.status || '—'}</td>
                      <td style={{ fontSize: '0.78rem', color: '#aaa', whiteSpace: 'nowrap' }}>{r.release_date || '—'}</td>
                      <td>{r.format || '—'}</td>
                      <td style={{ fontSize: '0.78rem' }}>{r.category || '—'}</td>
                      <td className="num">{fmtN(r.followers)}</td>
                      <td className="num">{fmtN(r.claimed_views)}</td>
                      <td className="num">{fmtM(r.price)}</td>
                      <td className="num">{r.zorka_cpm ? r.zorka_cpm.toFixed(1) : '—'}</td>
                      <td className="num">{r.er ? (r.er * 100).toFixed(1) + '%' : '—'}</td>
                      <td style={{ fontSize: '0.78rem' }}>{r.geo || '—'}</td>
                      <td style={{ fontSize: '0.75rem', color: '#999', minWidth: 140 }}>{r.goat_comment || '—'}</td>
                      <td style={{ fontSize: '0.75rem', color: '#999', minWidth: 140 }}>{r.zorka_comment || '—'}</td>
                      <td style={{ fontSize: '0.75rem', color: '#aaa' }}>{r.scripts || '—'}</td>
                      <td>{r.release_link ? <a href={r.release_link} target="_blank" rel="noreferrer" style={{ color: '#4a9eff', fontSize: '0.75rem' }}>Link</a> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [step, setStep] = useState('upload'); // upload | config | fetching | results
  const [creators, setCreators] = useState([]);
  const [parseInfo, setParseInfo] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, name: '', phase: 'youtube' });
  const [results, setResults] = useState(null);
  const [summary, setSummary] = useState(null);
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY);
  const [openaiKey, setOpenaiKey] = useState('');
  const [config, setConfig] = useState({ ...DEFAULTS });
  const [showConfig, setShowConfig] = useState(false);
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(100);
  const [showHelp, setShowHelp] = useState(false);
  const [savedSession, setSavedSession] = useState(null);
  const [appTab, setAppTab] = useState('all');
  const [approvedFromFile, setApprovedFromFile] = useState(null);

  const STORAGE_KEY = 'influencer_pipeline_session';

  // ── Load saved session on mount ──
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSavedSession(JSON.parse(raw));
    } catch { }
  }, []);

  const restoreSession = () => {
    setResults(savedSession.results);
    setSummary(savedSession.summary);
    setCreators(savedSession.creators);
    setParseInfo(savedSession.parseInfo);
    setConfig(savedSession.config);
    if (savedSession.approvedFromFile) setApprovedFromFile(savedSession.approvedFromFile);
    setStep('results');
  };

  const clearSession = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedSession(null);
  };

  // ── Upload ──
  const handleFile = useCallback((arrayBuffer, fileName) => {
    try {
      const { creators: parsed, sheetName, startRow, format } = parseExcel(arrayBuffer);
      setCreators(parsed);
      setParseInfo({ sheetName, startRow, fileName, count: parsed.length, format: format || 'zorka' });
      setRangeStart(1);
      setRangeEnd(parsed.length);
      const approved = parseApprovedSheet(arrayBuffer);
      if (approved) setApprovedFromFile(approved);
      setStep('config');
    } catch (err) {
      alert(`Error parsing file: ${err.message}`);
    }
  }, []);

  // ── Run pipeline ──
  const runPipeline = useCallback(async () => {
    const start = Math.max(1, rangeStart) - 1;
    const end = Math.min(creators.length, rangeEnd);
    const subset = creators.slice(start, end);

    setStep('fetching');
    setProgress({ current: 0, total: subset.length, name: '', phase: 'youtube' });

    try {
      const updated = await analyzeAll(apiKey, [...subset], (i, total, name) => {
        setProgress({ current: i, total, name, phase: 'youtube' });
      });

      setProgress({ current: 0, total: updated.length, name: '', phase: 'face' });
      const withFaces = await detectFacesForAll(updated, (i, total, name) => {
        setProgress({ current: i, total, name, phase: 'face' });
      });

      let withCreative = withFaces;
      if (openaiKey) {
        setProgress({ current: 0, total: withFaces.length, name: '', phase: 'creative' });
        withCreative = await analyzeCreativeAll(openaiKey, [...withFaces], (i, total, name) => {
          setProgress({ current: i, total, name, phase: 'creative' });
        });
      }

      setCreators(withCreative);
      const scored = scoreCreators(withCreative, config);
      const summ = summarizeResults(scored);
      setResults(scored);
      setSummary(summ);
      setStep('results');

      // ── Persist to localStorage ──
      try {
        const session = { results: scored, summary: summ, creators: withCreative, parseInfo, config, savedAt: Date.now(), approvedFromFile: approvedFromFile || null };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        setSavedSession(session);
      } catch { }
    } catch (err) {
      alert(`Error: ${err.message}`);
      setStep('config');
    }
  }, [creators, apiKey, config, rangeStart, rangeEnd, approvedFromFile]);

  const updateConfig = (key, val) => {
    setConfig(prev => ({ ...prev, [key]: parseFloat(val) || 0 }));
  };

  // ── Re-score only (no re-fetch) ──
  const reScore = useCallback(() => {
    const scored = scoreCreators(creators, config);
    const summ = summarizeResults(scored);
    setResults(scored);
    setSummary(summ);
  }, [creators, config]);

  // ── Manual face override ──
  const onFaceOverride = useCallback((link, answer) => {
    // answer: 'yes' | 'no'
    setCreators(prev => {
      const updated = prev.map(c => {
        if (c.link !== link) return c;
        return {
          ...c,
          api: {
            ...c.api,
            face: { ...(c.api?.face || {}), face_override: answer },
          },
        };
      });
      const scored = scoreCreators(updated, config);
      const summ = summarizeResults(scored);
      setResults(scored);
      setSummary(summ);
      return updated;
    });
  }, [config]);

  return (
    <div className="app">
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>Influencer Pipeline Evaluator</h1>
          <p style={{ color: '#888', marginBottom: 12 }}>
            Upload Zorka Excel → Fetch YT data → Auto-score → Review decisions
          </p>
        </div>
        <button
          onClick={() => setShowHelp(true)}
          title="How everything works"
          style={{
            marginTop: 6, background: 'none', border: '1px solid #3a3a3a',
            color: '#888', borderRadius: '50%', width: 32, height: 32,
            cursor: 'pointer', fontSize: '1rem', fontWeight: 700, flexShrink: 0,
          }}
        >?</button>
      </div>

      {/* ── Top-level tabs ── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
        {[
          { id: 'all',      label: 'All',             accent: '#4a9eff', activeBg: '#0d1220' },
          { id: 'approved', label: `Approved${summary ? ` (${summary.greens?.length ?? 0})` : ''}`, accent: '#6fcf6f', activeBg: '#0d1f0d' },
          { id: 'compare',  label: 'Compare Results', accent: '#f0a030', activeBg: '#1a1000' },
        ].map((tab, idx, arr) => (
          <button key={tab.id} onClick={() => setAppTab(tab.id)} style={{
            padding: '7px 22px',
            border: '1px solid #2a2a2a',
            borderBottom: appTab === tab.id ? `2px solid ${tab.accent}` : '1px solid #2a2a2a',
            background: appTab === tab.id ? tab.activeBg : '#111',
            color: appTab === tab.id ? tab.accent : '#555',
            cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700,
            borderRadius: idx === 0 ? '6px 0 0 6px' : idx === arr.length - 1 ? '0 6px 6px 0' : '0',
            transition: 'all 0.12s',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ── Approved tab view (from Excel "Approved" sheet) ── */}
      {appTab === 'approved' && <ApprovedSheetView creators={approvedFromFile} />}

      {/* ── Compare Results tab ── */}
      {appTab === 'compare' && (
        <CampaignResults approvedFromFile={approvedFromFile} results={results} apiKey={apiKey} config={config} />
      )}

      {appTab === 'all' && <>

      {/* UPLOAD */}
      {step === 'upload' && (
        <>
          {savedSession && (
            <div style={{ background: '#1a2a1a', border: '1px solid #2a4a2a', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ color: '#6fcf6f', fontSize: '0.85rem' }}>
                Saved session: <strong>{savedSession.parseInfo?.fileName}</strong> — {savedSession.results?.length} creators — {new Date(savedSession.savedAt).toLocaleString()}
              </span>
              <button className="btn btn-primary" style={{ padding: '4px 14px', fontSize: '0.8rem' }} onClick={restoreSession}>Restore</button>
              <button className="btn btn-secondary" style={{ padding: '4px 14px', fontSize: '0.8rem' }} onClick={clearSession}>Dismiss</button>
            </div>
          )}
          <FileUpload onFileLoaded={handleFile} />
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, color: '#666', fontSize: '0.8rem' }}>
            <span style={{ whiteSpace: 'nowrap' }}>OpenAI Key (optional — for originality scoring)</span>
            <input
              value={openaiKey}
              onChange={e => setOpenaiKey(e.target.value)}
              placeholder="sk-proj-..."
              style={{ flex: 1, maxWidth: 320 }}
            />
          </div>
        </>
      )}

      {/* CONFIG + PREVIEW */}
      {step === 'config' && parseInfo && (
        <>
          <div className="status-bar">
            <strong>File:</strong> {parseInfo.fileName} &nbsp;|&nbsp;
            <strong>Format:</strong> {parseInfo.format === 'jmg' ? 'JMG' : 'Zorka'} &nbsp;|&nbsp;
            <strong>Sheet:</strong> {parseInfo.sheetName} &nbsp;|&nbsp;
            <strong>Creators:</strong> {parseInfo.count} &nbsp;|&nbsp;
            <strong>Start row:</strong> {parseInfo.startRow}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, background: '#1e1e1e', border: '1px solid #333', borderRadius: 8, padding: '12px 16px' }}>
            <span style={{ color: '#ccc' }}>Process creators</span>
            <input
              type="number" min={1} max={creators.length}
              value={rangeStart}
              onChange={e => setRangeStart(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: 70 }}
            />
            <span style={{ color: '#888' }}>to</span>
            <input
              type="number" min={1} max={creators.length}
              value={rangeEnd}
              onChange={e => setRangeEnd(Math.min(creators.length, parseInt(e.target.value) || creators.length))}
              style={{ width: 70 }}
            />
            <span style={{ color: '#888' }}>of {creators.length} total</span>
            <span style={{ color: '#4a9eff', marginLeft: 8 }}>({Math.max(0, Math.min(creators.length, rangeEnd) - Math.max(1, rangeStart) + 1)} will be fetched)</span>
            <span style={{ color: '#888', marginLeft: 16 }}>|</span>
            <span style={{ color: '#ccc', marginLeft: 16 }}>OpenAI Key</span>
            <input
              value={openaiKey}
              onChange={e => setOpenaiKey(e.target.value)}
              placeholder="sk-proj-... (optional)"
              style={{ width: 220 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <button className="btn btn-secondary" onClick={() => { setStep('upload'); setCreators([]); }}>
              ← Back
            </button>
            <button className="btn btn-primary" onClick={runPipeline} disabled={!apiKey || !creators.length}>
              Fetch YouTube Data & Score ({Math.max(0, Math.min(creators.length, rangeEnd) - Math.max(1, rangeStart) + 1)} creators)
            </button>
          </div>

          <h2>Creators Preview</h2>
          <div style={{ overflowX: 'auto', marginBottom: 20 }}>
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Name</th><th>Category</th><th>Format</th>
                  <th>Claimed Views</th><th>Price</th><th>Zorka CPM</th>
                </tr>
              </thead>
              <tbody>
                {creators.map((c, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{c.name}</td>
                    <td>{c.category}</td>
                    <td>{c.format}</td>
                    <td className="num">{c.claimed_views.toLocaleString()}</td>
                    <td className="num">${c.price.toLocaleString()}</td>
                    <td className="num">{c.zorka_cpm.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>Configuration</h2>
          <div className="config-panel">
            <label>YouTube API Key
              <input value={apiKey} onChange={e => setApiKey(e.target.value)} />
            </label>
            <label>OpenAI Key (optional — for creative score)
              <input value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} placeholder="sk-proj-..." />
            </label>
            <label>AVG CPM (Int)
              <input type="number" step="0.01" value={config.AVG_CPM_INT}
                onChange={e => updateConfig('AVG_CPM_INT', e.target.value)} />
            </label>
            <label>AVG CPM (Ded)
              <input type="number" step="0.01" value={config.AVG_CPM_DED}
                onChange={e => updateConfig('AVG_CPM_DED', e.target.value)} />
            </label>
            <label>Green E (Int)
              <input type="number" step="0.01" value={config.GREEN_E_INT}
                onChange={e => updateConfig('GREEN_E_INT', e.target.value)} />
            </label>
            <label>Yellow E (Int)
              <input type="number" step="0.01" value={config.YELLOW_E_INT}
                onChange={e => updateConfig('YELLOW_E_INT', e.target.value)} />
            </label>
            <label>Green E (Ded)
              <input type="number" step="0.01" value={config.GREEN_E_DED}
                onChange={e => updateConfig('GREEN_E_DED', e.target.value)} />
            </label>
            <label>Yellow E (Ded)
              <input type="number" step="0.01" value={config.YELLOW_E_DED}
                onChange={e => updateConfig('YELLOW_E_DED', e.target.value)} />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-secondary" onClick={() => { setStep('upload'); setCreators([]); }}>
              ← Back
            </button>
            <button className="btn btn-primary" onClick={runPipeline} disabled={!apiKey || !creators.length}>
              Fetch YouTube Data & Score ({Math.max(0, Math.min(creators.length, rangeEnd) - Math.max(1, rangeStart) + 1)} creators)
            </button>
          </div>
        </>
      )}

      {/* FETCHING */}
      {step === 'fetching' && (
        <div className="status-bar">
          <p>
            {progress.phase === 'face'
              ? <>Detecting faces... <strong>{progress.current}/{progress.total}</strong></>
              : progress.phase === 'creative'
              ? <>Analyzing creative content (GPT-4o mini)... <strong>{progress.current}/{progress.total}</strong></>
              : <>Fetching YouTube data... <strong>{progress.current}/{progress.total}</strong></>
            }
            {progress.name && <> — {progress.name}</>}
          </p>
          <div className="progress">
            <div
              className="progress-fill"
              style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* RESULTS */}
      {step === 'results' && summary && (
        <>
          <div className="summary">
            <div className="badge green">{summary.greens.length} GREEN</div>
            <div className="badge yellow">{summary.yellows.length} YELLOW</div>
            <div className="badge red">{summary.reds.length} RED</div>
            {summary.declines.length > 0 && <div className="badge decline">{summary.declines.length} AUTO-DECLINE</div>}
            {summary.errors.length > 0 && <div className="badge error">{summary.errors.length} ERROR</div>}
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <button className="btn btn-secondary" onClick={() => { setStep('upload'); setCreators([]); setResults(null); setSummary(null); }}>
              ← New Upload
            </button>
            <button className="btn btn-secondary" onClick={() => setShowConfig(!showConfig)}>
              {showConfig ? 'Hide' : 'Adjust'} Thresholds
            </button>
          </div>

          {showConfig && (
            <div style={{ marginBottom: 20 }}>
              <div className="config-panel">
                <label>AVG CPM (Int)
                  <input type="number" step="0.01" value={config.AVG_CPM_INT}
                    onChange={e => updateConfig('AVG_CPM_INT', e.target.value)} />
                </label>
                <label>AVG CPM (Ded)
                  <input type="number" step="0.01" value={config.AVG_CPM_DED}
                    onChange={e => updateConfig('AVG_CPM_DED', e.target.value)} />
                </label>
                <label>Green E (Int)
                  <input type="number" step="0.01" value={config.GREEN_E_INT}
                    onChange={e => updateConfig('GREEN_E_INT', e.target.value)} />
                </label>
                <label>Yellow E (Int)
                  <input type="number" step="0.01" value={config.YELLOW_E_INT}
                    onChange={e => updateConfig('YELLOW_E_INT', e.target.value)} />
                </label>
                <label>Green E (Ded)
                  <input type="number" step="0.01" value={config.GREEN_E_DED}
                    onChange={e => updateConfig('GREEN_E_DED', e.target.value)} />
                </label>
                <label>Yellow E (Ded)
                  <input type="number" step="0.01" value={config.YELLOW_E_DED}
                    onChange={e => updateConfig('YELLOW_E_DED', e.target.value)} />
                </label>
              </div>
              <button className="btn btn-primary" onClick={reScore} style={{ marginTop: 8 }}>
                Re-Score with New Thresholds
              </button>
            </div>
          )}

          <ResultsView summary={summary} onFaceOverride={onFaceOverride} />
        </>
      )}

      </>}
    </div>
  );
}
