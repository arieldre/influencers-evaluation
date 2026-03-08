/**
 * Charisma scorer — uses video statistics we already fetch (zero extra API calls).
 *
 * Signals and weights:
 *   Comment rate  45% — best proxy for genuine audience connection (people who write care)
 *   Like rate     30% — resonance; how much content moves the audience to act
 *   Like/comment  15% — discussion depth (low ratio = real conversation, not passive likes)
 *   Comment CV    10% — consistency; reliable engagement vs viral-spike-only
 *
 * Title signals removed — they reward clickbait and penalize calm personal channels.
 * Face-on-camera is measured separately via ML face detection (faceDetect.js)
 * and already contributes a ×1.3 QS multiplier there.
 */

function arrMean(arr) { return arr.reduce((s, v) => s + v, 0) / arr.length; }
function arrStdev(arr) {
  if (arr.length < 2) return 0;
  const m = arrMean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

/**
 * @param {*}      _apiKeyUnused — kept for API compatibility, not used
 * @param {Array}  videos        — video objects from getRecentVideos(): { views, likes, comments }
 */
export function analyzeCharisma(_apiKeyUnused, videos) {
  if (!videos || videos.length < 2) return null;

  const withViews = videos.filter(v => v.views > 0);
  if (withViews.length < 2) return null;

  const n = withViews.length;

  // ── Per-video rates ──
  const likeRates    = withViews.map(v => v.likes / v.views);
  const commentRates = withViews.map(v => v.comments / v.views);

  const avgLikeRate    = arrMean(likeRates);
  const avgCommentRate = arrMean(commentRates);

  // Like-to-comment ratio — lower = audience writes, not just clicks like
  const likeToComment = withViews.map(v => v.comments > 0 ? v.likes / v.comments : 999);
  const validLtc = likeToComment.filter(v => v < 999);
  const avgLtc = validLtc.length > 0 ? arrMean(validLtc) : 999;

  // Comment consistency — low CV = audience reliably shows up, not just for viral videos
  const commentCounts = withViews.map(v => v.comments);
  const commentMean = arrMean(commentCounts);
  const commentCv = commentMean > 0
    ? arrStdev(commentCounts) / commentMean
    : 2.0;

  // ── Normalize each signal to 0–1 ──
  // Comment rate: avg gaming ~0.2%, great >0.5%, normalize ceiling at 1%
  const commentScore = Math.min(avgCommentRate / 0.01, 1.0);
  // Like rate: avg gaming ~4%, great >7%, normalize ceiling at 10%
  const likeScore    = Math.min(avgLikeRate / 0.10, 1.0);
  // Like-to-comment: <20 = deep discussion, >100 = passive audience. Invert.
  const ltcScore     = avgLtc < 999 ? Math.min(20 / Math.max(avgLtc, 1), 1.0) : 0;
  // Comment CV: <0.5 = very consistent, >1.5 = erratic. Invert.
  const consistScore = Math.max(0, 1.0 - commentCv / 1.5);

  // ── Weighted sum ──
  const raw =
    commentScore * 0.45 +
    likeScore    * 0.30 +
    ltcScore     * 0.15 +
    consistScore * 0.10;

  const charisma = Math.max(0, Math.min(100, Math.round(raw * 100)));

  return {
    charisma,
    like_rate_pct:    Math.round(avgLikeRate * 10000) / 100,
    comment_rate_pct: Math.round(avgCommentRate * 10000) / 100,
    like_to_comment:  Math.round(avgLtc < 999 ? avgLtc * 10 / 10 : 999),
    comment_cv:       Math.round(commentCv * 100) / 100,
    comment_count:    n,
    label: charisma >= 68 ? 'High' : charisma >= 42 ? 'Medium' : 'Low',
  };
}
