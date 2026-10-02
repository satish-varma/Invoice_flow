const fs = require('fs');

async function main() {
  // Fetch from Firestore REST API
  const projectId = "invoiceflow-24nxt"; 
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/newrelic_challans?pageSize=300`;
  
  const res = await fetch(url);
  const data = await res.json();
  
  const docs = data.documents || [];
  const challans = docs.map(doc => {
    const fields = doc.fields;
    
    // Check if not deleted
    if (fields.isDeleted && fields.isDeleted.booleanValue === true) return null;
    
    // Check location
    if (fields.location.stringValue !== 'hyderabad') return null;
    
    // Check cycle (16-30 Sept)
    const d = new Date(fields.dcDate.timestampValue);
    if (d.getMonth() !== 8 || d.getDate() < 16) return null; // Sep is 8
    
    const lineItems = (fields.lineItems?.arrayValue?.values || []).map(v => {
      return {
        brandName: v.mapValue.fields.brandName?.stringValue || '',
        itemName: v.mapValue.fields.itemName?.stringValue || '',
        quantity: v.mapValue.fields.quantity?.integerValue ? parseInt(v.mapValue.fields.quantity.integerValue, 10) : 0,
        mrp: v.mapValue.fields.mrp?.integerValue ? parseInt(v.mapValue.fields.mrp.integerValue, 10) : 
             v.mapValue.fields.mrp?.doubleValue ? parseFloat(v.mapValue.fields.mrp.doubleValue) : 0
      };
    });
    
    return {
      dcNumber: fields.dcNumber.stringValue,
      lineItems
    };
  }).filter(Boolean);
  
  const ourItems = [];
  challans.forEach(c => {
    c.lineItems.forEach(item => {
      ourItems.push({
        dcNumber: c.dcNumber,
        brand: item.brandName,
        desc: item.itemName,
        qty: item.quantity,
        val: item.quantity * item.mrp
      });
    });
  });

  const tsv = fs.readFileSync('scratch/hyd_data.tsv', 'utf-8');
  const lines = tsv.split('\n').filter(l => l.trim() !== '');
  
  const aggData = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    if (cols.length < 24) continue;
    if (cols[0] === 'Total' || cols[1] === '') continue;
    
    const dcs = cols[1].split(',').map(s => s.trim()).filter(Boolean);
    const brand = cols[3] || '';
    const desc = cols[4] || '';
    const qty = parseInt(cols[22], 10) || 0;
    const val = parseFloat(cols[23]) || 0;
    
    if (qty > 0) {
      aggData.push({ dcs, brand, desc, qty, val });
    }
  }

  const diffs = [];
  
  // Check agg vs ours
  aggData.forEach(aggItem => {
    let ourQtyForThis = 0;
    let ourValForThis = 0;
    
    const matchedOurItems = ourItems.filter(item => 
      aggItem.dcs.includes(item.dcNumber) &&
      item.brand.toLowerCase() === aggItem.brand.toLowerCase() &&
      item.desc.toLowerCase() === aggItem.desc.toLowerCase()
    );
    
    matchedOurItems.forEach(i => {
      ourQtyForThis += i.qty;
      ourValForThis += i.val;
    });
    
    if (ourQtyForThis !== aggItem.qty || ourValForThis !== aggItem.val) {
      diffs.push({
        dcs: aggItem.dcs,
        item: `${aggItem.brand} ${aggItem.desc}`,
        aggQty: aggItem.qty,
        aggVal: aggItem.val,
        ourQty: ourQtyForThis,
        ourVal: ourValForThis,
        issue: ourQtyForThis === 0 ? "Missing in our system (or spelled differently)" : "Mismatch"
      });
    }
  });

  // Check ours vs agg
  ourItems.forEach(ourItem => {
    const matched = aggData.find(a => 
      a.dcs.includes(ourItem.dcNumber) && 
      a.brand.toLowerCase() === ourItem.brand.toLowerCase() &&
      a.desc.toLowerCase() === ourItem.desc.toLowerCase()
    );
    
    if (!matched) {
      diffs.push({
        dcs: [ourItem.dcNumber],
        item: `${ourItem.brand} ${ourItem.desc}`,
        aggQty: 0,
        aggVal: 0,
        ourQty: ourItem.qty,
        ourVal: ourItem.val,
        issue: "Missing in aggregator invoice"
      });
    }
  });

  const totalOurVal = ourItems.reduce((acc, curr) => acc + curr.val, 0);
  const totalAggVal = aggData.reduce((acc, curr) => acc + curr.val, 0);

  console.log("=== SUMMARY ===");
  console.log(`Aggregator Total: ₹${totalAggVal}`);
  console.log(`Our System Total: ₹${totalOurVal}`);
  console.log(`Difference: ₹${totalAggVal - totalOurVal}`);
  console.log("\n=== DISCREPANCIES ===");
  
  diffs.forEach(d => {
    console.log(`[${d.dcs.join(', ')}] ${d.item}`);
    console.log(`   Issue: ${d.issue}`);
    console.log(`   Agg: ${d.aggQty} qty (₹${d.aggVal}) | Ours: ${d.ourQty} qty (₹${d.ourVal})`);
  });
}

main().catch(console.error);
