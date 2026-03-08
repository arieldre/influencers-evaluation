/**
 * Creative content scoring via OpenAI GPT-4o mini.
 * Sends each creator's last 10 video titles → originality score 1-10 + one sentence.
 */

export async function analyzeCreative(openaiKey, creatorName, videoTitles) {
  if (!openaiKey || !videoTitles?.length) return null;

  const titles = videoTitles.slice(0, 10).join('\n');
  const prompt = `You are evaluating YouTube creators for an influencer marketing campaign.

Creator: ${creatorName}
Recent video titles:
${titles}

Do these titles suggest a creator with a genuinely unique creative concept, special format, or distinctive style that stands out from typical gaming/tech content? Score originality 1–10 and give ONE short sentence explaining why.

Respond in this exact JSON format (no markdown, no extra text):
{"score": 7, "reason": "Uses a unique mockumentary format that makes game reviews feel cinematic."}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 120,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `OpenAI ${res.status}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '';
    const parsed = JSON.parse(text);
    return {
      score: Math.min(10, Math.max(1, Math.round(parsed.score))),
      reason: String(parsed.reason || '').slice(0, 200),
    };
  } catch (err) {
    // Silently fail — creative is optional
    return null;
  }
}

export async function analyzeCreativeAll(openaiKey, creators, onProgress) {
  if (!openaiKey) return creators;

  for (let i = 0; i < creators.length; i++) {
    const c = creators[i];
    // video_ids are stored in c.api, titles are in c.api._titles (we'll pass titles via c.api)
    const titles = c.api?._video_titles || [];
    c.creative = await analyzeCreative(openaiKey, c.name, titles);
    if (onProgress) onProgress(i + 1, creators.length, c.name);
  }

  return creators;
}
