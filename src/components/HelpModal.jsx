import React from 'react';

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
    zIndex: 1000, display: 'flex', alignItems: 'flex-start',
    justifyContent: 'center', padding: '40px 16px', overflowY: 'auto',
  },
  modal: {
    background: '#161616', border: '1px solid #2a2a2a', borderRadius: 12,
    width: '100%', maxWidth: 820, padding: '32px 36px',
    position: 'relative', boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
  },
  close: {
    position: 'absolute', top: 16, right: 20, background: 'none',
    border: 'none', color: '#888', fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1,
  },
  h1: { fontSize: '1.3rem', fontWeight: 700, color: '#eee', marginBottom: 4 },
  h2: {
    fontSize: '0.95rem', fontWeight: 700, color: '#4a9eff',
    marginTop: 28, marginBottom: 10, paddingBottom: 6,
    borderBottom: '1px solid #2a2a2a', textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  p: { color: '#aaa', fontSize: '0.85rem', lineHeight: 1.65, marginBottom: 8 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: 8 },
  th: { textAlign: 'left', color: '#666', fontWeight: 600, padding: '5px 10px', borderBottom: '1px solid #222' },
  td: { padding: '6px 10px', color: '#bbb', verticalAlign: 'top', borderBottom: '1px solid #1e1e1e' },
  tdKey: { padding: '6px 10px', color: '#e0e0e0', fontWeight: 600, verticalAlign: 'top', borderBottom: '1px solid #1e1e1e', whiteSpace: 'nowrap', width: 130 },
  badge: (bg, color) => ({
    display: 'inline-block', background: bg, color, padding: '1px 8px',
    borderRadius: 4, fontSize: '0.72rem', fontWeight: 700, marginRight: 4,
  }),
  formula: {
    background: '#0e0e0e', border: '1px solid #2a2a2a', borderRadius: 6,
    padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.8rem',
    color: '#90ee90', marginBottom: 10, lineHeight: 1.7, overflowX: 'auto',
  },
  note: {
    background: '#1a1f1a', border: '1px solid #2a3a2a', borderRadius: 6,
    padding: '8px 12px', color: '#90cc90', fontSize: '0.8rem', marginBottom: 8,
  },
};

function Row({ label, children }) {
  return (
    <tr>
      <td style={S.tdKey}>{label}</td>
      <td style={S.td}>{children}</td>
    </tr>
  );
}

export default function HelpModal({ onClose }) {
  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <button style={S.close} onClick={onClose}>✕</button>

        <div style={S.h1}>Influencer Pipeline Evaluator — Full Reference</div>
        <p style={{ ...S.p, marginTop: 6 }}>
          Everything this tool calculates, how it's scored, and how to interpret results.
        </p>

        {/* ── Pipeline ── */}
        <div style={S.h2}>How the Pipeline Works</div>
        <p style={S.p}>
          <strong style={{ color: '#eee' }}>1. Upload</strong> — Drop a Zorka Excel file. The tool auto-detects the correct sheet and start row by looking for YouTube links.
        </p>
        <p style={S.p}>
          <strong style={{ color: '#eee' }}>2. Range</strong> — Choose which creators to process (e.g. rows 1–50). Useful for batching large lists across quota limits.
        </p>
        <p style={S.p}>
          <strong style={{ color: '#eee' }}>3. YouTube Fetch</strong> — For each creator: resolves the channel ID, fetches the last 50 uploads, filters out Shorts (&lt;180s) and videos older than 90 days, then analyzes up to 10 videos. Also fetches up to 100 comments from 2 recent videos for the charisma score.
        </p>
        <p style={S.p}>
          <strong style={{ color: '#eee' }}>4. Face Detection</strong> — For each creator, loads up to 5 videos × 4 images each (custom thumbnail + 3 auto-generated video frames at 25%/50%/75%). Extracts 128-dimensional face descriptors and compares them for consistency.
        </p>
        <p style={S.p}>
          <strong style={{ color: '#eee' }}>5. Creative Score</strong> — If an OpenAI API key is provided, sends each creator's last 10 video titles to GPT-4o mini. Asks whether the content has a genuinely unique creative concept. Returns a score 1–10 and a one-sentence explanation. Optional — leave the key blank to skip.
        </p>
        <p style={S.p}>
          <strong style={{ color: '#eee' }}>6. Scoring</strong> — Computes QS and E ratio, assigns GREEN / YELLOW / RED. YELLOW creators get an auto-calculated counter-offer price.
        </p>

        {/* ── Scoring Formula ── */}
        <div style={S.h2}>Scoring Formula</div>
        <div style={S.formula}>
{`QS = audience × stability × ER × US_penalty × view_mult × face_mult

  audience  = (US×2.0 + (UK+CA+AU)×0.8 + male25+×1.0 + male18-24×0.2) × category_mult
  category  = gaming×0.90 | non-gaming×1.10 | mobile×1.30
  stability = stable/somewhat×1.0 | dead channel×0.3 | unknown×0.5
  ER        = er>5%→×1.3 | er<3%→×0.9 | else×1.0
  US penalty= US<15%→×0.6 | else×1.0
  view_mult = actual/claimed ≥1.5→×1.5 | ≥1.25→×1.25 | ≤0.5→×0.5 | ≤0.75→×0.8
  face_mult = has face (same or mixed)→×1.3 | no face→×1.0

E = zorka_cpm / (benchmark_cpm × QS)
  benchmark = $27.13 (integration) | $96.67 (dedicated)`}
        </div>
        <div style={S.note}>
          Lower E = better deal. E≤green threshold → GREEN. E≤yellow threshold → YELLOW. Otherwise RED.
        </div>

        {/* ── Decisions ── */}
        <div style={S.h2}>Decisions</div>
        <table style={S.table}>
          <tbody>
            <Row label={<span style={S.badge('#1a4d1a','#6fcf6f')}>GREEN</span>}>
              E ratio is at or below the green threshold. Good deal at asking price — approve as-is.
            </Row>
            <Row label={<span style={S.badge('#4d4d1a','#cfcf6f')}>YELLOW</span>}>
              E ratio is between green and yellow thresholds. Borderline — negotiate down to the auto-calculated offer price to bring E into green range.
            </Row>
            <Row label={<span style={S.badge('#4d1a1a','#cf6f6f')}>RED</span>}>
              E ratio exceeds yellow threshold or channel is dead. Too expensive or too low quality to justify.
            </Row>
            <Row label={<span style={S.badge('#3a1a3a','#c06fc0')}>AUTO-DECLINE</span>}>
              Category is Roblox, Minecraft, or Fortnite — automatically excluded per policy.
            </Row>
            <Row label={<span style={S.badge('#333','#aaa')}>ERROR</span>}>
              YouTube API could not resolve the channel, or no recent videos found in the last 90 days.
            </Row>
          </tbody>
        </table>

        {/* ── Columns ── */}
        <div style={S.h2}>Results Table — Column Reference</div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Column</th>
              <th style={S.th}>What it means</th>
            </tr>
          </thead>
          <tbody>
            <Row label="Name">Clickable link to the YouTube channel.</Row>
            <Row label="Decision">GREEN / YELLOW / RED / AUTO-DECLINE / ERROR — see above.</Row>
            <Row label="Cat">Category profile detected from the category string: gaming / mobile / non_gaming. Affects audience multiplier.</Row>
            <Row label="Fmt">Integration (int) or Dedicated (ded). Determines which CPM benchmark and E thresholds are used.</Row>
            <Row label="Price">Zorka's asking price in USD.</Row>
            <Row label="Offer">For YELLOW only — counter-offer price calculated to bring E exactly to the green threshold.</Row>
            <Row label="Disc">Discount % implied by the offer vs asking price.</Row>
            <Row label="Claimed">Views per video as claimed by Zorka in the Excel.</Row>
            <Row label="Actual">Real average views from the YouTube API (last 10 non-Short videos in 90 days, 1 outlier removed if &gt;5× median).</Row>
            <Row label="Z.CPM">CPM as reported by Zorka (price / claimed views × 1000).</Row>
            <Row label="Real CPM">CPM calculated from actual API views (price / actual avg × 1000).</Row>
            <Row label="QS">Quality Score — composite audience + stability + engagement multiplier. Higher = better. See formula above.</Row>
            <Row label="E">Efficiency ratio = Zorka CPM / (benchmark CPM × QS). Lower = better deal. Drives the decision.</Row>
            <Row label="Views">View label from comparing actual vs claimed: "a lot higher/lower", "a bit higher/lower", or blank (within range).</Row>
            <Row label="Ratio">Actual avg / claimed views. e.g. 0.65x means real views are 65% of what Zorka claims.</Row>
            <Row label="Stability">
              Based on coefficient of variation (CV) of view counts:<br/>
              stable (CV≤0.70) | somewhat stable (CV≤1.00) | not stable | dead channel (avg&lt;5,000 views).
            </Row>
            <Row label="Face">
              Result of ML face detection across up to 20 thumbnail/frame images:<br/>
              <strong>Same face</strong> — consistent presenter detected (×1.3 QS boost).<br/>
              <strong>Mixed</strong> — faces found but different people (×1.3 QS boost).<br/>
              <strong>No face</strong> — no human faces in thumbnails/frames (no boost).
            </Row>
            <Row label="Charisma">
              0–100 score from analyzing top 100 comments across 2 recent videos.<br/>
              Weighted: comment length (28%), excitement/caps/! (22%), specificity &gt;40 chars (20%), positive words (15%), questions (10%), emoji (5%), minus generic filler penalty (18%).<br/>
              Hover the badge for the full breakdown. Informational only — does not affect QS.
            </Row>
            <Row label="Real ER">Actual engagement rate from API: avg(likes ÷ views) across last 10 videos. Compare to Zorka's claimed ER to spot inflation.</Row>
            <Row label="Cmnt Rate">avg(comments ÷ views) — measures how much the audience is motivated to write, not just watch.</Row>
            <Row label="Upload/days">Average days between uploads. Lower = more consistent. e.g. 7d = weekly cadence.</Row>
            <Row label="Creative">
              GPT-4o mini originality score 1–10 based on the creator's last 10 video titles.<br/>
              <strong>7–10</strong> = genuinely unique concept. <strong>4–6</strong> = somewhat distinctive. <strong>1–3</strong> = generic content.<br/>
              Hover the badge to read the one-sentence reason. Only available when an OpenAI key is configured. Informational only — does not affect QS.
            </Row>
            <Row label="Comment">Auto-generated notes: stability label, category profile, view label source, sub mismatch warnings.</Row>
          </tbody>
        </table>

        {/* ── Thresholds ── */}
        <div style={S.h2}>Default Thresholds (adjustable in config)</div>
        <table style={S.table}>
          <tbody>
            <Row label="AVG CPM Int">$27.13 — market benchmark CPM for integration format.</Row>
            <Row label="AVG CPM Ded">$96.67 — market benchmark CPM for dedicated format.</Row>
            <Row label="Green E (Int)">0.55 — E must be ≤0.55 for integration to be GREEN.</Row>
            <Row label="Yellow E (Int)">0.85 — E must be ≤0.85 for integration to be YELLOW.</Row>
            <Row label="Green E (Ded)">1.45 — E must be ≤1.45 for dedicated to be GREEN.</Row>
            <Row label="Yellow E (Ded)">2.20 — E must be ≤2.20 for dedicated to be YELLOW.</Row>
          </tbody>
        </table>

        {/* ── Filters ── */}
        <div style={S.h2}>Filters & Sorting</div>
        <p style={S.p}>
          <strong style={{ color: '#eee' }}>Decision toggles</strong> — click any badge to show/hide that group. Multi-select.
        </p>
        <p style={S.p}>
          <strong style={{ color: '#eee' }}>Views filter</strong> — filter to only creators whose actual views are a lot higher / a bit higher / normal / a bit lower / a lot lower than claimed.
        </p>
        <p style={S.p}>
          <strong style={{ color: '#eee' }}>Sort</strong> — E ratio low→high (best deals first, default), E ratio high→low, QS high→low, QS low→high, Price, Name.
        </p>

        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <button
            onClick={onClose}
            style={{ background: '#1a3a5a', color: '#4a9eff', border: '1px solid #4a9eff', borderRadius: 6, padding: '8px 20px', cursor: 'pointer', fontWeight: 600 }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
