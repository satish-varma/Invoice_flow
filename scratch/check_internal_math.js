const fs = require('fs');

const tsv = fs.readFileSync('scratch/hyd_data.tsv', 'utf-8');
const lines = tsv.split('\n').filter(l => l.trim() !== '');

const diffs = [];
let overallCalculatedTotal = 0;
let overallProvidedTotal = 0;

for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split('\t');
  if (cols.length < 24) continue;
  if (cols[0] === 'Total' || cols[1] === '') {
    if (cols[0] === 'Total') {
        overallProvidedTotal = parseFloat(cols[cols.length-1]) || 0;
    }
    continue;
  }
  
  const dc = cols[1];
  const brand = cols[3];
  const desc = cols[4];
  const mrp = parseFloat(cols[5]) || 0;
  
  // daily quantities are columns 7 to 21 (indices 7 to 21)
  let sumDailyQty = 0;
  for (let j = 7; j <= 21; j++) {
      if (cols[j] && cols[j].trim() !== '') {
          sumDailyQty += parseInt(cols[j], 10) || 0;
      }
  }
  
  const totalQty = parseInt(cols[22], 10) || 0;
  const totalValue = parseFloat(cols[23]) || 0;
  
  const calculatedValue = totalQty * mrp;
  overallCalculatedTotal += calculatedValue;
  
  if (calculatedValue !== totalValue || sumDailyQty !== totalQty) {
      diffs.push({
          row: i + 1,
          dc,
          item: `${brand} ${desc}`,
          mrp,
          sumDailyQty,
          totalQty,
          totalValue,
          calculatedValue,
          qtyDiff: totalQty - sumDailyQty,
          valueDiff: totalValue - calculatedValue
      });
  }
}

console.log("=== INTERNAL DATA INTEGRITY CHECK ===");
console.log(`Overall Calculated Value (Sum of Qty * MRP): ₹${overallCalculatedTotal}`);
console.log(`Overall Provided Value (Aggregator sum): ₹${overallProvidedTotal}`);

if (diffs.length === 0) {
    console.log("No differences found. All calculations (Qty * MRP) match the Total Value.");
} else {
    console.log(`\nFound ${diffs.length} discrepancies in the aggregator's own calculations:`);
    diffs.forEach(d => {
        console.log(`Row ${d.row}: [${d.dc}] ${d.item}`);
        console.log(`   MRP: ₹${d.mrp}, Stated Qty: ${d.totalQty}, Sum of Daily Qty: ${d.sumDailyQty}`);
        console.log(`   Stated Value: ₹${d.totalValue}, Calculated Value (Qty*MRP): ₹${d.calculatedValue}`);
        if (d.valueDiff !== 0) {
            console.log(`   => Value Difference: ₹${d.valueDiff} (They charged ₹${d.totalValue} instead of ₹${d.calculatedValue})`);
        }
        if (d.qtyDiff !== 0) {
            console.log(`   => Quantity Difference: Stated Total Qty is ${d.totalQty}, but daily columns sum to ${d.sumDailyQty}`);
        }
        console.log('');
    });
}
