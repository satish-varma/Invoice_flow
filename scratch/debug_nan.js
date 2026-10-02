const XLSX = require('xlsx');

// simulate the reading
const fileData = require('fs').readFileSync('scratch/hyd_data.tsv', 'utf-8');
const rows = fileData.split('\n').map(l => l.split('\t'));
const headerRow = rows[0];

const dcCol = headerRow.findIndex(h => String(h).toLowerCase().includes('dc no'));
const brandCol = headerRow.findIndex(h => String(h).toLowerCase().includes('brand'));
const descCol = headerRow.findIndex(h => String(h).toLowerCase().includes('desc'));
const qtyCol = headerRow.findIndex(h => String(h).toLowerCase().includes('total qty'));
const valCol = headerRow.findIndex(h => String(h).toLowerCase().includes('total value'));

console.log("Cols:", {dcCol, brandCol, descCol, qtyCol, valCol});

const dateColumns = [];
headerRow.forEach((h, idx) => {
  const hStr = String(h).trim();
  let parsedDate = null;
  if (!isNaN(Number(hStr)) && Number(hStr) > 40000) {
    parsedDate = new Date((Number(hStr) - (25567 + 1)) * 86400 * 1000);
  } else if (hStr.match(/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/)) {
    parsedDate = new Date(hStr);
  }

  if (parsedDate && !isNaN(parsedDate.getTime())) {
    const y = parsedDate.getFullYear();
    const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const d = String(parsedDate.getDate()).padStart(2, '0');
    dateColumns.push({ index: idx, dateStr: `${y}-${m}-${d}` });
  }
});
console.log("Dates:", dateColumns);

const aggData = [];
for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  if (!row || row.length === 0) continue;
  if (String(row[0]).toLowerCase() === 'total') continue;
  
  const dcRaw = row[dcCol];
  if (!dcRaw) continue;
  
  const dcs = String(dcRaw).split(',').map(s => s.trim()).filter(Boolean);
  const brand = brandCol !== -1 && row[brandCol] ? String(row[brandCol]) : '';
  const desc = descCol !== -1 && row[descCol] ? String(row[descCol]) : '';
  
  // This is where NaN could happen?
  let qtyVal = row[qtyCol];
  let valVal = row[valCol];
  
  if (typeof valVal === 'string' && valVal.includes(',')) {
     valVal = valVal.replace(/,/g, '');
  }
  
  const totalQty = parseInt(qtyVal, 10) || 0;
  const totalVal = parseFloat(valVal) || 0;
  
  const dailyData = [];
  dateColumns.forEach(col => {
    const qty = parseInt(row[col.index], 10) || 0;
    if (qty > 0) {
      dailyData.push({ dateStr: col.dateStr, qty });
    }
  });

  if (totalQty > 0 || dailyData.length > 0) {
    aggData.push({ dcs, brand, desc, totalQty, totalVal, dailyData });
  }
}

const summaryAggVal = aggData.reduce((acc, curr) => acc + curr.totalVal, 0);
console.log("Summary Agg Val:", summaryAggVal);

if (isNaN(summaryAggVal)) {
    console.log("NaN found! Let's find which row caused it:");
    aggData.forEach(item => {
        if (isNaN(item.totalVal)) {
            console.log(item);
        }
    });
}
