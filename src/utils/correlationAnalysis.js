export function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? null : Math.max(-1, Math.min(1, num / denom));
}

function rankArray(arr) {
  const indexed = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const ranks = new Array(arr.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length && indexed[j][0] === indexed[i][0]) j++;
    const avgRank = (i + j - 1) / 2 + 1;
    for (let k = i; k < j; k++) ranks[indexed[k][1]] = avgRank;
    i = j;
  }
  return ranks;
}

export function spearman(xs, ys) {
  return pearson(rankArray(xs), rankArray(ys));
}

export function strengthLabel(r) {
  if (r === null) return 'None';
  const abs = Math.abs(r);
  if (abs >= 0.5) return 'Strong';
  if (abs >= 0.3) return 'Moderate';
  if (abs >= 0.1) return 'Weak';
  return 'None';
}

const PREDICTORS = [
  { key: 'qs',          label: 'QS Score',       extract: r => r.qs ?? null },
  { key: 'e_ratio',     label: 'E Ratio',         extract: r => (r.e != null && r.e < 900) ? -r.e : null }, // inverted: higher = better deal
  { key: 'charisma',    label: 'Charisma Score',  extract: r => r.charisma?.charisma ?? null },
  { key: 'us_pct',      label: 'US Audience %',   extract: r => r.qs_breakdown?.us_pct ?? null },
  { key: 'er_pct',      label: 'Engagement Rate', extract: r => r.qs_breakdown?.er_pct ?? null },
  { key: 'face',        label: 'Face Confirmed',  extract: r => r.face ? (r.face.same_face || r.face.mixed_high ? 1 : 0) : null },
  { key: 'stab_mult',   label: 'Stability',       extract: r => r.qs_breakdown?.stab_mult ?? null },
  { key: 'price',       label: 'Price ($)',        extract: r => r.price ?? null },
  { key: 'mobile_flag', label: 'Mobile Category', extract: r => r.cat_profile != null ? (r.cat_profile === 'mobile' ? 1 : 0) : null },
  { key: 'gaming_flag',  label: 'Gaming Category',    extract: r => r.cat_profile != null ? (r.cat_profile === 'gaming' ? 1 : 0) : null },
  { key: 'originality', label: 'Originality Score',   extract: r => r.creative?.score ?? null },
];

const OUTCOMES = [
  { key: 'roas7d',   invert: false },
  { key: 'roasLtv',  invert: false },
  { key: 'ecpi',     invert: true  }, // lower eCPI is better → invert so positive r = better
  { key: 'installs', invert: false },
];

export function runCorrelations(correlationRows) {
  return PREDICTORS
    .map(pred => {
      const outcomeResults = {};

      for (const outcome of OUTCOMES) {
        const xs = [], ys = [];
        for (const row of correlationRows) {
          const x = pred.extract(row);
          const rawY = row[outcome.key];
          const y = rawY !== null && rawY !== undefined ? (outcome.invert ? -rawY : rawY) : null;
          if (x !== null && y !== null && isFinite(x) && isFinite(y)) {
            xs.push(x); ys.push(y);
          }
        }
        const n = xs.length;
        const p = pearson(xs, ys);
        const s = n >= 2 ? spearman(xs, ys) : null;
        outcomeResults[outcome.key] = { n, pearson: p, spearman: s, strength: strengthLabel(p) };
      }

      return { key: pred.key, label: pred.label, outcomes: outcomeResults };
    })
    .sort((a, b) => Math.abs(b.outcomes.roas7d?.pearson ?? 0) - Math.abs(a.outcomes.roas7d?.pearson ?? 0));
}

export function categoryBreakdown(matched) {
  const groups = { mobile: [], gaming: [], non_gaming: [] };
  for (const m of matched) {
    const cat = m.cat_profile;
    if (cat && groups[cat]) groups[cat].push(m);
  }

  const avgOrNull = (arr, key) => {
    const valid = arr.filter(r => r[key] !== null && r[key] !== undefined);
    return valid.length ? valid.reduce((s, r) => s + r[key], 0) / valid.length : null;
  };
  const sumOrNull = (arr, key) => {
    const valid = arr.filter(r => r[key] !== null && r[key] !== undefined);
    return valid.length ? valid.reduce((s, r) => s + r[key], 0) : null;
  };

  return Object.entries(groups)
    .filter(([, arr]) => arr.length > 0)
    .map(([cat, arr]) => ({
      cat,
      count:         arr.length,
      avgRoas7d:     avgOrNull(arr, 'roas7d'),
      avgRoasLtv:    avgOrNull(arr, 'roasLtv'),
      avgEcpi:       avgOrNull(arr, 'ecpi'),
      totalInstalls: sumOrNull(arr, 'installs'),
      totalCost:     sumOrNull(arr, 'cost'),
    }));
}

const STRENGTH_ADVERB = { Strong: 'strongly', Moderate: 'moderately', Weak: 'weakly', None: 'minimally' };

export function generateInsights(correlations, n) {
  const insights = [];
  if (!correlations || correlations.length === 0) return insights;

  if (n < 10) {
    insights.push(
      `Small sample (n=${n}) — treat these as directional indicators only, not statistically reliable conclusions. More campaigns will improve accuracy.`
    );
  }

  // Top predictor of ROAS 7d
  const topRoas = correlations.find(c => c.outcomes.roas7d?.pearson !== null);
  if (topRoas && insights.length < 3) {
    const r = topRoas.outcomes.roas7d.pearson;
    const str = strengthLabel(r);
    const dir = r > 0 ? 'positively' : 'negatively';
    insights.push(
      `${topRoas.label} was the strongest predictor of ROAS 7d — ${STRENGTH_ADVERB[str]} ${dir} correlated (r=${r.toFixed(2)}).`
    );
  }

  // Charisma
  const charisma = correlations.find(c => c.key === 'charisma');
  if (charisma && charisma.outcomes.roas7d?.n >= 2 && insights.length < 3) {
    const r = charisma.outcomes.roas7d.pearson;
    const n2 = charisma.outcomes.roas7d.n;
    if (r !== null && Math.abs(r) >= 0.15) {
      const dir = r > 0 ? 'better' : 'worse';
      insights.push(
        `Charisma score trended toward ${dir} ROAS (r=${r.toFixed(2)}, n=${n2}).${n2 < 5 ? ' More data needed to confirm.' : ''}`
      );
    }
  }

  // US%
  const usPct = correlations.find(c => c.key === 'us_pct');
  if (usPct && insights.length < 3) {
    const r = usPct.outcomes.ecpi?.pearson;
    const n2 = usPct.outcomes.ecpi?.n ?? 0;
    if (r !== null && n2 >= 2 && Math.abs(r) >= 0.15) {
      // ecpi is inverted: positive r = lower eCPI = better installs efficiency
      const effect = r > 0 ? 'lower eCPI (more efficient installs)' : 'higher eCPI';
      insights.push(`Higher US audience % correlated with ${effect} (r=${r.toFixed(2)}).`);
    }
  }

  // QS fallback
  const qs = correlations.find(c => c.key === 'qs');
  if (qs && insights.length < 3) {
    const r = qs.outcomes.roas7d?.pearson;
    const n2 = qs.outcomes.roas7d?.n ?? 0;
    if (n2 >= 2 && r !== null) {
      const str = strengthLabel(r);
      insights.push(
        `QS score showed ${STRENGTH_ADVERB[str]} correlation with ROAS 7d (r=${r.toFixed(2)}). ${
          str === 'None' || str === 'Weak'
            ? 'Consider recalibrating QS weights based on this campaign.'
            : 'QS is tracking real campaign performance well.'
        }`
      );
    }
  }

  return insights.slice(0, 3);
}
