/**
 * Charisma scorer — uses video statistics we already fetch (zero extra API calls).
 * Builds a proxy score from like rate, comment rate, like/comment ratio,
 * comment consistency, and title engagement signals.
 */

function arrMean(arr) { return arr.reduce((s, v) => s + v, 0) / arr.length; }
function arrStdev(arr) {
  if (arr.length < 2) return 0;
  const m = arrMean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

/**
 * @param {Array} videos — the same video objects from getRecentVideos()
 *   each has: { views, likes, comments, title }
 */
export function analyzeCharisma(_apiKeyUnused, videos) {
  if (!videos || videos.length < 2) return null;

  const withViews = videos.filter(v => v.views > 0);
  if (withViews.length < 2) return null;

  const n = withViews.length;

  // ── Per-video rates ──
  const likeRates   = withViews.map(v => v.likes / v.views);
  const commentRates = withViews.map(v => v.comments / v.views);

  const avgLikeRate    = arrMean(likeRates);
  const avgCommentRate = arrMean(commentRates);

  // Like-to-comment ratio — lower = audience writes more, not just likes
  const likeToComment = withViews.map(v => v.comments > 0 ? v.likes / v.comments : 999);
  const avgLtc = arrMean(likeToComment.filter(v => v < 999));

  // Comment consistency — low CV = audience reliably engages
  const commentCounts = withViews.map(v => v.comments);
  const commentCv = arrMean(commentCounts) > 0
    ? arrStdev(commentCounts) / arrMean(commentCounts)
    : 2.0;

  // Title engagement — exclamation marks, caps, questions
  const titles = withViews.map(v => v.title || '');
  const titleExcitement = titles.filter(t => /!/.test(t) || /[A-Z]{3,}/.test(t)).length / n;
  const titleQuestions  = titles.filter(t => t.includes('?')).length / n;

  // ── Weighted score (0–1 before scaling) ──
  // Like rate: gaming avg ~4%, great >7%. Normalize to 0–1 at 10%.
  const likeScore    = Math.min(avgLikeRate / 0.10, 1.0);
  // Comment rate: avg ~0.2%, great >0.5%. Normalize at 1%.
  const commentScore = Math.min(avgCommentRate / 0.01, 1.0);
  // Like-to-comment: <20 = amazing discussion, >100 = passive. Invert.
  const ltcScore     = avgLtc > 0 ? Math.min(20 / Math.max(avgLtc, 1), 1.0) : 0;
  // Comment consistency: CV <0.5 = very consistent, >1.5 = random
  const consistScore = Math.max(0, 1.0 - commentCv / 1.5);

  const raw =
    likeScore    * 0.25 +
    commentScore * 0.30 +
    ltcScore     * 0.20 +
    consistScore * 0.10 +
    titleExcitement * 0.10 +
    titleQuestions  * 0.05;

  const charisma = Math.max(0, Math.min(100, Math.round(raw * 100)));

  return {
    charisma,
    like_rate_pct: Math.round(avgLikeRate * 10000) / 100,
    comment_rate_pct: Math.round(avgCommentRate * 10000) / 100,
    like_to_comment: Math.round(avgLtc * 10) / 10,
    comment_cv: Math.round(commentCv * 100) / 100,
    comment_count: n,
    label: charisma >= 68 ? 'High' : charisma >= 42 ? 'Medium' : 'Low',
  };
}
