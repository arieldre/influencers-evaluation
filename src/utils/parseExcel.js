import * as XLSX from 'xlsx';

/**
 * Parse uploaded Excel file, auto-detect format (Zorka vs JMG),
 * auto-detect sheet & start row, return array of creator objects.
 */
/**
 * Parse the "Approved" sheet if present.
 * Columns: 0=Name, 1=Link, 2=ReleaseDate, 3=Status, 4=Scripts, 5=ReleaseLink,
 *          6=Category, 7=Followers, 8=ER, 9=Format, 10=Geos,
 *          11-15=Male(13-17,18-24,25-34,35-44,45+),
 *          16-20=Female(13-17,18-24,25-34,35-44,45+),
 *          21=TA%, 22=ExpectedViews, 23=Price, 24=CPM,
 *          25=GOATComments, 26=ZorkaComments
 */
export function parseApprovedSheet(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = wb.SheetNames.find(n => /approved/i.test(n));
  if (!sheetName) return null;

  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Find first data row with a YouTube link in col 1
  let startRow = 0;
  for (let r = 0; r < raw.length; r++) {
    if (/youtube\.com|youtu\.be/i.test(String(raw[r]?.[1] || ''))) {
      startRow = r;
      break;
    }
  }

  const creators = [];
  for (let r = startRow; r < raw.length; r++) {
    const row = raw[r];
    const name = String(row[0] || '').trim();
    const link = String(row[1] || '').trim();
    if (!name || !link || !/youtube|youtu\.be/i.test(link)) continue;

    creators.push({
      name,
      link,
      release_date: String(row[2] || ''),
      status:       String(row[3] || ''),
      scripts:      String(row[4] || ''),
      release_link: String(row[5] || ''),
      category:     String(row[6] || ''),
      followers:    num(row[7]),
      er:           num(row[8]),
      format:       String(row[9] || ''),
      geo:          String(row[10] || ''),
      m1317: num(row[11]), m1824: num(row[12]), m2534: num(row[13]), m3544: num(row[14]), m45: num(row[15]),
      f1317: num(row[16]), f1824: num(row[17]), f2534: num(row[18]), f3544: num(row[19]), f45: num(row[20]),
      ta:            num(row[21]),
      claimed_views: num(row[22]),
      price:         num(row[23]),
      zorka_cpm:     num(row[24]),
      goat_comment:  String(row[25] || ''),
      zorka_comment: String(row[26] || ''),
    });
  }

  return creators;
}

export function parseExcel(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });

  // ── Auto-detect sheet ──
  const PREFERRED = ['Longlist', 'longlist', 'GOAT', 'goat', 'YT', 'yt', 'OFFER', 'Offer'];
  let sheetName = null;

  const candidates = [
    ...PREFERRED.filter(s => wb.SheetNames.includes(s)),
    ...wb.SheetNames.filter(s => !PREFERRED.includes(s)),
  ];

  for (const name of candidates) {
    const ws = wb.Sheets[name];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    let ytCount = 0;
    let nameCount = 0;
    for (let r = 0; r < Math.min(data.length, 120); r++) {
      // Check cols 1 and 3 for YouTube links (Zorka=col1, JMG=col3)
      const col1 = String(data[r]?.[1] || '');
      const col3 = String(data[r]?.[3] || '');
      const col0 = String(data[r]?.[0] || '');
      if (/youtube/i.test(col1) || /youtube/i.test(col3)) ytCount++;
      if (/^[A-Za-z\u0400-\u04FF]/.test(col0)) nameCount++;
    }
    if (ytCount >= 3 && nameCount > 3) {
      sheetName = name;
      break;
    }
  }
  if (!sheetName) sheetName = wb.SheetNames[0];

  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // ── Detect format: JMG vs Zorka ──
  let isJMG = false;
  for (let r = 0; r < Math.min(raw.length, 15); r++) {
    const rowStr = (raw[r] || []).map(c => String(c).toLowerCase()).join('|');
    if (rowStr.includes('channel name') || rowStr.includes('creator status') || rowStr.includes('client confirmation')) {
      isJMG = true;
      break;
    }
  }

  if (isJMG) {
    return parseJMG(raw, sheetName);
  }
  return parseZorka(raw, sheetName);
}

// ── JMG Format ──
// Header rows 5-6, data starts at first row with YouTube link in col 3
// Col layout: 0=Status, 1=ClientConf, 2=ChannelName, 3=Link, 4=GEO,
//   5=Category, 6=Subcategory, 7=Subscribers, 8=Format, 9=Price,
//   10=ER%, 11=AvgViews30d, 12=MinViews90d, 13=MaxViews90d,
//   14=eCPM30d, 15=eCPMmin90d, 16=eCPMmax90d, 17=Top3Geos,
//   18=US%, 19=Male%, 20=Female%, 21=18-24%, 22=25-34%, 23=35-44%, 24=44-54%,
//   25=ShowFace, 26=Comments

function parseJMG(raw, sheetName) {
  // Find start row: first row with YouTube link in col 3
  let startRow = 0;
  for (let r = 0; r < raw.length; r++) {
    const c3 = String(raw[r]?.[3] || '');
    if (/youtube\.com|youtu\.be/i.test(c3)) {
      startRow = r;
      break;
    }
  }

  const creators = [];
  for (let r = startRow; r < raw.length; r++) {
    const row = raw[r];
    const name = String(row[2] || '').trim();
    const link = String(row[3] || '').trim();
    if (!name || !link || !/youtube|youtu\.be/i.test(link)) continue;

    const cat = String(row[5] || '');
    const subcat = String(row[6] || '');
    const category = subcat ? `${cat}, ${subcat}` : cat;

    // Format normalization: "YT Integration" → "int", "YT Dedicated" → "ded"
    const rawFmt = String(row[8] || '').toLowerCase();
    const format = rawFmt.includes('ded') ? 'ded' : 'int';

    // Demographics: approximate male age bands from total male% × age%
    const maleRatio = num(row[19]);
    const age1824 = num(row[21]);
    const age2534 = num(row[22]);
    const age3544 = num(row[23]);
    const age4454 = num(row[24]);

    // US% from col 18 is a direct decimal (0.6253).
    // Build geo string for parseGeo compatibility from Top 3 Geos (col 17)
    // e.g. "US 62.53%, CA 4.52%, UK 3.49%" → "US 63 CA 5 UK 3"
    const topGeos = String(row[17] || '');
    const geo = topGeos.replace(/([\d.]+)%/g, (_, n) => String(Math.round(parseFloat(n))));

    // Show face from col 25
    const showFace = String(row[25] || '').toLowerCase();
    const jmgFace = showFace === 'yes' || showFace === 'y';

    creators.push({
      name,
      link,
      category,
      followers: num(row[7]),
      er: num(row[10]),
      format,
      geo,
      m1317: 0,
      m1824: maleRatio * age1824,
      m2534: maleRatio * age2534,
      m3544: maleRatio * age3544,
      m45: maleRatio * age4454,
      f1317: 0,
      f1824: (1 - maleRatio) * age1824,
      f2534: (1 - maleRatio) * age2534,
      f3544: (1 - maleRatio) * age3544,
      f45: (1 - maleRatio) * age4454,
      ta: 0,
      claimed_views: num(row[11]),
      price: num(row[9]),
      zorka_cpm: num(row[14]),
      notes: String(row[26] || ''),
      jmg_face: jmgFace,
      jmg_status: String(row[0] || ''),
      jmg_min_views_90d: num(row[12]),
      jmg_max_views_90d: num(row[13]),
      api: {},
      _source: 'jmg',
    });
  }

  return { creators, sheetName, startRow, totalRows: raw.length, format: 'jmg' };
}

// ── Zorka Format ──
// Col layout: 0=Name, 1=Link, 2=Category, 3=Followers, 4=ER, 5=Format,
//   6=Geo, 7-16=Demographics (M/F age bands), 17=TA%, 18=ClaimedViews,
//   19=Price, 20=ZorkaCPM, 21=Notes

function parseZorka(raw, sheetName) {
  let startRow = 0;
  for (let r = 0; r < raw.length; r++) {
    const c1 = String(raw[r]?.[1] || '');
    if (/youtube\.com|youtu\.be/i.test(c1)) {
      startRow = r;
      break;
    }
  }

  const creators = [];
  for (let r = startRow; r < raw.length; r++) {
    const row = raw[r];
    const name = String(row[0] || '').trim();
    const link = String(row[1] || '').trim();
    if (!name || !link || !/youtube|youtu\.be/i.test(link)) continue;

    creators.push({
      name,
      link,
      category: String(row[2] || ''),
      followers: num(row[3]),
      er: num(row[4]),
      format: String(row[5] || ''),
      geo: String(row[6] || ''),
      m1317: num(row[7]),
      m1824: num(row[8]),
      m2534: num(row[9]),
      m3544: num(row[10]),
      m45: num(row[11]),
      f1317: num(row[12]),
      f1824: num(row[13]),
      f2534: num(row[14]),
      f3544: num(row[15]),
      f45: num(row[16]),
      ta: num(row[17]),
      claimed_views: num(row[18]),
      price: num(row[19]),
      zorka_cpm: num(row[20]),
      notes: String(row[21] || ''),
      api: {},
      _source: 'zorka',
    });
  }

  return { creators, sheetName, startRow, totalRows: raw.length, format: 'zorka' };
}

// ── Raw-row exports for Google Sheets integration ──

export function parseZorkaRows(raw) {
  return parseZorka(raw, 'sheet').creators;
}

export function parseApprovedRows(raw) {
  let startRow = 0;
  for (let r = 0; r < raw.length; r++) {
    if (/youtube\.com|youtu\.be/i.test(String(raw[r]?.[1] || ''))) { startRow = r; break; }
  }
  const creators = [];
  for (let r = startRow; r < raw.length; r++) {
    const row = raw[r];
    const name = String(row[0] || '').trim();
    const link = String(row[1] || '').trim();
    if (!name || !link || !/youtube|youtu\.be/i.test(link)) continue;
    creators.push({
      name, link,
      release_date: String(row[2] || ''), status: String(row[3] || ''),
      scripts: String(row[4] || ''), release_link: String(row[5] || ''),
      category: String(row[6] || ''), followers: num(row[7]),
      er: num(row[8]), format: String(row[9] || ''), geo: String(row[10] || ''),
      m1317: num(row[11]), m1824: num(row[12]), m2534: num(row[13]), m3544: num(row[14]), m45: num(row[15]),
      f1317: num(row[16]), f1824: num(row[17]), f2534: num(row[18]), f3544: num(row[19]), f45: num(row[20]),
      ta: num(row[21]), claimed_views: num(row[22]), price: num(row[23]),
      zorka_cpm: num(row[24]), goat_comment: String(row[25] || ''), zorka_comment: String(row[26] || ''),
    });
  }
  return creators;
}

function num(v) {
  if (v === '' || v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[,$%]/g, ''));
  return isNaN(n) ? 0 : n;
}
