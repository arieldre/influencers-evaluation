/**
 * Creative scoring — heuristic estimate always, GPT-4o mini when API key provided.
 *
 * Heuristic signals (all from already-fetched titles, zero extra cost):
 *   1. Template ratio       — formulaic patterns (Top N, Part N, How To, grind…)
 *   2. Vocabulary overlap   — cross-title Jaccard similarity (repetitive = low creativity)
 *   3. Title length variety — coefficient of variation across title lengths
 *   4. Clickbait intensity  — ALL CAPS density, !! patterns, stock curiosity-gap phrases
 *   5. Named entity diversity — unique proper nouns / title count (diverse game/topic coverage)
 *   6. Sentiment variety    — mix of positive + negative emotional words (monotone = low range)
 *
 * Research basis:
 *   - Clickbait markers from ResearchGate 2022 linguistic study on YouTube titles
 *   - Named entity diversity as conceptual range proxy (ScienceDirect 2024)
 *   - Sentiment variety predicts creative range (PMC 2022 science of YouTube)
 */

// ── Heuristic estimate (no API) ──

const TEMPLATES = [
  /\b(top|best|worst)\s+\d+/,
  /\bpart\s*\d+\b|#\s*\d+\b|\bep\.?\s*\d+\b|\bepisode\s*\d+\b|\bseason\s*\d+\b/,
  /\b(day|hour|week|month)\s+\d+\b|\d+\s+(day|hour|week|month)\b/,
  /\bvs\.?\s+|\bversus\b/,
  /\bhow\s+to\b|\btutorial\b|\btips?\b|\btricks?\b|\bguide\b/,
  /\b(grind|grinding|grinded?)\b/,
  /\bnew\s+(update|season|patch|meta)\b/,
  /\b(i\s+)?(tried|spent|survived|beat|won|lost|ranked)\b/,
  // clickbait stock phrases
  /you won'?t believe|gone wrong|not clickbait|wait for it|must watch|unbelievable|i quit|i'?m done/i,
  /\b(exposed|banned|deleted|shocking|insane reveal|big news)\b/i,
];

const POSITIVE_WORDS = new Set(['best','won','win','insane','perfect','amazing','legendary','epic','incredible','awesome','great','love','goat','crazy','unreal']);
const NEGATIVE_WORDS = new Set(['worst','lost','lose','failed','fail','broke','died','rage','quit','ban','banned','problem','terrible','horrible','bad','worst','disaster']);

function estimateCreativity(titles) {
  if (!titles || titles.length < 3) return null;
  const n = Math.min(titles.length, 10);
  const sample = titles.slice(0, n);
  const lower = sample.map(t => t.toLowerCase());

  // 1. Template ratio (high = formulaic)
  const templateHits = lower.filter(t => TEMPLATES.some(r => r.test(t))).length;
  const templateRatio = templateHits / n;

  // 2. Cross-title Jaccard overlap on words >3 chars (high = repetitive)
  const wordSets = lower.map(t => new Set(t.split(/\W+/).filter(w => w.length > 3)));
  let overlapSum = 0, pairs = 0;
  for (let i = 0; i < wordSets.length - 1; i++) {
    for (let j = i + 1; j < wordSets.length; j++) {
      const a = wordSets[i], b = wordSets[j];
      if (!a.size || !b.size) continue;
      const inter = [...a].filter(w => b.has(w)).length;
      const union = new Set([...a, ...b]).size;
      overlapSum += inter / union;
      pairs++;
    }
  }
  const avgOverlap = pairs > 0 ? overlapSum / pairs : 0;

  // 3. Title length CV (high = more varied = more creative)
  const lens = sample.map(t => t.length);
  const avgLen = lens.reduce((s, l) => s + l, 0) / lens.length;
  const cv = avgLen > 0
    ? Math.sqrt(lens.reduce((s, l) => s + (l - avgLen) ** 2, 0) / lens.length) / avgLen
    : 0;
  const varietyScore = Math.min(cv / 0.4, 1.0);

  // 4. Clickbait intensity — ALL CAPS word density + excess punctuation
  const capsWords = sample.flatMap(t => (t.match(/\b[A-Z]{2,}\b/g) || []));
  const totalWords = sample.flatMap(t => t.split(/\s+/).filter(Boolean));
  const capsRatio = totalWords.length > 0 ? capsWords.length / totalWords.length : 0;
  const excessPunct = sample.filter(t => /!!|!!|\?\?/.test(t) || (t.match(/!/g) || []).length >= 2).length / n;
  const clickbaitPenalty = Math.min(capsRatio * 2 + excessPunct * 0.5, 1.0);

  // 5. Named entity diversity — unique capitalized tokens (proper nouns, game names)
  //    Exclude first word of each title (always capitalized). Normalize by title count.
  const properNouns = new Set(
    sample.flatMap(t => (t.replace(/^\S+\s/, '').match(/\b[A-Z][a-z]{2,}\b/g) || []))
  );
  // Good: >1.5 unique entities/title (diverse games/topics), Poor: <0.5
  const entityScore = Math.min(properNouns.size / (n * 1.5), 1.0);

  // 6. Sentiment variety — channels using BOTH positive and negative emotional words
  //    have more tonal range than those locked in one mode
  let posCount = 0, negCount = 0;
  for (const t of lower) {
    const words = new Set(t.split(/\W+/));
    if ([...words].some(w => POSITIVE_WORDS.has(w))) posCount++;
    if ([...words].some(w => NEGATIVE_WORDS.has(w))) negCount++;
  }
  const hasBothTones = posCount > 0 && negCount > 0;
  const sentimentVariety = hasBothTones ? Math.min((posCount + negCount) / n, 1.0) : 0;

  // ── Weighted formula (sum of boosts/penalties, base 5.5) ──
  const raw =
    5.5
    - templateRatio   * 3.0   // strong penalty: formulaic titles
    - avgOverlap      * 3.5   // strong penalty: repetitive vocabulary
    - clickbaitPenalty * 1.5  // penalty: clickbait signals
    + varietyScore    * 1.0   // bonus: varied title lengths
    + entityScore     * 1.5   // bonus: diverse named entities (game/topic variety)
    + sentimentVariety * 0.5; // small bonus: tonal range

  const score = Math.max(1, Math.min(10, Math.round(raw)));

  const parts = [];
  if (templateRatio > 0.5) parts.push('formulaic titles');
  else if (templateRatio < 0.15) parts.push('varied concepts');
  if (avgOverlap > 0.15) parts.push('repetitive vocabulary');
  else if (avgOverlap < 0.04) parts.push('diverse vocabulary');
  if (clickbaitPenalty > 0.4) parts.push('clickbait patterns');
  if (entityScore > 0.6) parts.push('diverse topics');
  if (sentimentVariety > 0.4) parts.push('tonal range');

  return { score, estimated: true, reason: parts.join(', ') || 'heuristic estimate' };
}

export function estimateCreativeAll(creators) {
  for (const c of creators) {
    c.creative = estimateCreativity(c.api?._video_titles || []);
  }
  return creators;
}

// ── GPT-4o mini scoring ──

const BATCH_SIZE = 5;
const CONCURRENCY = 3;

async function scoreBatch(openaiKey, batch) {
  // batch = [{ name, titles[] }]
  const creatorsBlock = batch.map((c, i) =>
    `${i + 1}. ${c.name}\n${c.titles.slice(0, 10).join('\n')}`
  ).join('\n\n');

  const prompt = `Score each YouTube creator's originality 1-10 based on their recent video titles. Gaming/mobile context.

${creatorsBlock}

Respond ONLY with a JSON array, one entry per creator, in order:
[{"score":7,"reason":"One short sentence."},...]`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 60 * batch.length,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.status);
    console.error('[creative] API error', res.status, errText);
    return batch.map(() => null);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim() || '[]';
  console.log('[creative] raw response:', text);
  try {
    const arr = JSON.parse(text);
    return batch.map((_, i) => {
      const r = arr[i];
      if (!r) return null;
      return {
        score: Math.min(10, Math.max(1, Math.round(r.score))),
        reason: String(r.reason || '').slice(0, 200),
        estimated: false,
      };
    });
  } catch {
    return batch.map(() => null);
  }
}

export async function analyzeCreativeAll(openaiKey, creators, onProgress) {
  if (!openaiKey) return creators;

  // Build batches
  const batches = [];
  for (let i = 0; i < creators.length; i += BATCH_SIZE) {
    batches.push(creators.slice(i, i + BATCH_SIZE).map(c => ({
      name: c.name,
      titles: c.api?._video_titles || [],
      _idx: i + batches.length * 0, // placeholder
    })));
  }

  // Track results by original index
  const results = new Array(creators.length).fill(null);
  let done = 0;

  // Run batches with concurrency limit
  for (let b = 0; b < batches.length; b += CONCURRENCY) {
    const chunk = batches.slice(b, b + CONCURRENCY);
    const startIdxs = chunk.map((_, ci) => (b + ci) * BATCH_SIZE);

    await Promise.all(chunk.map(async (batch, ci) => {
      const scores = await scoreBatch(openaiKey, batch).catch(() => batch.map(() => null));
      const startIdx = startIdxs[ci];
      scores.forEach((s, si) => { results[startIdx + si] = s; });
      done += batch.length;
      if (onProgress) onProgress(Math.min(done, creators.length), creators.length, batch[batch.length - 1]?.name);
    }));
  }

  results.forEach((r, i) => { creators[i].creative = r; });
  return creators;
}
