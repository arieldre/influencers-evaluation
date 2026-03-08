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

export default function ResultsView({ summary }) {
  const { greens, yellows, reds, errors, declines, greenSpend, yellowOffer } = summary;

  const allRows = useMemo(
    () => [...greens, ...yellows, ...reds, ...errors, ...declines],
    [greens, yellows, reds, errors, declines]
  );

  const [activeDecisions, setActiveDecisions] = useState(new Set(ALL_DECISIONS));
  const [viewFilter, setViewFilter] = useState('all');
  const [sortBy, setSortBy] = useState('e_asc');

  const toggleDecision = (dec) => {
    setActiveDecisions(prev => {
      const next = new Set(prev);
      next.has(dec) ? next.delete(dec) : next.add(dec);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let rows = allRows.filter(r => activeDecisions.has(r.decision));

    if (viewFilter !== 'all') {
      rows = rows.filter(r => (r.view_label || '') === viewFilter);
    }

    const [field, dir] = sortBy.split('_');
    return [...rows].sort((a, b) => {
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
  }, [allRows, activeDecisions, viewFilter, sortBy]);

  return (
    <div>
      {/* ── Filter bar ── */}
      <div style={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>

          {/* Decision toggles */}
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
            {filtered.length} / {allRows.length} shown
          </span>

          {/* Export */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => exportToExcel(allRows)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #3a3a3a', background: '#1a2a1a', color: '#6fcf6f', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
              Export All .xlsx
            </button>
            <button onClick={() => exportToExcel(filtered)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #3a3a3a', background: '#1a2a1a', color: '#6fcf6f', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
              Filtered .xlsx
            </button>
            <button onClick={() => exportToCSV(filtered)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #3a3a3a', background: '#1a1a2a', color: '#9090cf', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
              Filtered .csv
            </button>
          </div>
        </div>
      </div>

      {/* ── Main table ── */}
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Decision</th>
              <th>Cat</th>
              <th>Fmt</th>
              <th>Price</th>
              <th>Offer</th>
              <th>Disc</th>
              <th>Claimed</th>
              <th>Actual</th>
              <th>Z.CPM</th>
              <th>Real CPM</th>
              <th>QS</th>
              <th>E</th>
              <th>Views</th>
              <th>Ratio</th>
              <th>Stability</th>
              <th>Face</th>
              <th>Charisma</th>
              <th>Real ER</th>
              <th>Cmnt Rate</th>
              <th>Upload/days</th>
              <th>Comment</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
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
                  <td>{r.cat_profile || '—'}</td>
                  <td>{r.format || '—'}</td>
                  <td className="num">{fmtMoney(r.price)}</td>
                  <td className="num">{typeof r.offer === 'number' ? fmtMoney(r.offer) : '—'}</td>
                  <td>{r.discount || '—'}</td>
                  <td className="num">{fmt(r.claimed_views)}</td>
                  <td className="num">{r.actual_avg ? fmt(r.actual_avg) : '—'}</td>
                  <td className="num">{r.zorka_cpm?.toFixed(1) ?? '—'}</td>
                  <td className="num">{typeof r.real_cpm === 'number' && r.real_cpm > 0 ? r.real_cpm.toFixed(1) : '—'}</td>
                  <td className="num">{r.qs != null && r.qs !== 0 ? r.qs.toFixed(3) : '—'}</td>
                  <td className="num">{r.e != null && r.e !== 999 ? r.e.toFixed(3) : '—'}</td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', color: r.view_label ? '#cfcf6f' : '#555' }}>
                    {r.view_label || '—'}
                  </td>
                  <td className="num">{r.view_ratio != null ? r.view_ratio.toFixed(2) + 'x' : '—'}</td>
                  <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{r.stability || '—'}</td>
                  <td>
                    {r.face?.has_face === false
                      ? <span style={{ color: '#555', fontSize: '0.75rem' }}>No face</span>
                      : r.face?.same_face
                        ? <span style={{ background: '#1a4d1a', color: '#6fcf6f', padding: '2px 7px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700 }}>Same face</span>
                        : r.face?.has_face
                          ? <span style={{ background: '#4d4d1a', color: '#cfcf6f', padding: '2px 7px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700 }}>Mixed</span>
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
                            <span title={`Avg length: ${c.avg_length}ch | Excited: ${c.excited_pct}% | Positive: ${c.positive_pct}% | Generic: ${c.generic_pct}% | ${c.comment_count} comments`}
                              style={{ background: bg, color, padding: '2px 7px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 700, cursor: 'help', whiteSpace: 'nowrap' }}>
                              {c.charisma} {c.label}
                            </span>
                          );
                        })()
                      : <span style={{ color: '#444', fontSize: '0.75rem' }}>—</span>
                    }
                  </td>
                  <td className="num" style={{ fontSize: '0.8rem' }}>
                    {r.real_er != null ? (r.real_er * 100).toFixed(2) + '%' : '—'}
                  </td>
                  <td className="num" style={{ fontSize: '0.8rem' }}>
                    {r.comment_rate != null ? (r.comment_rate * 100).toFixed(2) + '%' : '—'}
                  </td>
                  <td className="num" style={{ fontSize: '0.8rem' }}>
                    {r.upload_freq != null ? r.upload_freq + 'd' : '—'}
                  </td>
                  <td style={{ fontSize: '0.78rem', color: '#999', minWidth: 160 }}>{r.auto_comment || '—'}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={23} style={{ textAlign: 'center', color: '#555', padding: '24px' }}>
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
