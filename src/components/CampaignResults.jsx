import React, { useState, useMemo, useRef } from 'react';
import { parseCampaignCSV, buildCoverage, normalizeName } from '../utils/campaignResultsParser';
import { runCorrelations, categoryBreakdown, generateInsights, strengthLabel } from '../utils/correlationAnalysis';
import { detectCategoryProfile, scoreCreators, DEFAULTS } from '../utils/scorer';
import { analyzeAll } from '../utils/youtube';
import { detectFacesForAll } from '../utils/faceDetect';

const CAT_LABEL = { mobile: '📱 Mobile', non_gaming: '🌐 Non-Gaming', gaming: '🎮 Gaming' };
const CAT_COLOR = { mobile: '#9eff6f', non_gaming: '#4a9eff', gaming: '#cf9fff' };
const CAT_BG    = { mobile: '#1a3a0d', non_gaming: '#0d1f3a', gaming: '#2a1a3a' };

const STRENGTH_STYLE = {
  Strong:   { bg: '#1b3a1b', color: '#a5d6a7' },
  Moderate: { bg: '#3a3000', color: '#fff176' },
  Weak:     { bg: '#3a1a00', color: '#ffcc80' },
  None:     { bg: '#2a2a2a', color: '#888'    },
};

const DECISION_BG = {
  GREEN: '#0d1f0d', YELLOW: '#1f1f0d', RED: '#1f0d0d',
  ERROR: '#1a1a1a', 'AUTO-DECLINE': '#1a0d1a',
};

const fmtM  = n => n !== null && n !== undefined ? `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—';
const fmtN  = n => n !== null && n !== undefined ? Math.round(n).toLocaleString() : '—';
const rSign = r => r === null ? '—' : `${r >= 0 ? '+' : ''}${r.toFixed(2)}`;
const rColor = r => r === null ? '#555' : Math.abs(r) < 0.1 ? '#888' : r > 0 ? '#6fcf6f' : '#ef9a9a';

export default function CampaignResults({ approvedFromFile, results, apiKey, config }) {
  const [csvRows, setCsvRows]             = useState(null);
  const [dragging, setDragging]           = useState(false);
  const [error, setError]                 = useState(null);
  const [showNotInCampaign, setShowNotInCampaign] = useState(false);
  const [showUnrecognized, setShowUnrecognized]   = useState(false);
  const [extraResults, setExtraResults]   = useState([]);
  const [analyzing, setAnalyzing]         = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState({ phase: '', current: 0, total: 0, name: '' });
  const fileRef   = useRef();
  const tableRef  = useRef();
  const scrollRef = useRef();

  function syncScroll(from, to) {
    if (to.current) to.current.scrollLeft = from.current.scrollLeft;
  }

  async function runAnalysisOnCreators(creators) {
    setAnalyzing(true);
    try {
      const prepared = creators.map(c => ({ ...c, api: c.api || {} }));
      const updated = await analyzeAll(apiKey, prepared, (i, total, name) => {
        setAnalyzeProgress({ phase: 'youtube', current: i, total, name });
      });
      const withFaces = await detectFacesForAll(updated, (i, total, name) => {
        setAnalyzeProgress({ phase: 'face', current: i, total, name });
      });
      const scored = scoreCreators(withFaces, config || DEFAULTS);
      setExtraResults(prev => {
        // merge: replace existing by name, append new
        const map = new Map(prev.map(r => [normalizeName(r.name), r]));
        for (const r of scored) map.set(normalizeName(r.name), r);
        return [...map.values()];
      });
    } catch (err) {
      console.error('[compare] analysis error', err);
    }
    setAnalyzing(false);
  }

  const mergedResults = useMemo(
    () => [...(results || []), ...extraResults],
    [results, extraResults]
  );

  const coverage = useMemo(
    () => csvRows ? buildCoverage(approvedFromFile, mergedResults, csvRows) : null,
    [csvRows, approvedFromFile, mergedResults]
  );

  const correlations = useMemo(
    () => coverage?.correlationRows?.length ? runCorrelations(coverage.correlationRows) : null,
    [coverage]
  );
  const catStats = useMemo(
    () => coverage?.matched?.length ? categoryBreakdown(coverage.matched) : null,
    [coverage]
  );
  const insights = useMemo(
    () => correlations ? generateInsights(correlations, coverage?.correlationRows?.length ?? 0) : [],
    [correlations, coverage]
  );

  function handleFile(file) {
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const rows = parseCampaignCSV(e.target.result);
        if (rows.length === 0) { setError('CSV parsed but all rows were empty or had no channel name.'); return; }
        setCsvRows(rows);
      } catch (err) {
        setError(`Error parsing CSV: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }

  function reset() {
    setCsvRows(null);
    setError(null);
    setShowNotInCampaign(false);
    setShowUnrecognized(false);
  }

  // ── Guard ──
  if (!approvedFromFile || approvedFromFile.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#555', padding: '60px 0', fontSize: '0.9rem' }}>
        Upload an Excel file containing an <strong style={{ color: '#888' }}>Approved</strong> sheet first —<br />
        this tab compares your approved influencers against real campaign data.
      </div>
    );
  }

  // ── Upload state ──
  if (!coverage) {
    return (
      <div>
        <div style={{ color: '#666', fontSize: '0.82rem', marginBottom: 20 }}>
          <span style={{ color: '#888' }}>{approvedFromFile.length}</span> approved creators loaded
          {results?.length ? <> · <span style={{ color: '#888' }}>{results.length}</span> pipeline results available</> : <> · <span style={{ color: '#555' }}>no pipeline results (basic metrics only)</span></>}
        </div>

        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? '#4a9eff' : '#3a3a3a'}`,
            borderRadius: 12,
            padding: '56px 32px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragging ? '#0d1220' : '#111',
            transition: 'all 0.15s',
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📊</div>
          <div style={{ color: '#ccc', fontSize: '1rem', fontWeight: 600, marginBottom: 6 }}>
            Drop campaign results CSV here
          </div>
          <div style={{ color: '#555', fontSize: '0.8rem' }}>
            or click to browse · AppsFlyer / MMP export format
          </div>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])} />
        </div>

        {error && (
          <div style={{ color: '#ef9a9a', fontSize: '0.85rem', background: '#1f0d0d', border: '1px solid #4a1a1a', borderRadius: 6, padding: '10px 14px' }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  // ── Results state ──
  const n = coverage.correlationRows.length;

  return (
    <div>
      {/* File header bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '12px 16px' }}>
        <span style={{ color: '#6fcf6f', fontSize: '0.85rem' }}>
          ✓ {csvRows.length} CSV rows loaded · {coverage.matched.length} of {approvedFromFile.length} approved matched
        </span>
        <button onClick={reset} style={{ marginLeft: 'auto', background: 'none', border: '1px solid #3a3a3a', color: '#888', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontSize: '0.75rem' }}>
          Upload different file
        </button>
      </div>

      {/* ── Coverage summary cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <div style={{ background: '#0d1f0d', border: '1px solid #2a4a2a', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ color: '#6fcf6f', fontWeight: 700, fontSize: '1.5rem' }}>{coverage.matched.length}</div>
          <div style={{ color: '#aaa', fontSize: '0.78rem', marginTop: 4 }}>Approved creators in campaign</div>
        </div>
        <div style={{ background: '#1f1f0d', border: '1px solid #4a4a2a', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ color: '#cfcf6f', fontWeight: 700, fontSize: '1.5rem' }}>{coverage.notInCampaign.length}</div>
          <div style={{ color: '#aaa', fontSize: '0.78rem', marginTop: 4 }}>Approved · no campaign data yet</div>
        </div>
        <div style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ color: '#888', fontWeight: 700, fontSize: '1.5rem' }}>{coverage.unrecognized.length}</div>
          <div style={{ color: '#aaa', fontSize: '0.78rem', marginTop: 4 }}>CSV rows not matched to approved</div>
        </div>
      </div>

      {/* Not in campaign — simple list only */}
      {coverage.notInCampaign.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => setShowNotInCampaign(v => !v)}
            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}>
            {showNotInCampaign ? '▼' : '▶'} {coverage.notInCampaign.length} approved creators with no campaign data
          </button>
          {showNotInCampaign && (
            <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 6, padding: '10px 14px', marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {coverage.notInCampaign.map((c, i) => (
                <span key={i} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 4, padding: '2px 8px', color: '#666', fontSize: '0.75rem' }}>{c.name}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Unrecognized (collapsible) */}
      {coverage.unrecognized.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => setShowUnrecognized(v => !v)}
            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}>
            {showUnrecognized ? '▼' : '▶'} {coverage.unrecognized.length} CSV entries not matched to any approved creator
          </button>
          {showUnrecognized && (
            <div style={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 6, padding: '10px 14px', marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {coverage.unrecognized.map((name, i) => (
                <span key={i} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: 4, padding: '2px 8px', color: '#777', fontSize: '0.75rem' }}>
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {coverage.matched.length === 0 && (
        <div style={{ color: '#ef9a9a', padding: '32px 0', textAlign: 'center', fontSize: '0.9rem' }}>
          No approved creators matched the CSV data.<br />
          <span style={{ color: '#555', fontSize: '0.8rem' }}>Check that channel names align between the Approved sheet and the campaign report.</span>
        </div>
      )}

      {coverage.matched.length > 0 && (
        <>
          {/* ── Analyze matched creators missing scores ── */}
          {(() => {
            const needScores = coverage.matched.filter(m => m.qs == null);
            if (needScores.length === 0) return null;
            return (
              <div style={{ marginBottom: 20, background: '#0d1a2a', border: '1px solid #1a3a5a', borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ color: '#4a9eff', fontSize: '0.85rem', fontWeight: 600 }}>
                    {needScores.length} campaign creator{needScores.length !== 1 ? 's' : ''} missing QS / charisma scores
                  </span>
                  {!analyzing && (
                    <button onClick={() => runAnalysisOnCreators(needScores)}
                      style={{ background: '#0d1f3a', border: '1px solid #2a5a8a', color: '#4a9eff', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                      Run YouTube + Face analysis →
                    </button>
                  )}
                  {extraResults.length > 0 && (
                    <span style={{ color: '#6fcf6f', fontSize: '0.8rem' }}>✓ {extraResults.length} scored</span>
                  )}
                </div>
                {analyzing && (
                  <div style={{ marginTop: 10, color: '#aaa', fontSize: '0.8rem' }}>
                    {analyzeProgress.phase === 'face' ? 'Detecting faces' : 'Fetching YouTube data'}…{' '}
                    <strong>{analyzeProgress.current}/{analyzeProgress.total}</strong>
                    {analyzeProgress.name && <> — {analyzeProgress.name}</>}
                    <div style={{ height: 4, background: '#333', borderRadius: 2, marginTop: 6 }}>
                      <div style={{ height: 4, background: '#4a9eff', borderRadius: 2, width: `${analyzeProgress.total ? (analyzeProgress.current / analyzeProgress.total) * 100 : 0}%`, transition: 'width 0.2s' }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Matched Influencers Table ── */}
          <h3 style={{ color: '#ccc', fontWeight: 600, fontSize: '0.9rem', marginBottom: 12, marginTop: 4 }}>
            Matched Influencers — Predicted vs Actual
          </h3>
          {/* Sticky top scrollbar */}
          <div ref={scrollRef} onScroll={() => syncScroll(scrollRef, tableRef)}
            style={{ overflowX: 'scroll', overflowY: 'hidden', height: 12, position: 'sticky', top: 0, zIndex: 4, background: '#111', marginBottom: 2 }}>
            <div style={{ height: 1, width: tableRef.current?.scrollWidth ?? 2000 }} />
          </div>
          <div ref={tableRef} onScroll={() => syncScroll(tableRef, scrollRef)}
            style={{ overflowX: 'auto', marginBottom: 32 }}>
            <table style={{ width: 'auto', minWidth: '100%' }}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th title="Quality Score from pipeline">QS</th>
                  <th title="Efficiency ratio — lower is better">E</th>
                  <th title="Charisma score 0–100">Charisma</th>
                  <th title="Originality score 1–10 (requires OpenAI key)">Originality</th>
                  <th title="US audience %">US%</th>
                  <th>Price</th>
                  <th>Cost Spent</th>
                  <th title="Effective cost per install">eCPI</th>
                  <th title="Return on ad spend — 7 days">ROAS 7d</th>
                  <th title="Return on ad spend — lifetime">ROAS LTV</th>
                  <th>Installs</th>
                </tr>
              </thead>
              <tbody>
                {coverage.matched
                  .slice()
                  .sort((a, b) => (b.roas7d ?? -Infinity) - (a.roas7d ?? -Infinity))
                  .map((m, i) => {
                    const catKey = m.cat_profile || detectCategoryProfile(m.category || '');
                    const catColor = CAT_COLOR[catKey] || '#aaa';
                    const eBg = m.e != null && m.e < 900
                      ? (m.e <= 0.55 ? '#6fcf6f' : m.e <= 0.85 ? '#cfcf6f' : '#ef9a9a')
                      : '#555';
                    const roas7Color = m.roas7d != null
                      ? (m.roas7d >= 1 ? '#6fcf6f' : m.roas7d >= 0.5 ? '#cfcf6f' : '#ef9a9a')
                      : '#555';
                    return (
                      <tr key={i} style={{ background: m.decision ? DECISION_BG[m.decision] : '#111' }}>
                        <td>{i + 1}</td>
                        <td>
                          {m.link
                            ? <a href={m.link} target="_blank" rel="noreferrer" style={{ color: '#4a9eff', textDecoration: 'none' }}>{m.name}</a>
                            : m.name}
                          {m._rowCount > 1 && <span style={{ color: '#555', fontSize: '0.7rem', marginLeft: 4 }}>×{m._rowCount}</span>}
                        </td>
                        <td style={{ color: catColor, fontSize: '0.78rem' }}>{CAT_LABEL[catKey] || catKey}</td>
                        <td className="num">{m.qs != null ? m.qs.toFixed(3) : '—'}</td>
                        <td className="num" style={{ color: eBg }}>
                          {m.e != null && m.e < 900 ? m.e.toFixed(3) : '—'}
                        </td>
                        <td className="num">{m.charisma?.charisma != null ? m.charisma.charisma : '—'}</td>
                        <td className="num">{m.creative?.score != null ? `${m.creative.score}/10` : '—'}</td>
                        <td className="num">{m.qs_breakdown?.us_pct != null ? `${m.qs_breakdown.us_pct}%` : '—'}</td>
                        <td className="num">{fmtM(m.price)}</td>
                        <td className="num">{fmtM(m.cost)}</td>
                        <td className="num">{m.ecpi != null ? `$${m.ecpi.toFixed(2)}` : '—'}</td>
                        <td className="num" style={{ color: roas7Color, fontWeight: 600 }}>
                          {m.roas7d != null ? m.roas7d.toFixed(2) : '—'}
                        </td>
                        <td className="num" style={{ color: m.roasLtv != null ? (m.roasLtv >= 1 ? '#6fcf6f' : '#ef9a9a') : '#555' }}>
                          {m.roasLtv != null ? m.roasLtv.toFixed(2) : '—'}
                        </td>
                        <td className="num">{fmtN(m.installs)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* ── Correlation Analysis ── */}
          {correlations && correlations.length > 0 && (
            <>
              <h3 style={{ color: '#ccc', fontWeight: 600, fontSize: '0.9rem', marginBottom: 8 }}>
                Predictor Correlation with Campaign Outcomes
              </h3>
              {n < 10 && (
                <div style={{ background: '#1f1f0d', border: '1px solid #4a4a2a', borderRadius: 6, padding: '8px 14px', marginBottom: 12, fontSize: '0.8rem', color: '#cfcf6f' }}>
                  ⚠ Small sample (n={n}) — correlations are directional indicators only, not statistically reliable.
                </div>
              )}
              <div style={{ overflowX: 'auto', marginBottom: 32 }}>
                <table style={{ width: 'auto', minWidth: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Predictor</th>
                      <th title="Number of data points">n</th>
                      <th title="Pearson r with ROAS 7d — positive = predictor correlates with higher ROAS">r · ROAS 7d</th>
                      <th title="Spearman rank correlation with ROAS 7d">ρ · ROAS 7d</th>
                      <th title="r with eCPI (inverted: positive = lower eCPI = more efficient)">r · eCPI↓</th>
                      <th title="Pearson r with total installs">r · Installs</th>
                      <th>Strength</th>
                    </tr>
                  </thead>
                  <tbody>
                    {correlations.map(pred => {
                      const r7 = pred.outcomes.roas7d;
                      const rE = pred.outcomes.ecpi;
                      const rI = pred.outcomes.installs;
                      const str = r7.strength;
                      const ss  = STRENGTH_STYLE[str];
                      return (
                        <tr key={pred.key}>
                          <td style={{ color: '#ccc', fontWeight: 500 }}>{pred.label}</td>
                          <td className="num" style={{ color: '#666' }}>{r7.n || rE.n || 0}</td>
                          <td className="num" style={{ color: rColor(r7.pearson), fontWeight: 600 }}>{rSign(r7.pearson)}</td>
                          <td className="num" style={{ color: rColor(r7.spearman) }}>{rSign(r7.spearman)}</td>
                          <td className="num" style={{ color: rColor(rE.pearson) }}>{rSign(rE.pearson)}</td>
                          <td className="num" style={{ color: rColor(rI.pearson) }}>{rSign(rI.pearson)}</td>
                          <td>
                            <span style={{ ...ss, padding: '2px 8px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600 }}>
                              {str}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── Category Breakdown ── */}
          {catStats && catStats.length > 0 && (
            <>
              <h3 style={{ color: '#ccc', fontWeight: 600, fontSize: '0.9rem', marginBottom: 12 }}>
                Performance by Category
              </h3>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
                {catStats.map(s => {
                  const color = CAT_COLOR[s.cat] || '#aaa';
                  const bg    = CAT_BG[s.cat]    || '#1a1a1a';
                  return (
                    <div key={s.cat} style={{ background: bg, border: `1px solid ${color}40`, borderTop: `2px solid ${color}`, borderRadius: 8, padding: '14px 18px', minWidth: 190 }}>
                      <div style={{ color, fontWeight: 700, fontSize: '0.85rem', marginBottom: 10 }}>
                        {CAT_LABEL[s.cat] || s.cat}
                        <span style={{ color: `${color}80`, fontWeight: 400, marginLeft: 6, fontSize: '0.75rem' }}>
                          {s.count} creator{s.count !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '4px 20px', fontSize: '0.78rem' }}>
                        <span style={{ color: '#666' }}>Avg ROAS 7d</span>
                        <span style={{ textAlign: 'right', color: s.avgRoas7d != null ? (s.avgRoas7d >= 1 ? '#6fcf6f' : '#ef9a9a') : '#444' }}>
                          {s.avgRoas7d != null ? s.avgRoas7d.toFixed(2) : '—'}
                        </span>
                        <span style={{ color: '#666' }}>Avg ROAS LTV</span>
                        <span style={{ textAlign: 'right', color: s.avgRoasLtv != null ? (s.avgRoasLtv >= 1 ? '#6fcf6f' : '#ef9a9a') : '#444' }}>
                          {s.avgRoasLtv != null ? s.avgRoasLtv.toFixed(2) : '—'}
                        </span>
                        <span style={{ color: '#666' }}>Avg eCPI</span>
                        <span style={{ textAlign: 'right', color: '#ccc' }}>
                          {s.avgEcpi != null ? `$${s.avgEcpi.toFixed(2)}` : '—'}
                        </span>
                        <span style={{ color: '#666' }}>Total Installs</span>
                        <span style={{ textAlign: 'right', color: '#ccc' }}>
                          {s.totalInstalls != null ? Math.round(s.totalInstalls).toLocaleString() : '—'}
                        </span>
                        <span style={{ color: '#666' }}>Total Cost</span>
                        <span style={{ textAlign: 'right', color: '#ccc' }}>{fmtM(s.totalCost)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Insight Cards ── */}
          {insights.length > 0 && (
            <>
              <h3 style={{ color: '#ccc', fontWeight: 600, fontSize: '0.9rem', marginBottom: 12 }}>
                Key Takeaways
              </h3>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
                {insights.map((text, i) => (
                  <div key={i} style={{
                    background: '#0d1220',
                    border: '1px solid #1a2a4a',
                    borderLeft: '3px solid #4a9eff',
                    borderRadius: 8,
                    padding: '14px 16px',
                    flex: '1 1 240px',
                    maxWidth: 360,
                    fontSize: '0.85rem',
                    color: '#ccc',
                    lineHeight: 1.55,
                  }}>
                    {text}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
