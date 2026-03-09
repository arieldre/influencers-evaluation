import React, { useState, useMemo } from 'react';
import { exportToExcel, exportToCSV } from '../utils/export.js';

const fmt = (n) => typeof n === 'number' ? n.toLocaleString() : (n || '—');
const fmtMoney = (n) => typeof n === 'number' ? `$${n.toLocaleString()}` : '—';

const DECISION_ROW_BG = {
  GREEN: '#0d1f0d',
  YELLOW: '#1f1f0d',
  RED: '#1f0d0d',
  ERROR: '#1a1a1a',
  'AUTO-DECLINE': '#1a0d1a',
};

const DECISION_BADGE = {
  GREEN:         { bg: '#1a4d1a', color: '#6fcf6f' },
  YELLOW:        { bg: '#4d4d1a', color: '#cfcf6f' },
  RED:           { bg: '#4d1a1a', color: '#cf6f6f' },
  ERROR:         { bg: '#333',    color: '#aaa'     },
  'AUTO-DECLINE':{ bg: '#3a1a3a', color: '#c06fc0' },
};

const CAT_ORDER = ['mobile', 'non_gaming', 'gaming'];
const CAT_LABEL = { mobile: '📱 Mobile', non_gaming: '🌐 Non-Gaming', gaming: '🎮 Gaming' };
const CAT_COLOR = { mobile: '#9eff6f', non_gaming: '#4a9eff', gaming: '#cf9fff' };
const CAT_BG    = { mobile: '#1a3a0d', non_gaming: '#0d1f3a', gaming: '#2a1a3a' };

const ALL_DECISIONS = ['GREEN', 'YELLOW', 'RED', 'ERROR', 'AUTO-DECLINE'];

const VIEW_FILTERS = [
  { value: 'all',                label: 'All views'    },
  { value: 'a lot higher views', label: 'A lot higher' },
  { value: 'a bit higher views', label: 'A bit higher' },
  { value: '',                   label: 'Normal'       },
  { value: 'a bit lower views',  label: 'A bit lower'  },
  { value: 'a lot lower views',  label: 'A lot lower'  },
];

const SORT_OPTIONS = [
  { value: 'e_asc',     label: 'E ratio low→high'  },
  { value: 'e_desc',    label: 'E ratio high→low'  },
  { value: 'qs_desc',   label: 'QS high→low'       },
  { value: 'qs_asc',    label: 'QS low→high'       },
  { value: 'price_desc',label: 'Price high→low'    },
  { value: 'price_asc', label: 'Price low→high'    },
  { value: 'name_asc',  label: 'Name A→Z'          },
];

function filterBtn(active, activeStyle) {
  return {
    padding: '4px 11px',
    borderRadius: 4,
    border: `1px solid ${active ? activeStyle.color : '#3a3a3a'}`,
    background: active ? activeStyle.bg : 'transparent',
    color: active ? activeStyle.color : '#555',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: 600,
    transition: 'all 0.12s',
  };
}

export default function ResultsView({ summary, onFaceOverride, forceTab }) {
  const { greens, yellows, reds, errors, declines, greenSpend, yellowOffer } = summary;

  const allRows = useMemo(
    () => [...greens, ...yellows, ...reds, ...errors, ...declines],
    [greens, yellows, reds, errors, declines]
  );

  const [activeTab, setActiveTab] = useState(forceTab || 'all');
  const [activeDecisions, setActiveDecisions] = useState(new Set(ALL_DECISIONS));
  const [viewFilter, setViewFilter] = useState('all');
  const [qsTooltip, setQsTooltip] = useState(null); // { r, rect }
  const [sortBy, setSortBy] = useState('e_asc');

  const toggleDecision = (dec) => {
    setActiveDecisions(prev => {
      const next = new Set(prev);
      next.has(dec) ? next.delete(dec) : next.add(dec);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let rows = activeTab === 'approved'
      ? allRows.filter(r => r.decision === 'GREEN')
      : allRows.filter(r => activeDecisions.has(r.decision));

    if (viewFilter !== 'all') {
      rows = rows.filter(r => (r.view_label || '') === viewFilter);
    }

    const [field, dir] = sortBy.split('_');
    const sorted = [...rows].sort((a, b) => {
      if (field === 'name') {
        const cmp = a.name.localeCompare(b.name);
        return dir === 'asc' ? cmp : -cmp;
      }
      let va, vb;
      if (field === 'e')     { va = a.e ?? 999;   vb = b.e ?? 999;   }
      if (field === 'qs')    { va = a.qs ?? 0;    vb = b.qs ?? 0;    }
      if (field === 'price') { va = a.price ?? 0; vb = b.price ?? 0; }
      return dir === 'asc' ? va - vb : vb - va;
    });

    // Group by category: mobile → non_gaming → gaming → unknown
    const groups = {};
    for (const r of sorted) {
      const cat = CAT_ORDER.includes(r.cat_profile) ? r.cat_profile : 'unknown';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(r);
    }
    return groups;
  }, [allRows, activeDecisions, viewFilter, sortBy]);

  const filteredFlat = useMemo(() => Object.values(filtered).flat(), [filtered]);
  const totalShown = filteredFlat.length;

  if (activeTab === 'approved') {
    const PRICE_BANDS = [
      { label: '$200–$2,000',   min: 200,  max: 2000  },
      { label: '$2,000–$8,500', min: 2000, max: 8500  },
      { label: '$8,500–$20,000',min: 8500, max: 20000 },
    ];

    const approvedByCat = {};
    for (const cat of [...CAT_ORDER, 'unknown']) {
      const rows = greens.filter(r => (CAT_ORDER.includes(r.cat_profile) ? r.cat_profile : 'unknown') === cat);
      if (rows.length) approvedByCat[cat] = rows;
    }

    return (
      <div>
        {Object.entries(approvedByCat).map(([cat, rows]) => {
          const color = CAT_COLOR[cat] || '#aaa';
          const bg    = CAT_BG[cat]    || '#1a1a1a';
          const label = CAT_LABEL[cat] || cat;
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
                  {rows.length} creator{rows.length !== 1 ? 's' : ''} · total {fmtMoney(catTotal)}
                </span>
              </div>

              {/* Price-band summary table */}
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
                      <td style={{ textAlign: 'right', color: b.sum ? '#6fcf6f' : '#444' }}>{b.sum ? fmtMoney(b.sum) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Creator rows */}
              <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
                <table>
                  <thead>
                    <tr>
                      {['#','Name','Cat','Fmt','Price','Offer','Disc','Claimed','Actual','Z.CPM','Real CPM','QS','E','Views','Ratio','Stability','Face','Charisma','Claimed ER','Real ER','ER Gap','Cmnt Rate','Upload/days','Content','Creative','Comment'].map(h => (
                        <th key={h} style={{ position: 'sticky', top: 0, zIndex: 2, background: '#111', boxShadow: '0 1px 0 #333' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const badge = DECISION_BADGE[r.decision];
                      return (
                        <tr key={i} style={{ background: DECISION_ROW_BG[r.decision] }}>
                          <td>{i + 1}</td>
                          <td>{r.link ? <a href={r.link} target="_blank" rel="noreferrer" style={{ color: '#4a9eff', textDecoration: 'none' }}>{r.name}</a> : r.name}</td>
                          <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                            {r.cat_profile ? <><span style={{ color: CAT_COLOR[r.cat_profile] || '#aaa', fontWeight: 700 }}>{CAT_LABEL[r.cat_profile]?.replace(/^.+ /, '') || r.cat_profile}</span>{r.category ? <span style={{ color: '#666' }}> - {r.category}</span> : ''}</> : '—'}
                          </td>
                          <td>{r.format || '—'}</td>
                          <td className="num">{fmtMoney(r.price)}</td>
                          <td className="num">{typeof r.offer === 'number' ? fmtMoney(r.offer) : '—'}</td>
                          <td>{r.discount || '—'}</td>
                          <td className="num">{fmt(r.claimed_views)}</td>
                          <td className="num">{r.actual_avg ? fmt(r.actual_avg) : '—'}</td>
                          <td className="num">{r.zorka_cpm?.toFixed(1) ?? '—'}</td>
                          <td className="num">{typeof r.real_cpm === 'number' && r.real_cpm > 0 ? r.real_cpm.toFixed(1) : '—'}</td>
                          <td className="num" style={{ cursor: r.qs_breakdown ? 'help' : 'default', position: 'relative' }}
                            onMouseEnter={r.qs_breakdown ? (e) => { const rect = e.currentTarget.getBoundingClientRect(); setQsTooltip({ r, x: rect.left, y: rect.bottom }); } : undefined}
                            onMouseLeave={() => setQsTooltip(null)}
                          >{r.qs != null && r.qs !== 0 ? <span style={{ borderBottom: r.qs_breakdown ? '1px dashed #4a9eff' : 'none' }}>{r.qs.toFixed(3)}</span> : '—'}</td>
                          <td className="num">{r.e != null && r.e !== 999 ? r.e.toFixed(3) : '—'}</td>
                          <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', color: r.view_label ? '#cfcf6f' : '#555' }}>{r.view_label || '—'}</td>
                          <td className="num">{r.view_ratio != null ? r.view_ratio.toFixed(2) + 'x' : '—'}</td>
                          <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{r.stability || '—'}</td>
                          <td>
                            {r.face?.face_override === 'yes'
                              ? <span style={{ background: '#1a4d1a', color: '#6fcf6f', padding: '2px 7px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700 }}>Same face ✓</span>
                              : r.face?.face_override === 'no'
                                ? <span style={{ color: '#555', fontSize: '0.75rem' }}>No face ✗</span>
                              : r.face?.same_face
                                ? <span title={`${r.face.face_ratio}% match`} style={{ background: '#1a4d1a', color: '#6fcf6f', padding: '2px 7px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700, cursor: 'help' }}>Same face</span>
                              : r.face?.mixed_high
                                ? <span title={`${r.face.face_ratio}% face match`} style={{ background: '#1a3a1a', color: '#90cf70', padding: '2px 7px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700, cursor: 'help' }}>Mixed (High ✓)</span>
                              : r.face?.has_face
                                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ background: '#3a2a0a', color: '#cfaa40', padding: '2px 7px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700 }}>Mixed (Low)</span>
                                    {onFaceOverride && <>
                                      <button onClick={() => onFaceOverride(r.link, 'yes')} style={{ background: '#1a4d1a', color: '#6fcf6f', border: '1px solid #2a6a2a', borderRadius: 3, padding: '1px 7px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>Yes</button>
                                      <button onClick={() => onFaceOverride(r.link, 'no')} style={{ background: '#4d1a1a', color: '#cf6f6f', border: '1px solid #6a2a2a', borderRadius: 3, padding: '1px 7px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>No</button>
                                    </>}
                                  </span>
                              : r.face?.has_face === false
                                ? <span style={{ color: '#555', fontSize: '0.75rem' }}>No face</span>
                                : <span style={{ color: '#444', fontSize: '0.75rem' }}>—</span>
                            }
                          </td>
                          <td>
                            {r.charisma ? (() => {
                              const c = r.charisma;
                              const col = c.charisma >= 68 ? '#6fcf6f' : c.charisma >= 42 ? '#cfcf6f' : '#cf6f6f';
                              const bg  = c.charisma >= 68 ? '#1a4d1a' : c.charisma >= 42 ? '#4d4d1a' : '#4d1a1a';
                              return <span title={`Like rate: ${c.like_rate_pct}% | Comment rate: ${c.comment_rate_pct}%`} style={{ background: bg, color: col, padding: '2px 7px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700, cursor: 'help' }}>{c.charisma} {c.label}</span>;
                            })() : <span style={{ color: '#444', fontSize: '0.75rem' }}>—</span>}
                          </td>
                          <td className="num" style={{ fontSize: '0.8rem' }}>{r.er ? (r.er * 100).toFixed(2) + '%' : '—'}</td>
                          <td className="num" style={{ fontSize: '0.8rem' }}>{r.real_er != null ? (r.real_er * 100).toFixed(2) + '%' : '—'}</td>
                          <td className="num" style={{ fontSize: '0.8rem' }}>
                            {r.real_er != null && r.er ? (() => {
                              const gap = ((r.real_er - r.er) * 100).toFixed(2);
                              return <span style={{ color: gap > 0 ? '#6fcf6f' : gap < 0 ? '#cf6f6f' : '#888' }}>{gap > 0 ? '+' : ''}{gap}%</span>;
                            })() : <span style={{ color: '#444' }}>—</span>}
                          </td>
                          <td className="num" style={{ fontSize: '0.8rem' }}>{r.comment_rate != null ? (r.comment_rate * 100).toFixed(2) + '%' : '—'}</td>
                          <td className="num" style={{ fontSize: '0.8rem' }}>{r.upload_freq != null ? r.upload_freq + 'd' : '—'}</td>
                          <td style={{ minWidth: 140 }}>
                            {r.content_alerts?.length > 0
                              ? r.content_alerts.map((a, i) => <span key={i} style={{ display: 'inline-block', background: a.bg, color: a.color, padding: '2px 6px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 600, marginRight: 3, marginBottom: 2 }}>{a.label}</span>)
                              : <span style={{ color: '#444', fontSize: '0.75rem' }}>—</span>}
                          </td>
                          <td style={{ minWidth: 120 }}>
                            {r.creative ? (() => {
                              const s = r.creative.score;
                              const col = s >= 7 ? '#6fcf6f' : s >= 4 ? '#cfcf6f' : '#cf6f6f';
                              const bg  = s >= 7 ? '#1a4d1a' : s >= 4 ? '#4d4d1a' : '#4d1a1a';
                              return <span title={r.creative.reason} style={{ background: bg, color: col, padding: '2px 7px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700, cursor: 'help' }}>{s}/10</span>;
                            })() : <span style={{ color: '#444', fontSize: '0.75rem' }}>—</span>}
                          </td>
                          <td style={{ fontSize: '0.78rem', color: '#999', minWidth: 160 }}>{r.auto_comment || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {/* Budget summary */}
        <div className="budget" style={{ marginTop: 20 }}>
          <div>💰 <strong>APPROVED BUDGET</strong></div>
          <div>GREEN at asking: <strong>{fmtMoney(greenSpend)}</strong></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Filter bar ── */}
      <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>

          {/* Decision toggles — hidden on Approved tab */}
          {activeTab === 'all' && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: '#666', fontSize: '0.78rem' }}>Decision:</span>
            {ALL_DECISIONS.map(dec => (
              <button
                key={dec}
                onClick={() => toggleDecision(dec)}
                style={filterBtn(activeDecisions.has(dec), DECISION_BADGE[dec])}
              >
                {dec}
              </button>
            ))}
          </div>
          )}

          {/* View label filter */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: '#666', fontSize: '0.78rem' }}>Views:</span>
            {VIEW_FILTERS.map(opt => (
              <button
                key={opt.value === '' ? 'normal' : opt.value}
                onClick={() => setViewFilter(opt.value)}
                style={filterBtn(viewFilter === opt.value, { bg: '#1a3a5a', color: '#4a9eff' })}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color: '#666', fontSize: '0.78rem' }}>Sort:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{ background: '#222', color: '#ccc', border: '1px solid #3a3a3a', borderRadius: 4, padding: '4px 8px', fontSize: '0.78rem' }}
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <span style={{ color: '#555', fontSize: '0.78rem', marginLeft: 'auto' }}>
            {totalShown} / {allRows.length} shown
          </span>

          {/* Export */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => exportToExcel(filteredFlat)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #3a3a3a', background: '#1a2a1a', color: '#6fcf6f', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
              Export All .xlsx
            </button>
            <button onClick={() => exportToExcel(filteredFlat)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #3a3a3a', background: '#1a2a1a', color: '#6fcf6f', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
              Filtered .xlsx
            </button>
            <button onClick={() => exportToCSV(filteredFlat)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #3a3a3a', background: '#1a1a2a', color: '#9090cf', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
              Filtered .csv
            </button>
          </div>
        </div>
      </div>

      {/* ── Main table ── */}
      {/* QS tooltip portal */}
      {qsTooltip && (() => {
        const b = qsTooltip;
        const r = b.r;
        const bd = r.qs_breakdown;
        if (!bd) return null;
        return (
          <div
            onMouseLeave={() => setQsTooltip(null)}
            style={{
              position: 'fixed', left: b.x, top: b.y + 6, zIndex: 9999,
              background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: 6,
              padding: '10px 14px', fontSize: '0.75rem', color: '#ccc',
              boxShadow: '0 4px 20px rgba(0,0,0,0.6)', minWidth: 280, pointerEvents: 'auto',
            }}
          >
            <div style={{ color: '#888', marginBottom: 6, fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.05em' }}>QS BREAKDOWN</div>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <tbody>
                <tr><td style={{ color: '#666', paddingRight: 10 }}>Audience</td><td style={{ color: '#fff', textAlign: 'right' }}>{bd.aud.toFixed(3)}</td><td style={{ color: '#555', paddingLeft: 8, fontSize: '0.68rem' }}>US {bd.us_pct}%×2.0 + T1 {bd.tier1_pct}%×0.8 + TA {bd.ta_pct}%×1.0 + M18-24 {bd.m1824_pct}%×0.2 + M45+ {bd.m45_pct}%×0.2 × cat {bd.aud_mult}×</td></tr>
                <tr><td style={{ color: '#666', paddingRight: 10 }}>× Stability</td><td style={{ color: bd.stab_mult < 1 ? '#cf6f6f' : '#fff', textAlign: 'right' }}>{bd.stab_mult}</td><td style={{ color: '#555', paddingLeft: 8, fontSize: '0.68rem' }}>{bd.stab_label}</td></tr>
                <tr><td style={{ color: '#666', paddingRight: 10 }}>× ER</td><td style={{ color: bd.er_mult > 1 ? '#6fcf6f' : bd.er_mult < 1 ? '#cf6f6f' : '#fff', textAlign: 'right' }}>{bd.er_mult}</td><td style={{ color: '#555', paddingLeft: 8, fontSize: '0.68rem' }}>real ER {bd.er_pct}%</td></tr>
                <tr><td style={{ color: '#666', paddingRight: 10 }}>× US penalty</td><td style={{ color: bd.us_penalty < 1 ? '#cf6f6f' : '#fff', textAlign: 'right' }}>{bd.us_penalty}</td><td style={{ color: '#555', paddingLeft: 8, fontSize: '0.68rem' }}>US {bd.us_pct}%{bd.us_penalty < 1 ? ' < 15%' : ' ≥ 15%'}</td></tr>
                <tr><td style={{ color: '#666', paddingRight: 10 }}>× View mult</td><td style={{ color: bd.view_mult !== 1 ? '#cfcf6f' : '#fff', textAlign: 'right' }}>{bd.view_mult}</td><td style={{ color: '#555', paddingLeft: 8, fontSize: '0.68rem' }}>{r.view_ratio != null ? `${r.view_ratio.toFixed(2)}x actual/claimed` : 'no data'}</td></tr>
                <tr><td style={{ color: '#666', paddingRight: 10 }}>× Face</td><td style={{ color: bd.face_mult > 1 ? '#6fcf6f' : '#fff', textAlign: 'right' }}>{bd.face_mult}</td><td style={{ color: '#555', paddingLeft: 8, fontSize: '0.68rem' }}>{bd.face_mult > 1 ? 'confirmed presenter' : 'no face boost'}</td></tr>
                <tr style={{ borderTop: '1px solid #333' }}>
                  <td style={{ color: '#4a9eff', paddingRight: 10, paddingTop: 6, fontWeight: 700 }}>= QS</td>
                  <td style={{ color: '#4a9eff', textAlign: 'right', paddingTop: 6, fontWeight: 700 }}>{r.qs?.toFixed(3)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })()}

      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>
        <table>
          <thead>
            <tr>
              {['#','Name','Decision','Cat','Fmt','Price','Offer','Disc','Claimed','Actual','Z.CPM','Real CPM','QS','E','Views','Ratio','Stability','Face','Charisma','Claimed ER','Real ER','ER Gap','Cmnt Rate','Upload/days','Content','Creative','Comment'].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(() => {
              const catKeys = [...CAT_ORDER, 'unknown'].filter(k => filtered[k]?.length > 0);
              let globalIdx = 0;
              return catKeys.map(cat => {
                const rows = filtered[cat];
                const label = CAT_LABEL[cat] || cat;
                const color = CAT_COLOR[cat] || '#aaa';
                const bg    = CAT_BG[cat]    || '#1a1a1a';
                const greensInGroup = rows.filter(r => r.decision === 'GREEN').length;
                const yellowsInGroup = rows.filter(r => r.decision === 'YELLOW').length;
                return (
                  <React.Fragment key={cat}>
                    {/* Category header row */}
                    <tr>
                      <td colSpan={27} style={{
                        background: bg,
                        borderTop: `2px solid ${color}`,
                        borderBottom: `1px solid ${color}40`,
                        padding: '7px 14px',
                        color,
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        letterSpacing: '0.04em',
                      }}>
                        {label}
                        <span style={{ marginLeft: 12, fontWeight: 400, fontSize: '0.78rem', color: `${color}aa` }}>
                          {rows.length} creator{rows.length !== 1 ? 's' : ''}
                          {greensInGroup > 0 && <span style={{ marginLeft: 8, color: '#6fcf6f' }}>{greensInGroup} GREEN</span>}
                          {yellowsInGroup > 0 && <span style={{ marginLeft: 8, color: '#cfcf6f' }}>{yellowsInGroup} YELLOW</span>}
                        </span>
                      </td>
                    </tr>
                    {rows.map((r) => {
                      const i = globalIdx++;
                      const badge = DECISION_BADGE[r.decision];
              return (
                <tr key={i} style={{ background: DECISION_ROW_BG[r.decision] }}>
                  <td>{i + 1}</td>
                  <td>
                    {r.link
                      ? <a href={r.link} target="_blank" rel="noreferrer" style={{ color: '#4a9eff', textDecoration: 'none' }}>{r.name}</a>
                      : r.name}
                  </td>
                  <td>
                    <span style={{ background: badge.bg, color: badge.color, padding: '2px 7px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {r.decision}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                    {r.cat_profile ? <><span style={{ color: CAT_COLOR[r.cat_profile] || '#aaa', fontWeight: 700 }}>{CAT_LABEL[r.cat_profile]?.replace(/^.+ /, '') || r.cat_profile}</span>{r.category ? <span style={{ color: '#666' }}> - {r.category}</span> : ''}</> : '—'}
                  </td>
                  <td>{r.format || '—'}</td>
                  <td className="num">{fmtMoney(r.price)}</td>
                  <td className="num">{typeof r.offer === 'number' ? fmtMoney(r.offer) : '—'}</td>
                  <td>{r.discount || '—'}</td>
                  <td className="num">{fmt(r.claimed_views)}</td>
                  <td className="num">{r.actual_avg ? fmt(r.actual_avg) : '—'}</td>
                  <td className="num">{r.zorka_cpm?.toFixed(1) ?? '—'}</td>
                  <td className="num">{typeof r.real_cpm === 'number' && r.real_cpm > 0 ? r.real_cpm.toFixed(1) : '—'}</td>
                  <td className="num" style={{ cursor: r.qs_breakdown ? 'help' : 'default' }}
                    onMouseEnter={r.qs_breakdown ? (e) => { const rect = e.currentTarget.getBoundingClientRect(); setQsTooltip({ r, x: rect.left, y: rect.bottom }); } : undefined}
                    onMouseLeave={() => setQsTooltip(null)}
                  >{r.qs != null && r.qs !== 0 ? <span style={{ borderBottom: r.qs_breakdown ? '1px dashed #4a9eff' : 'none' }}>{r.qs.toFixed(3)}</span> : '—'}</td>
                  <td className="num">{r.e != null && r.e !== 999 ? r.e.toFixed(3) : '—'}</td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', color: r.view_label ? '#cfcf6f' : '#555' }}>
                    {r.view_label || '—'}
                  </td>
                  <td className="num">{r.view_ratio != null ? r.view_ratio.toFixed(2) + 'x' : '—'}</td>
                  <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{r.stability || '—'}</td>
                  <td>
                    {r.face?.face_override === 'yes'
                      ? <span style={{ background: '#1a4d1a', color: '#6fcf6f', padding: '2px 7px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700 }}>Same face ✓</span>
                      : r.face?.face_override === 'no'
                        ? <span style={{ color: '#555', fontSize: '0.75rem' }}>No face ✗</span>
                      : r.face?.same_face
                        ? <span title={`${r.face.face_ratio}% match`} style={{ background: '#1a4d1a', color: '#6fcf6f', padding: '2px 7px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700, cursor: 'help' }}>Same face</span>
                      : r.face?.mixed_high
                        ? <span title={`${r.face.face_ratio}% face match — auto ×1.3 applied`} style={{ background: '#1a3a1a', color: '#90cf70', padding: '2px 7px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700, cursor: 'help' }}>Mixed (High ✓)</span>
                      : r.face?.has_face
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                            <span title={`${r.face.face_ratio ?? 0}% face match — low confidence`} style={{ background: '#3a2a0a', color: '#cfaa40', padding: '2px 7px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700, cursor: 'help' }}>Mixed (Low)</span>
                            {onFaceOverride && <>
                              <button onClick={() => onFaceOverride(r.link, 'yes')} style={{ background: '#1a4d1a', color: '#6fcf6f', border: '1px solid #2a6a2a', borderRadius: 3, padding: '1px 7px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>Yes</button>
                              <button onClick={() => onFaceOverride(r.link, 'no')} style={{ background: '#4d1a1a', color: '#cf6f6f', border: '1px solid #6a2a2a', borderRadius: 3, padding: '1px 7px', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>No</button>
                            </>}
                          </span>
                      : r.face?.has_face === false
                        ? <span style={{ color: '#555', fontSize: '0.75rem' }}>No face</span>
                        : <span style={{ color: '#444', fontSize: '0.75rem' }}>—</span>
                    }
                  </td>
                  <td>
                    {r.charisma
                      ? (() => {
                          const c = r.charisma;
                          const color = c.charisma >= 68 ? '#6fcf6f' : c.charisma >= 42 ? '#cfcf6f' : '#cf6f6f';
                          const bg   = c.charisma >= 68 ? '#1a4d1a' : c.charisma >= 42 ? '#4d4d1a' : '#4d1a1a';
                          return (
                            <span title={`Like rate: ${c.like_rate_pct}% | Comment rate: ${c.comment_rate_pct}% | Like/Comment: ${c.like_to_comment} | Comment CV: ${c.comment_cv} | ${c.comment_count} videos`}
                              style={{ background: bg, color, padding: '2px 7px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700, cursor: 'help', whiteSpace: 'nowrap' }}>
                              {c.charisma} {c.label}
                            </span>
                          );
                        })()
                      : <span style={{ color: '#444', fontSize: '0.75rem' }}>—</span>
                    }
                  </td>
                  <td className="num" style={{ fontSize: '0.8rem' }}>
                    {r.er ? (r.er * 100).toFixed(2) + '%' : '—'}
                  </td>
                  <td className="num" style={{ fontSize: '0.8rem' }}>
                    {r.real_er != null ? (r.real_er * 100).toFixed(2) + '%' : '—'}
                  </td>
                  <td className="num" style={{ fontSize: '0.8rem' }}>
                    {r.real_er != null && r.er
                      ? (() => {
                          const gap = ((r.real_er - r.er) * 100).toFixed(2);
                          const color = gap > 0 ? '#6fcf6f' : gap < 0 ? '#cf6f6f' : '#888';
                          return <span style={{ color }}>{gap > 0 ? '+' : ''}{gap}%</span>;
                        })()
                      : <span style={{ color: '#444' }}>—</span>
                    }
                  </td>
                  <td className="num" style={{ fontSize: '0.8rem' }}>
                    {r.comment_rate != null ? (r.comment_rate * 100).toFixed(2) + '%' : '—'}
                  </td>
                  <td className="num" style={{ fontSize: '0.8rem' }}>
                    {r.upload_freq != null ? r.upload_freq + 'd' : '—'}
                  </td>
                  <td style={{ minWidth: 140 }}>
                    {r.content_alerts?.length > 0
                      ? r.content_alerts.map((a, i) => (
                          <span key={i} style={{ display: 'inline-block', background: a.bg, color: a.color, padding: '2px 6px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 600, marginRight: 3, marginBottom: 2, whiteSpace: 'nowrap' }}>
                            {a.label}
                          </span>
                        ))
                      : <span style={{ color: '#444', fontSize: '0.75rem' }}>—</span>
                    }
                  </td>
                  <td style={{ minWidth: 120 }}>
                    {r.creative
                      ? (() => {
                          const s = r.creative.score;
                          const color = s >= 7 ? '#6fcf6f' : s >= 4 ? '#cfcf6f' : '#cf6f6f';
                          const bg   = s >= 7 ? '#1a4d1a' : s >= 4 ? '#4d4d1a' : '#4d1a1a';
                          return (
                            <span title={r.creative.reason}
                              style={{ background: bg, color, padding: '2px 7px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700, cursor: 'help', whiteSpace: 'nowrap' }}>
                              {s}/10
                            </span>
                          );
                        })()
                      : <span style={{ color: '#444', fontSize: '0.75rem' }}>—</span>
                    }
                  </td>
                  <td style={{ fontSize: '0.78rem', color: '#999', minWidth: 160 }}>{r.auto_comment || '—'}</td>
                </tr>
              );
            })}
                  </React.Fragment>
                );
              });
            })()}
            {totalShown === 0 && (
              <tr>
                <td colSpan={27} style={{ textAlign: 'center', color: '#555', padding: '24px' }}>
                  No results match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Budget summary ── */}
      <div className="budget" style={{ marginTop: 20 }}>
        <div>💰 <strong>BUDGET SUMMARY</strong></div>
        <div>GREEN at asking: <strong>{fmtMoney(greenSpend)}</strong></div>
        <div>YELLOW at offer: <strong>{fmtMoney(yellowOffer)}</strong></div>
        <div>Combined: <strong>{fmtMoney(greenSpend + yellowOffer)}</strong></div>
      </div>
    </div>
  );
}
