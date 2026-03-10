import Papa from 'papaparse';

export function normalizeName(name) {
  if (!name) return '';
  return String(name)
    .replace(/^youtube\s*[-–—:]\s*/i, '') // strip "YouTube - " prefix
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function parseNum(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? null : n;
}

export function parseCampaignCSV(text) {
  // Auto-detect delimiter — try tab, comma, semicolon
  const firstLine = text.split('\n')[0] || '';
  const tabCount   = (firstLine.match(/\t/g)  || []).length;
  const commaCount = (firstLine.match(/,/g)   || []).length;
  const semiCount  = (firstLine.match(/;/g)   || []).length;
  const delimiter  = tabCount >= commaCount && tabCount >= semiCount ? '\t'
                   : semiCount > commaCount ? ';' : ',';

  const result = Papa.parse(text, { header: true, skipEmptyLines: true, delimiter });

  const rows = result.data;
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

  console.log('[csv] delimiter:', JSON.stringify(delimiter), '| rows:', rows.length, '| headers:', headers);
  console.log('[csv] first row sample:', JSON.stringify(rows[0]));

  if (rows.length === 0) {
    throw new Error(`CSV parsed 0 rows (delimiter="${delimiter}"). First line: "${firstLine.slice(0, 120)}"`);
  }

  if (headers.length <= 1) {
    throw new Error(`Only found ${headers.length} column(s) — wrong delimiter? First line: "${firstLine.slice(0, 120)}"`);
  }

  const find = (...subs) =>
    headers.find(h => subs.every(s => h.toLowerCase().includes(s.toLowerCase()))) || null;

  const COL = {
    mediaSource: find('media source') || find('media_source'),
    campaign:    find('campaign'),
    cost:        find('cost'),
    ecpi:        find('ecpi'),
    installs:    find('installs appsflyer') || find('installs'),
    roas1d:      find('roas 1 days') || find('roas_1'),
    roas7d:      find('roas 7 days') || find('roas_7'),
    roasLtv:     find('roas ltv')    || find('roas_ltv'),
    revenueLtv:  find('revenue ltv') || find('revenue_ltv'),
    retention1d: find('retention rate 1') || find('retention_1'),
    retention3d: find('retention rate 3') || find('retention_3'),
  };

  const get = (row, col) => (col ? row[col] : null);

  return rows
    .map(row => {
      const mediaSource = String(get(row, COL.mediaSource) || '').trim();
      const campaign    = String(get(row, COL.campaign)    || '').trim();
      // When Media source is the network name "Zorka", the channel name is in Campaign
      const channelName = /^zorka$/i.test(mediaSource) ? campaign : (mediaSource || campaign);
      return {
        mediaSource:    channelName,
        normalizedName: normalizeName(channelName),
        campaign,
        cost:       parseNum(get(row, COL.cost)),
        ecpi:       parseNum(get(row, COL.ecpi)),
        installs:   parseNum(get(row, COL.installs)),
        roas1d:     parseNum(get(row, COL.roas1d)),
        roas7d:     parseNum(get(row, COL.roas7d)),
        roasLtv:    parseNum(get(row, COL.roasLtv)),
        revenueLtv: parseNum(get(row, COL.revenueLtv)),
        retention1d: parseNum(get(row, COL.retention1d)),
        retention3d: parseNum(get(row, COL.retention3d)),
      };
    })
    .filter(r => r.normalizedName);
}

function aggregateRows(rows) {
  const sumOrNull = key => {
    const valid = rows.filter(r => r[key] !== null);
    return valid.length ? valid.reduce((s, r) => s + r[key], 0) : null;
  };
  const avgOrNull = key => {
    const valid = rows.filter(r => r[key] !== null);
    return valid.length ? valid.reduce((s, r) => s + r[key], 0) / valid.length : null;
  };

  return {
    mediaSource:   rows[0].mediaSource,
    normalizedName: rows[0].normalizedName,
    campaign:      rows.map(r => r.campaign).filter(Boolean).join(', '),
    cost:          sumOrNull('cost'),
    ecpi:          avgOrNull('ecpi'),
    installs:      sumOrNull('installs'),
    roas1d:        avgOrNull('roas1d'),
    roas7d:        avgOrNull('roas7d'),
    roasLtv:       avgOrNull('roasLtv'),
    revenueLtv:    sumOrNull('revenueLtv'),
    retention1d:   avgOrNull('retention1d'),
    retention3d:   avgOrNull('retention3d'),
    _rowCount:     rows.length,
  };
}

export function buildCoverage(approvedCreators, results, campaignRows) {
  // Build lookup maps
  const approvedMap = new Map();
  for (const c of (approvedCreators || [])) {
    const key = normalizeName(c.name);
    if (key) approvedMap.set(key, c);
  }

  const resultsMap = new Map();
  for (const r of (results || [])) {
    const key = normalizeName(r.name);
    if (key) resultsMap.set(key, r);
  }

  function fuzzyFindResult(key) {
    if (resultsMap.has(key)) return resultsMap.get(key);
    if (key.length < 4) return null;
    for (const [k, v] of resultsMap) {
      if (k.includes(key) || key.includes(k)) return v;
    }
    return null;
  }

  // Group CSV rows by normalized name
  const csvByName = new Map();
  for (const row of campaignRows) {
    if (!row.normalizedName) continue;
    if (!csvByName.has(row.normalizedName)) csvByName.set(row.normalizedName, []);
    csvByName.get(row.normalizedName).push(row);
  }

  const matched = [];
  const matchedKeys = new Set();

  for (const [normName, csvRows] of csvByName) {
    const approved = approvedMap.get(normName);
    if (!approved) continue;

    matchedKeys.add(normName);
    const scored = fuzzyFindResult(normName);
    const agg = aggregateRows(csvRows);

    const enriched = scored ? {
      qs:           scored.qs,
      e:            scored.e,
      decision:     scored.decision,
      charisma:     scored.charisma,
      creative:     scored.creative,
      face:         scored.face,
      cat_profile:  scored.cat_profile,
      qs_breakdown: scored.qs_breakdown,
      actual_avg:   scored.actual_avg,
      stability:    scored.stability,
    } : {};

    matched.push({
      ...approved,
      ...enriched,
      ...agg,
      _rawCsvRows: csvRows,
    });
  }

  const notInCampaign = (approvedCreators || []).filter(c => {
    const key = normalizeName(c.name);
    return key && !matchedKeys.has(key);
  });

  const unrecognized = [];
  for (const [normName, csvRows] of csvByName) {
    if (!approvedMap.has(normName)) {
      unrecognized.push(csvRows[0].mediaSource);
    }
  }

  // Individual rows for correlations (one per campaign row, not aggregated)
  const correlationRows = [];
  for (const m of matched) {
    for (const csvRow of m._rawCsvRows) {
      correlationRows.push({ ...m, ...csvRow });
    }
  }

  return { matched, notInCampaign, unrecognized, correlationRows };
}
