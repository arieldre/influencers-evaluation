import * as XLSX from 'xlsx';

/**
 * Parse uploaded Excel file, auto-detect the right sheet & start row,
 * and return an array of creator objects matching the Colab pipeline.
 */
export function parseExcel(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });

  // ── Auto-detect sheet ──
  const PREFERRED = ['Longlist', 'longlist', 'GOAT', 'goat', 'YT', 'yt'];
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
      const col1 = String(data[r]?.[1] || '');
      const col0 = String(data[r]?.[0] || '');
      if (/youtube/i.test(col1)) ytCount++;
      if (/^[A-Za-z\u0400-\u04FF]/.test(col0)) nameCount++;
    }
    if (ytCount >= 5 && nameCount > 5) {
      sheetName = name;
      break;
    }
  }
  if (!sheetName) sheetName = wb.SheetNames[0];

  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // ── Auto-detect start row (first row with a YouTube link in col 1) ──
  let startRow = 0;
  for (let r = 0; r < raw.length; r++) {
    const c1 = String(raw[r]?.[1] || '');
    if (/youtube\.com|youtu\.be/i.test(c1)) {
      startRow = r;
      break;
    }
  }

  // ── Parse rows ──
  // Expected column layout (0-indexed):
  //  0: Name
  //  1: YT Link
  //  2: Category
  //  3: Followers
  //  4: ER
  //  5: Format (int / ded)
  //  6: Geo string  e.g. "US 45 UK 12 CA 5"
  //  7: M13-17
  //  8: M18-24
  //  9: M25-34
  // 10: M35-44
  // 11: M45+
  // 12: F13-17
  // 13: F18-24
  // 14: F25-34
  // 15: F35-44
  // 16: F45+
  // 17: TA%
  // 18: Claimed views
  // 19: Price
  // 20: CPM (Zorka)

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
    });
  }

  return { creators, sheetName, startRow, totalRows: raw.length };
}

function num(v) {
  if (v === '' || v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[,$%]/g, ''));
  return isNaN(n) ? 0 : n;
}
