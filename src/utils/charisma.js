/**
 * Charisma scorer — analyzes YouTube comments to measure audience excitement.
 * Fetches top 100 comments from the 2 most recent videos.
 */

const VIDEOS_TO_SAMPLE = 2;
const COMMENTS_PER_VIDEO = 100;

const GENERIC_PHRASES = [
  'great video', 'nice video', 'good video', 'great content', 'nice content',
  'love your content', 'love your videos', 'keep it up', 'keep up the good work',
  'subscribed', 'subbed', 'new sub', 'just subscribed', 'first comment',
  'early', 'who else', 'anyone else', 'same lol', 'lol same',
];

const POSITIVE_WORDS = [
  'amazing', 'incredible', 'awesome', 'fantastic', 'brilliant', 'excellent',
  'love', 'loved', 'obsessed', 'insane', 'crazy', 'wild', 'mindblowing',
  'best', 'goat', 'legend', 'legendary', 'underrated', 'masterpiece',
  'speechless', 'unreal', 'perfect', 'fire', 'banger', 'absolute',
];

async function fetchComments(apiKey, videoId) {
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=${COMMENTS_PER_VIDEO}&order=relevance&key=${apiKey}`,
      { signal: AbortSignal.timeout(15000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map(item => ({
      text: (item.snippet.topLevelComment.snippet.textDisplay || '').replace(/<[^>]+>/g, '').trim(),
      likes: item.snippet.topLevelComment.snippet.likeCount || 0,
    }));
  } catch {
    return [];
  }
}

function scoreComments(comments) {
  // Filter out empty or spam-like very short comments
  const texts = comments.map(c => c.text).filter(t => t.length > 3);
  if (texts.length < 5) return null;

  const n = texts.length;

  // Avg character length — longer = more engaged, not just "nice"
  const avgLength = texts.reduce((s, t) => s + t.length, 0) / n;

  // Excited: contains ! or has 3+ consecutive uppercase letters
  const excitedRatio = texts.filter(t => /!/.test(t) || /[A-Z]{3,}/.test(t)).length / n;

  // Emoji usage
  const emojiRatio = texts.filter(t => /\p{Emoji_Presentation}/u.test(t)).length / n;

  // Specific: comment is long enough to be about something real (not "nice vid!")
  const specificRatio = texts.filter(t => t.length > 40).length / n;

  // Positive emotional words
  const positiveRatio = texts.filter(t => {
    const lower = t.toLowerCase();
    return POSITIVE_WORDS.some(w => lower.includes(w));
  }).length / n;

  // Questions = audience actively engaged / curious
  const questionRatio = texts.filter(t => t.includes('?')).length / n;

  // Generic penalty — bot-like or filler comments
  const genericRatio = texts.filter(t => {
    const lower = t.toLowerCase();
    return GENERIC_PHRASES.some(g => lower.includes(g));
  }).length / n;

  // Weighted score (0–1 range before scaling to 0–100)
  const raw =
    Math.min(avgLength / 70, 1.0) * 0.28 +   // length (70 chars = ideal)
    excitedRatio                * 0.22 +       // excitement
    specificRatio               * 0.20 +       // specificity
    positiveRatio               * 0.15 +       // positive words
    questionRatio               * 0.10 +       // engagement questions
    emojiRatio                  * 0.05 -       // emoji (minor)
    genericRatio                * 0.18;        // generic penalty

  const charisma = Math.max(0, Math.min(100, Math.round(raw * 100)));

  return {
    charisma,
    avg_length: Math.round(avgLength),
    excited_pct: Math.round(excitedRatio * 100),
    emoji_pct: Math.round(emojiRatio * 100),
    specific_pct: Math.round(specificRatio * 100),
    positive_pct: Math.round(positiveRatio * 100),
    question_pct: Math.round(questionRatio * 100),
    generic_pct: Math.round(genericRatio * 100),
    comment_count: n,
    label: charisma >= 68 ? 'High' : charisma >= 42 ? 'Medium' : 'Low',
  };
}

export async function analyzeCharisma(apiKey, videoIds) {
  if (!videoIds || videoIds.length === 0) return null;

  const targetIds = videoIds.slice(0, VIDEOS_TO_SAMPLE);
  const allComments = [];

  for (const id of targetIds) {
    const comments = await fetchComments(apiKey, id);
    allComments.push(...comments);
  }

  return scoreComments(allComments);
}
