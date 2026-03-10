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
          A full automated evaluation pipeline: upload your Excel file, fetch live YouTube data, run ML face detection, score every creator, and export decisions — all in the browser.
        </p>

        {/* ── Pipeline ── */}
        <div style={S.h2}>How the Pipeline Works</div>
        <p style={S.p}>
          <strong style={{ color: '#eee' }}>1. Upload</strong> — Drop a <strong>Zorka</strong> or <strong>JMG</strong> Excel file. The tool auto-detects the format, finds the correct sheet, and maps each row to a creator (YouTube link, name, claimed views, price, demographics, format type).
        </p>
        <p style={S.p}>
          <strong style={{ color: '#eee' }}>2. Range</strong> — Choose which rows to process (e.g. rows 1–50). Useful for splitting large lists into batches when working near the YouTube API quota limit (10,000 units/day).
        </p>
        <p style={S.p}>
          <strong style={{ color: '#eee' }}>3. YouTube Fetch</strong> — For each creator the tool: resolves their Channel ID from the URL, fetches the channel's subscriber count, then fetches the last 50 uploads filtered to only the past 90 days and excluding Shorts (&lt;180s). From those, it picks the 10 most-viewed videos and computes: average views, engagement rate (likes÷views), comment rate (comments÷views), upload frequency, stability (coefficient of variation), view trend, and content signals (sponsored detection, live streams, collabs). All video data is cached to avoid re-fetching on re-score.
        </p>
        <p style={S.p}>
          <strong style={{ color: '#eee' }}>4. Face Detection (ML)</strong> — For each creator, up to 5 recent videos are sampled. For each video, 4 images are loaded: the custom thumbnail + 3 auto-generated frames at 25%, 50%, and 75% of video duration. Each image is run through a TinyFaceDetector neural network (face-api.js, runs fully in-browser) to extract a 128-dimensional face descriptor vector. Descriptors are compared to detect whether the <em>same person</em> consistently appears on camera. This is the strongest signal for personal charisma — creators who show their face get a ×1.3 QS boost. No API calls required — the ML models load once from the <code>/models/</code> folder.
        </p>
        <p style={S.p}>
          <strong style={{ color: '#eee' }}>5. Charisma Score</strong> — Computed from the video stats already fetched in step 3 (zero extra API calls). Measures how actively the audience engages, not just passively watches. See the Charisma column reference below.
        </p>
        <p style={S.p}>
          <strong style={{ color: '#eee' }}>6. Creative Score</strong> — A heuristic originality score (1–10) is <em>always</em> computed from the last 10 video titles fetched in step 3 — no extra API calls needed. It analyses 6 signals: formulaic template usage, cross-title vocabulary repetition, title length variety, clickbait intensity (ALL CAPS / !! patterns), named entity diversity (how many different games/topics appear), and sentiment variety (mix of positive + negative emotional language). The result is shown as <strong>"X/10 est."</strong> If you enter an OpenAI API key, GPT-4o mini re-scores each creator with semantic understanding and the "est." label is removed. Informational only — does not affect QS or decisions.
        </p>
        <p style={S.p}>
          <strong style={{ color: '#eee' }}>7. Scoring</strong> — Each creator gets a Quality Score (QS) and an Efficiency ratio (E). E drives the decision: GREEN (good deal), YELLOW (negotiate), RED (too expensive / low quality). YELLOW creators get an auto-calculated counter-offer price to bring E into GREEN range.
        </p>

        {/* ── Scoring Formula ── */}
        <div style={S.h2}>Quality Score (QS) Formula</div>
        <div style={S.formula}>
{`QS = audience × stability × ER_mult × US_penalty × view_mult × face_mult

  audience   = (US%×2.0 + (UK+CA+AU)%×0.8 + male25+%×1.0 + male18-24%×0.2) × category_mult

  category_mult:
    mobile game keywords → ×1.30  (highest-value audience)
    gaming keywords      → ×0.90  (lower CPM niche)
    everything else      → ×1.10

  stability_mult:
    stable (CV ≤ 0.70)         → ×1.0
    somewhat stable (CV ≤ 1.0) → ×1.0
    not stable                 → ×1.0  (already reflected in ER)
    dead channel (avg < 5,000) → ×0.3
    unknown (no data)          → ×0.5

  ER_mult (real engagement rate from API):
    ER > 5%  → ×1.3  (highly engaged audience)
    ER < 3%  → ×0.9  (below-average engagement)
    else     → ×1.0

  US_penalty:
    US audience < 15% → ×0.6  (poor geographic fit)
    else              → ×1.0

  view_mult (actual avg ÷ claimed views):
    ≥ 1.50× → ×1.50  (underpriced — real views beat the claim)
    ≥ 1.25× → ×1.25
    ≤ 0.50× → ×0.50  (major inflation — real views far below claim)
    ≤ 0.75× → ×0.80
    else    → ×1.0

  face_mult (ML detection across up to 20 thumbnail/frame images):
    Same face or Mixed → ×1.3  (personal presence detected)
    No face             → ×1.0`}
        </div>
        <div style={S.formula}>
{`E = zorka_cpm / (benchmark_cpm × QS)

  zorka_cpm   = asking_price / claimed_views × 1000
  benchmark   = $27.13 (integration) | $96.67 (dedicated)

  Lower E = better deal.
  E ≤ green_threshold  → GREEN  (approve at asking price)
  E ≤ yellow_threshold → YELLOW (negotiate — auto offer calculated)
  E > yellow_threshold → RED    (too expensive)

  offer_price = benchmark_cpm × QS × green_threshold / 1000 × claimed_views`}
        </div>
        <div style={S.note}>
          The offer price is what you'd need to pay to hit exactly E = green threshold. It's the max you should spend to call this creator a good deal.
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
              ML face detection result. For each creator, up to 5 videos are sampled and 4 images per video are loaded (custom thumbnail + auto frames at 25%/50%/75%). Each image is processed by a TinyFaceDetector neural network (runs in-browser, no API calls). A 128-dim descriptor vector is extracted and compared across images.<br/><br/>
              <strong>Same face</strong> — the same person consistently appears. Strong personal brand signal. <strong>Applies ×1.3 QS multiplier.</strong><br/>
              <strong>Mixed</strong> — faces found across thumbnails but they differ (team channel, or no fixed host). Still shows human presence. <strong>Applies ×1.3 QS multiplier.</strong><br/>
              <strong>No face</strong> — no human faces detected. Gameplay-only, animated, or stock footage channels. No boost.<br/><br/>
              For JMG format, the face flag is pre-filled from the spreadsheet and marked "Yes (JMG)" instead of running ML.
            </Row>
            <Row label="Charisma">
              0–100 score computed from video engagement statistics already fetched in the YouTube step (zero extra API calls). Measures how actively the audience participates, not just how many people watch. Calibrated to real gaming/mobile YouTube benchmarks (Social Status / Marketing Charts 2024).<br/><br/>
              <strong>Weights &amp; benchmarks:</strong><br/>
              • <strong>Comment rate</strong> (comments÷views) — <strong>45%</strong>. Strongest signal per academic research (PMC 2022). Gaming avg: 0.078%. Score ceiling at 0.3% (exceptional). People who comment genuinely care.<br/>
              • <strong>Like rate</strong> (likes÷views) — <strong>30%</strong>. Gaming avg: 5.47%. Ceiling at 10%. Measures resonance — how much content moves the audience to react.<br/>
              • <strong>Like-to-comment ratio</strong> — <strong>15%</strong>. Gaming avg is ~70:1. Below 40:1 = genuinely conversational audience. Above 150:1 = passive (likes but never writes). Linear scale between those points.<br/>
              • <strong>Comment consistency</strong> (CV) — <strong>10%</strong>. Low variance = audience reliably shows up, not just for viral spikes.<br/><br/>
              <strong>High ≥ 68 | Medium ≥ 42 | Low &lt; 42</strong><br/>
              Hover the badge to see like rate %, comment rate %, like/comment ratio, and comment CV. Informational only — does not affect QS.
            </Row>
            <Row label="Real ER">Actual engagement rate from API: avg(likes ÷ views) across last 10 videos. Compare to Zorka's claimed ER to spot inflation.</Row>
            <Row label="Cmnt Rate">avg(comments ÷ views) — measures how much the audience is motivated to write, not just watch.</Row>
            <Row label="Upload/days">Average days between uploads. Lower = more consistent. e.g. 7d = weekly cadence.</Row>
            <Row label="Creative">
              Originality score 1–10 based on the creator's last 10 video titles. Always computed as a heuristic estimate ("X/10 est.") — no API key needed. If an OpenAI key is provided, GPT-4o mini re-scores with semantic understanding and the "est." label is removed.<br/><br/>
              <strong>Heuristic signals (6 total):</strong><br/>
              • <strong>Template ratio</strong> (penalty) — titles matching formulaic patterns: "Top N", "Part N", "vs", "How To", "grind", "gone wrong", "exposed", etc.<br/>
              • <strong>Vocabulary overlap</strong> (penalty) — cross-title Jaccard similarity. Channels recycling the same words across titles score lower.<br/>
              • <strong>Clickbait intensity</strong> (penalty) — density of ALL CAPS words and excess punctuation (!!). Based on ResearchGate 2022 linguistic study on YouTube clickbait.<br/>
              • <strong>Title length variety</strong> (bonus) — coefficient of variation across title lengths. Varied structure = more creative range.<br/>
              • <strong>Named entity diversity</strong> (bonus) — unique proper nouns (game names, characters, places) across titles. Covering many different topics = more creative breadth. Based on ScienceDirect 2024 research.<br/>
              • <strong>Sentiment variety</strong> (bonus) — using both positive ("epic", "legendary") and negative ("failed", "rage") emotional language. Monotone tone = lower creative range.<br/><br/>
              <strong>7–10</strong> = varied, original, diverse topics.<br/>
              <strong>4–6</strong> = some originality, mixed signals.<br/>
              <strong>1–3</strong> = formulaic, repetitive, or clickbait-heavy.<br/><br/>
              Hover the badge to see the reason. Informational only — does not affect QS or decisions.
            </Row>
            <Row label="Comment">Auto-generated notes: stability label, category profile, view label source, sub mismatch warnings.</Row>
          </tbody>
        </table>

        {/* ── Thresholds ── */}
        <div style={S.h2}>Default Thresholds (adjustable in config)</div>
        <table style={S.table}>
          <tbody>
            <Row label="AVG CPM Int">$27.13 — market benchmark CPM for integration format. Derived from historical campaign data.</Row>
            <Row label="AVG CPM Ded">$96.67 — market benchmark CPM for dedicated format. ~3.6× higher than integration, reflecting the full-video premium.</Row>
            <Row label="Green E (Int)">0.55 — E must be ≤0.55 for integration to be GREEN. Below this, the creator is priced well relative to their audience quality.</Row>
            <Row label="Yellow E (Int)">0.85 — E must be ≤0.85 for integration to be YELLOW. Between 0.55–0.85 = negotiate to the offer price.</Row>
            <Row label="Green E (Ded)">0.55 — same threshold as integration. Dedicated channels are evaluated against the dedicated CPM benchmark.</Row>
            <Row label="Yellow E (Ded)">0.85 — same threshold as integration for dedicated format.</Row>
          </tbody>
        </table>
        <div style={S.note}>
          All thresholds can be edited live in the Config panel before running, or inline in the results table after running. Changes to thresholds re-score immediately without re-fetching YouTube data.
        </div>

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
