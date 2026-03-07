/**
 * YouTube Data API v3 — matches Colab pipeline exactly.
 * 90-day cutoff, skip Shorts (< 180s), outlier removal, sub mismatch.
 */
import { analyzeCharisma } from './charisma.js';

const TARGET_VIDEOS = 10;
const MAX_AGE_DAYS = 90;
const DEAD_CHANNEL_THR = 5_000;
const CV_STABLE = 0.70;
const CV_SOMEWHAT = 1.00;

function getCutoff() {
  const d = new Date();
  d.setDate(d.getDate() - MAX_AGE_DAYS);
  return d;
}

// ── Resolve channel ID from URL ──

export function extractHandle(url) {
  if (!url) return null;
  const s = String(url).split('/videos')[0].split('\n')[0].trim();

  let m = s.match(/\/channel\/(UC[\w-]+)/);
  if (m) return { type: 'id', value: m[1] };

  for (const pat of [
    /youtube\.com\/@([\w.-]+)/i,
    /youtube\.com\/c\/([\w.-]+)/i,
    /youtube\.com\/user\/([\w.-]+)/i,
  ]) {
    m = s.match(pat);
    if (m) return { type: 'handle', value: m[1].split('/')[0] };
  }
  return null;
}

async function apiGet(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (res.status === 403) throw new Error('QUOTA_EXHAUSTED');
  return res.json();
}

async function resolveChannelId(apiKey, link) {
  const info = extractHandle(link);
  if (!info) return { id: null, method: 'no handle' };
  if (info.type === 'id') return { id: info.value, method: 'direct' };

  const handle = info.value;

  // Try forHandle
  try {
    const data = await apiGet(
      `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${handle}&key=${apiKey}`
    );
    if (data.items?.length) return { id: data.items[0].id, method: 'handle' };
  } catch (e) { if (e.message === 'QUOTA_EXHAUSTED') throw e; }

  // Try forUsername
  try {
    const data = await apiGet(
      `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${handle}&key=${apiKey}`
    );
    if (data.items?.length) return { id: data.items[0].id, method: 'username' };
  } catch (e) { if (e.message === 'QUOTA_EXHAUSTED') throw e; }

  // Search fallback
  try {
    const data = await apiGet(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(handle + ' youtube')}&type=channel&maxResults=1&key=${apiKey}`
    );
    if (data.items?.length) return { id: data.items[0].snippet.channelId, method: 'SEARCH' };
  } catch (e) { if (e.message === 'QUOTA_EXHAUSTED') throw e; }

  return { id: null, method: 'failed' };
}

// ── Channel info ──

async function getChannelInfo(apiKey, channelId) {
  const data = await apiGet(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&id=${channelId}&key=${apiKey}`
  );
  if (!data.items?.length) return null;
  const it = data.items[0];
  return {
    name: it.snippet.title,
    subs: parseInt(it.statistics.subscriberCount || '0', 10),
    playlist: it.contentDetails.relatedPlaylists.uploads,
  };
}

// ── Recent videos ──

function parseDuration(iso) {
  const m = String(iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || '0') * 3600) + (parseInt(m[2] || '0') * 60) + parseInt(m[3] || '0');
}

async function getRecentVideos(apiKey, playlistId) {
  const data = await apiGet(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${playlistId}&maxResults=50&key=${apiKey}`
  );
  const ids = (data.items || []).map(i => i.contentDetails.videoId);
  if (!ids.length) return [];

  const vids = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const vData = await apiGet(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${batch.join(',')}&key=${apiKey}`
    );
    for (const it of (vData.items || [])) {
      const dur = parseDuration(it.contentDetails?.duration);
      const pub = new Date(it.snippet.publishedAt);
      vids.push({
        id: it.id,
        views: parseInt(it.statistics.viewCount || '0', 10),
        pub,
        is_short: dur > 0 && dur < 180,
      });
    }
  }
  return vids;
}

// ── Analyze views (matches Colab exactly) ──

function arrMedian(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function arrMean(arr) {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function arrStdev(arr) {
  const m = arrMean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

function analyzeViews(allVids, claimedViews) {
  const cutoff = getCutoff();
  const valid = allVids
    .filter(v => !v.is_short && v.pub >= cutoff)
    .slice(0, TARGET_VIDEOS);

  if (!valid.length) {
    return {
      stability: 'no data', cv: null, avg: 0, median: 0,
      video_count: 0, view_label: '', ratio: null,
      video_ids: [],
      api_notes: 'no recent videos',
    };
  }

  const viewsList = valid.map(v => v.views);
  const videoIds = valid.map(v => v.id).filter(Boolean);
  const avg = Math.round(arrMean(viewsList));
  const med = arrMedian(viewsList);

  if (avg < DEAD_CHANNEL_THR) {
    return {
      stability: 'dead channel', cv: 0, avg, median: med,
      video_count: viewsList.length, view_label: '', ratio: null,
      video_ids: videoIds,
      api_notes: `dead channel — avg ${avg.toLocaleString()} views`,
    };
  }

  // Outlier removal (same as Colab: remove 1 extreme if >5x median)
  let cleaned = [...viewsList];
  if (cleaned.length > 4) {
    const medVal = arrMedian(cleaned);
    const extremes = cleaned.filter(v => medVal > 0 && v > medVal * 5);
    if (extremes.length === 1) {
      cleaned.splice(cleaned.indexOf(extremes[0]), 1);
    }
  }

  const cv = cleaned.length >= 2
    ? Math.round((arrStdev(cleaned) / arrMean(cleaned)) * 1000) / 1000
    : 0;

  let stab;
  if (cv <= CV_STABLE) stab = 'stable';
  else if (cv <= CV_SOMEWHAT) stab = 'somewhat stable';
  else stab = 'not stable';

  let ratio = null, viewLabel = '';
  let apiNotes = `${viewsList.length} videos, avg ${avg.toLocaleString()}, CV=${cv}`;

  if (claimedViews > 0 && avg > 0) {
    ratio = Math.round((avg / claimedViews) * 1000) / 1000;
    if (ratio >= 1.50) viewLabel = 'a lot higher views';
    else if (ratio >= 1.25) viewLabel = 'a bit higher views';
    else if (ratio <= 0.50) viewLabel = 'a lot lower views';
    else if (ratio <= 0.75) viewLabel = 'a bit lower views';
    apiNotes += ` | ${ratio.toFixed(2)}x claimed`;
  }

  return {
    stability: stab, cv, avg, median: med,
    video_count: viewsList.length, view_label: viewLabel,
    ratio, video_ids: videoIds, api_notes: apiNotes,
  };
}

// ── Public API ──

export async function analyzeCreator(apiKey, creator) {
  const link = creator.link;
  try {
    const { id: channelId, method } = await resolveChannelId(apiKey, link);
    if (!channelId) return { error: `resolve failed (${method})`, method };

    const info = await getChannelInfo(apiKey, channelId);
    if (!info) return { error: 'no channel info', method };

    // Sub mismatch check (same as Colab)
    let sub_warn = '';
    if (creator.followers > 0 && info.subs > 0) {
      const r = info.subs / creator.followers;
      if (r < 0.5 || r > 2.0) {
        sub_warn = `SUBS MISMATCH Zorka=${creator.followers.toLocaleString()} API=${info.subs.toLocaleString()}`;
      }
    }

    const allVids = await getRecentVideos(apiKey, info.playlist);
    const metrics = analyzeViews(allVids, creator.claimed_views);
    const charisma = await analyzeCharisma(apiKey, metrics.video_ids || []);

    return {
      ...metrics,
      yt_name: info.name,
      yt_subs: info.subs,
      method,
      sub_warn,
      charisma,
      error: '',
    };
  } catch (err) {
    if (err.message === 'QUOTA_EXHAUSTED') throw err;
    return { error: err.message || 'Unknown error' };
  }
}

export async function analyzeAll(apiKey, creators, onProgress) {
  const cache = {};
  let quotaDead = false;

  for (let i = 0; i < creators.length; i++) {
    const c = creators[i];

    if (quotaDead) {
      c.api = { error: 'quota exhausted' };
      if (onProgress) onProgress(i + 1, creators.length, c.name, c.api);
      continue;
    }

    if (cache[c.link]) {
      const api = { ...cache[c.link] };
      if (api.avg > 0 && c.claimed_views > 0) {
        const ratio = api.avg / c.claimed_views;
        api.ratio = Math.round(ratio * 1000) / 1000;
        if (ratio >= 1.50) api.view_label = 'a lot higher views';
        else if (ratio >= 1.25) api.view_label = 'a bit higher views';
        else if (ratio <= 0.50) api.view_label = 'a lot lower views';
        else if (ratio <= 0.75) api.view_label = 'a bit lower views';
        else api.view_label = '';
      }
      c.api = api;
      if (onProgress) onProgress(i + 1, creators.length, c.name, c.api);
      continue;
    }

    try {
      c.api = await analyzeCreator(apiKey, c);
      cache[c.link] = c.api;
      if (onProgress) onProgress(i + 1, creators.length, c.name, c.api);
      if (i < creators.length - 1) await new Promise(r => setTimeout(r, 150));
    } catch (err) {
      if (err.message === 'QUOTA_EXHAUSTED') {
        quotaDead = true;
        c.api = { error: 'quota exhausted' };
      } else {
        c.api = { error: err.message };
      }
      if (onProgress) onProgress(i + 1, creators.length, c.name, c.api);
    }
  }

  return creators;
}
