const fs = require('fs');

async function cleanAndSeed() {
    const projectId = 'invoiceflow-24nxt';
    
    // 1. Clean
    console.log("Cleaning DB...");
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/newrelic_challans?pageSize=1000`);
    const data = await res.json();
    const docs = data.documents || [];
    
    for (const d of docs) {
        if(!d.fields.isDeleted?.booleanValue) {
            const dc = d.fields.dcNumber?.stringValue;
            if (['HYD579','HYD580','HYD581','HYD582','HYD583','HYD584','HYD585','HYD586','HYD587','HYD588'].includes(dc)) {
                console.log("Deleting:", dc, d.name);
                await fetch(`https://firestore.googleapis.com/v1/${d.name}`, { method: 'DELETE' });
            }
        }
    }
    
    // 2. Parse TSV and infer dates
    const tsv = fs.readFileSync('scratch/hyd_data.tsv', 'utf-8');
    const lines = tsv.split('\n').filter(l => l.trim());
    const header = lines[0].split('\t');
    
    const dcDates = {};
    
    // Pass 1: Infer dates for single DCs
    for(let i=1; i<lines.length; i++) {
        const cols = lines[i].split('\t');
        if (cols[0] === 'Total' || !cols[1]) continue;
        const dcs = cols[1].split(',').map(s=>s.trim());
        if (dcs.length === 1) {
            const dc = dcs[0];
            for(let j=7; j<=21; j++) {
                if (cols[j] && cols[j].trim() !== '') {
                    const dateRaw = header[j];
                    const [m,d,y] = dateRaw.split('/');
                    dcDates[dc] = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
                }
            }
        }
    }
    // Pass 2: Infer dates for multiple DCs if missing
    for(let i=1; i<lines.length; i++) {
        const cols = lines[i].split('\t');
        if (cols[0] === 'Total' || !cols[1]) continue;
        const dcs = cols[1].split(',').map(s=>s.trim());
        if (dcs.length > 1) {
            for(let j=7; j<=21; j++) {
                if (cols[j] && cols[j].trim() !== '') {
                    const dateRaw = header[j];
                    const [m,d,y] = dateRaw.split('/');
                    const dateStr = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
                    // find a DC that doesn't have a date yet
                    let found = false;
                    for (const dc of dcs) {
                        if (dcDates[dc] === dateStr) found = true;
                    }
                    if (!found) {
                        for (const dc of dcs) {
                            if (!dcDates[dc]) {
                                dcDates[dc] = dateStr;
                                break;
                            }
                        }
                    }
                }
            }
        }
    }
    
    console.log("Inferred DC Dates:", dcDates);
    
    // 3. Construct challans
    const challans = {};
    for(let i=1; i<lines.length; i++) {
        const cols = lines[i].split('\t');
        if (cols[0] === 'Total' || !cols[1]) continue;
        
        const dcsRaw = cols[1];
        const dcs = dcsRaw.split(',').map(s=>s.trim());
        const brand = cols[3];
        const desc = cols[4];
        const mrp = parseFloat(cols[5]);
        const pCost = mrp * 0.7; 
        
        for(let j=7; j<=21; j++) {
            const qtyStr = cols[j];
            if(qtyStr && qtyStr.trim() !== '') {
                const qty = parseInt(qtyStr, 10);
                if (qty > 0) {
                    const dateRaw = header[j];
                    const [m,d,y] = dateRaw.split('/');
                    const dateStr = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
                    
                    let assignedDc = dcs[0];
                    for (const dc of dcs) {
                        if (dcDates[dc] === dateStr) {
                            assignedDc = dc;
                            break;
                        }
                    }
                    
                    if (!challans[assignedDc]) {
                        challans[assignedDc] = {
                            location: 'hyderabad',
                            dcDate: new Date(dcDates[assignedDc]).toISOString(),
                            dcNumber: assignedDc,
                            lineItems: [],
                            note: "Seeded from aggregator data v2"
                        };
                    }
                    
                    challans[assignedDc].lineItems.push({
                        id: 'item_' + Math.random().toString(36).substr(2, 9),
                        brandName: brand,
                        itemName: desc,
                        quantity: qty,
                        mrp: mrp,
                        pCost: pCost,
                        value: qty * pCost
                    });
                }
            }
        }
    }
    
    // 4. Insert
    console.log("Inserting...", Object.keys(challans));
    for (const dc in challans) {
        const challan = challans[dc];
        
        const payload = {
            fields: {
                location: { stringValue: challan.location },
                dcDate: { timestampValue: challan.dcDate },
                dcNumber: { stringValue: challan.dcNumber },
                note: { stringValue: challan.note },
                isDeleted: { booleanValue: false },
                lineItems: {
                    arrayValue: {
                        values: challan.lineItems.map(item => ({
                            mapValue: {
                                fields: {
                                    id: { stringValue: item.id },
                                    brandName: { stringValue: item.brandName },
                                    itemName: { stringValue: item.itemName },
                                    quantity: { integerValue: item.quantity },
                                    mrp: { doubleValue: item.mrp },
                                    pCost: { doubleValue: item.pCost },
                                    value: { doubleValue: item.value }
                                }
                            }
                        }))
                    }
                },
                createdAt: { timestampValue: new Date().toISOString() },
                updatedAt: { timestampValue: new Date().toISOString() },
            }
        };

        const r = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/newrelic_challans`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if(!r.ok) console.error("Failed", dc);
    }
    console.log("Done");
}
cleanAndSeed();
