const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const PREFERRED_SHEETS = ['Longlist', 'longlist', 'GOAT', 'goat', 'YT', 'yt', 'OFFER', 'Offer'];

export function extractSpreadsheetId(url) {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!m) throw new Error('Invalid Google Sheets URL — could not extract spreadsheet ID.');
  return m[1];
}

export function normalizeLink(url) {
  return String(url || '').toLowerCase()
    .replace(/\/videos\/?$/, '')
    .replace(/\/featured\/?$/, '')
    .replace(/\/$/, '')
    .trim();
}

/** Fetch all sheet titles from the spreadsheet metadata */
async function getSheetTitles(spreadsheetId, apiKey) {
  const res = await fetch(`${SHEETS_BASE}/${spreadsheetId}?key=${apiKey}&fields=sheets.properties.title`);
  if (!res.ok) throw new Error(`Sheets API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.sheets.map(s => s.properties.title);
}

/** Fetch raw 2D array from a specific sheet */
export async function fetchSheetData(spreadsheetId, apiKey, sheetName) {
  const encoded = encodeURIComponent(sheetName);
  const res = await fetch(`${SHEETS_BASE}/${spreadsheetId}/values/${encoded}?key=${apiKey}`);
  if (!res.ok) throw new Error(`Sheets API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.values || [];
}

/**
 * Auto-detect the Longlist sheet name and fetch its rows.
 * Returns { rows, sheetName, format } where format is 'zorka' | 'jmg'.
 */
export async function fetchLonglistSheet(spreadsheetId, apiKey) {
  const titles = await getSheetTitles(spreadsheetId, apiKey);

  // Pick sheet by preferred name order, fallback to first non-Approved sheet
  const preferred = PREFERRED_SHEETS.find(p => titles.includes(p));
  const sheetName = preferred || titles.find(t => !/approved/i.test(t)) || titles[0];

  const rows = await fetchSheetData(spreadsheetId, apiKey, sheetName);

  // Detect format (same logic as parseExcel.js)
  let format = 'zorka';
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const rowStr = (rows[r] || []).map(c => String(c).toLowerCase()).join('|');
    if (rowStr.includes('channel name') || rowStr.includes('creator status') || rowStr.includes('client confirmation')) {
      format = 'jmg';
      break;
    }
  }

  return { rows, sheetName, format };
}

/** Fetch the Approved sheet rows, returns null if sheet doesn't exist */
export async function fetchApprovedSheet(spreadsheetId, apiKey) {
  const titles = await getSheetTitles(spreadsheetId, apiKey);
  const approvedTitle = titles.find(t => /approved/i.test(t));
  if (!approvedTitle) return null;
  return fetchSheetData(spreadsheetId, apiKey, approvedTitle);
}
