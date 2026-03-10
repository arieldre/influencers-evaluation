/**
 * Creative scoring via GPT-4o mini.
 * Batches 5 creators per API call, 3 batches in parallel — ~80% fewer calls vs sequential.
 */

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
