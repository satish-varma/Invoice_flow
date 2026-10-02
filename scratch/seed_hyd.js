const fs = require('fs');

async function seed() {
    const tsv = fs.readFileSync('scratch/hyd_data.tsv', 'utf-8');
    const lines = tsv.split('\n').filter(l => l.trim());
    const header = lines[0].split('\t');
    
    // We need to construct challans based on DC number
    const challans = {};
    
    const dcDates = {
        'HYD579': '2026-09-20',
        'HYD580': '2026-09-22',
        'HYD581': '2026-09-24',
        'HYD582': '2026-09-25',
        'HYD583': '2026-09-26',
        'HYD584': '2026-09-27',
        'HYD585': '2026-09-30',
        'HYD586': '2026-09-30',
        'HYD587': '2026-10-01',
        'HYD588': '2026-10-01'
    };

    for(let i=1; i<lines.length; i++) {
        const cols = lines[i].split('\t');
        if (cols[0] === 'Total' || !cols[1]) continue;
        
        const dcsRaw = cols[1];
        const dcs = dcsRaw.split(',').map(s=>s.trim());
        const hsn = cols[2];
        const brand = cols[3];
        const desc = cols[4];
        const mrp = parseFloat(cols[5]);
        const pCost = mrp * 0.7; // Fake pCost based on MRP
        const gstRaw = cols[6];
        const gst = parseFloat(gstRaw.replace('%',''));
        
        // Find which dates have quantities
        for(let j=7; j<=21; j++) {
            const qtyStr = cols[j];
            if(qtyStr && qtyStr.trim() !== '') {
                const qty = parseInt(qtyStr, 10);
                if (qty > 0) {
                    // We need to figure out which DC to assign this to.
                    // We know the date from the header e.g. "9/16/2026" -> "2026-09-16"
                    const dateRaw = header[j];
                    const [m,d,y] = dateRaw.split('/');
                    const dateStr = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
                    
                    // Find a DC in 'dcs' that matches this date, or just pick the first one
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
                            dcDate: new Date(dcDates[assignedDc] || dateStr).toISOString(),
                            dcNumber: assignedDc,
                            lineItems: [],
                            note: "Seeded from aggregator data"
                        };
                    }
                    
                    challans[assignedDc].lineItems.push({
                        id: 'item_' + Math.random().toString(36).substr(2, 9),
                        brandName: brand,
                        itemName: desc,
                        quantity: qty,
                        mrp: mrp,
                        pCost: pCost,
                        value: qty * pCost // Value is typically qty * pCost internally? Actually the app uses mrp in some places. Let's use pCost.
                    });
                }
            }
        }
    }
    
    // Now push to firestore via REST API
    const projectId = 'invoiceflow-24nxt';
    
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

        const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/newrelic_challans`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
            console.error("Failed to insert", dc, await res.text());
        } else {
            console.log("Successfully inserted", dc);
        }
    }
}
seed();
