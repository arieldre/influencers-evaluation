import React, { useState, useRef, useCallback } from 'react';
import FileUpload from './components/FileUpload';
import ResultsView from './components/ResultsView';
import { parseExcel } from './utils/parseExcel';
import { analyzeAll } from './utils/youtube';
import { scoreCreators, summarizeResults, DEFAULTS } from './utils/scorer';

const DEFAULT_API_KEY = 'AIzaSyAhUmhy4INV8O7m7Q2sVSqoy0a3TXh5MH0';

export default function App() {
  const [step, setStep] = useState('upload'); // upload | config | fetching | results
  const [creators, setCreators] = useState([]);
  const [parseInfo, setParseInfo] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, name: '' });
  const [results, setResults] = useState(null);
  const [summary, setSummary] = useState(null);
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY);
  const [config, setConfig] = useState({ ...DEFAULTS });
  const [showConfig, setShowConfig] = useState(false);
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(100);

  // ── Upload ──
  const handleFile = useCallback((arrayBuffer, fileName) => {
    try {
      const { creators: parsed, sheetName, startRow } = parseExcel(arrayBuffer);
      setCreators(parsed);
      setParseInfo({ sheetName, startRow, fileName, count: parsed.length });
      setRangeStart(1);
      setRangeEnd(parsed.length);
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
    setProgress({ current: 0, total: subset.length, name: '' });

    try {
      const updated = await analyzeAll(apiKey, [...subset], (i, total, name) => {
        setProgress({ current: i, total, name });
      });

      setCreators(updated);
      const scored = scoreCreators(updated, config);
      const summ = summarizeResults(scored);
      setResults(scored);
      setSummary(summ);
      setStep('results');
    } catch (err) {
      alert(`Error: ${err.message}`);
      setStep('config');
    }
  }, [creators, apiKey, config, rangeStart, rangeEnd]);

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

  return (
    <div className="app">
      <h1>Influencer Pipeline Evaluator</h1>
      <p style={{ color: '#888', marginBottom: 24 }}>
        Upload Zorka Excel → Fetch YT data → Auto-score → Review decisions
      </p>

      {/* UPLOAD */}
      {step === 'upload' && <FileUpload onFileLoaded={handleFile} />}

      {/* CONFIG + PREVIEW */}
      {step === 'config' && parseInfo && (
        <>
          <div className="status-bar">
            <strong>File:</strong> {parseInfo.fileName} &nbsp;|&nbsp;
            <strong>Sheet:</strong> {parseInfo.sheetName} &nbsp;|&nbsp;
            <strong>Creators:</strong> {parseInfo.count} &nbsp;|&nbsp;
            <strong>Start row:</strong> {parseInfo.startRow}
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
            <label>API Key
              <input value={apiKey} onChange={e => setApiKey(e.target.value)} />
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

          <h2>Creator Range</h2>
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
            Fetching YouTube data... <strong>{progress.current}/{progress.total}</strong>
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

          <ResultsView summary={summary} />
        </>
      )}
    </div>
  );
}
