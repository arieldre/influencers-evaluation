import * as XLSX from 'xlsx';

function rowToFlat(r, i) {
  return {
    '#': i + 1,
    'Name': r.name,
    'Link': r.link,
    'Decision': r.decision,
    'Category': r.category,
    'Cat Profile': r.cat_profile,
    'Format': r.format,
    'Price': r.price,
    'Offer': typeof r.offer === 'number' ? r.offer : '',
    'Discount': r.discount || '',
    'Claimed Views': r.claimed_views || '',
    'Actual Avg': r.actual_avg || '',
    'Z.CPM': r.zorka_cpm || '',
    'Real CPM': r.real_cpm || '',
    'QS': r.qs || '',
    'E Ratio': r.e != null && r.e !== 999 ? r.e : '',
    'View Label': r.view_label || '',
    'View Ratio': r.view_ratio != null ? r.view_ratio : '',
    'Stability': r.stability || '',
    'Face': r.face?.face_label || '',
    'Charisma Score': r.charisma?.charisma ?? '',
    'Charisma Label': r.charisma?.label || '',
    'Avg Comment Len': r.charisma?.avg_length ?? '',
    'Excited %': r.charisma?.excited_pct ?? '',
    'Positive %': r.charisma?.positive_pct ?? '',
    'Generic %': r.charisma?.generic_pct ?? '',
    'Claimed ER %': r.er ? +(r.er * 100).toFixed(2) : '',
    'Real ER %': r.real_er != null ? +(r.real_er * 100).toFixed(2) : '',
    'ER Gap %': (r.real_er != null && r.er) ? +((r.real_er - r.er) * 100).toFixed(2) : '',
    'Comment Rate %': r.comment_rate != null ? +(r.comment_rate * 100).toFixed(2) : '',
    'Upload Freq (days)': r.upload_freq ?? '',
    'Claimed ER': r.er || '',
    'GEO': r.geo || '',
    'Sub Warn': r.sub_warn || '',
    'Comment': r.auto_comment || '',
  };
}

function buildFilename(ext) {
  const d = new Date().toISOString().slice(0, 10);
  return `influencer_results_${d}.${ext}`;
}

export function exportToExcel(rows) {
  const data = rows.map(rowToFlat);
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Results');
  XLSX.writeFile(wb, buildFilename('xlsx'));
}

export function exportToCSV(rows) {
  const data = rows.map(rowToFlat);
  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildFilename('csv');
  a.click();
  URL.revokeObjectURL(url);
}
