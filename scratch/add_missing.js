async function addMissing() {
    const projectId = 'invoiceflow-24nxt';
    
    // 1. Fetch HYD582 to append Unibic Chocochip
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/newrelic_challans?pageSize=1000`);
    const data = await res.json();
    const docs = data.documents || [];
    
    let hyd582Doc = docs.find(d => !d.fields.isDeleted?.booleanValue && d.fields.dcNumber?.stringValue === 'HYD582');
    
    if (hyd582Doc) {
        // add Unibic Chocochip
        hyd582Doc.fields.lineItems.arrayValue.values.push({
            mapValue: {
                fields: {
                    id: { stringValue: 'item_' + Math.random().toString(36).substr(2, 9) },
                    brandName: { stringValue: 'Unibic' },
                    itemName: { stringValue: 'Chocochip' },
                    quantity: { integerValue: 192 },
                    mrp: { doubleValue: 20 },
                    pCost: { doubleValue: 14 },
                    value: { doubleValue: 192 * 14 }
                }
            }
        });
        
        await fetch(`https://firestore.googleapis.com/v1/${hyd582Doc.name}?updateMask.fieldPaths=lineItems`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: { lineItems: hyd582Doc.fields.lineItems } })
        });
        console.log("Appended to HYD582");
    }

    // 2. Create HYD588
    const hyd588 = {
        fields: {
            location: { stringValue: 'hyderabad' },
            dcDate: { timestampValue: '2026-09-29T00:00:00.000Z' },
            dcNumber: { stringValue: 'HYD588' },
            note: { stringValue: 'Seeded from aggregator data v3' },
            isDeleted: { booleanValue: false },
            lineItems: {
                arrayValue: {
                    values: [
                        {
                            mapValue: {
                                fields: {
                                    id: { stringValue: 'item_1' },
                                    brandName: { stringValue: 'Epigamia' },
                                    itemName: { stringValue: 'Lychee Yogurt' },
                                    quantity: { integerValue: 48 },
                                    mrp: { doubleValue: 35 },
                                    pCost: { doubleValue: 24.5 },
                                    value: { doubleValue: 48 * 24.5 }
                                }
                            }
                        },
                        {
                            mapValue: {
                                fields: {
                                    id: { stringValue: 'item_2' },
                                    brandName: { stringValue: 'Epigamia' },
                                    itemName: { stringValue: 'Mango Yogurt' },
                                    quantity: { integerValue: 96 },
                                    mrp: { doubleValue: 35 },
                                    pCost: { doubleValue: 24.5 },
                                    value: { doubleValue: 96 * 24.5 }
                                }
                            }
                        },
                        {
                            mapValue: {
                                fields: {
                                    id: { stringValue: 'item_3' },
                                    brandName: { stringValue: 'Epigamia' },
                                    itemName: { stringValue: 'Strawberry Yogurt' },
                                    quantity: { integerValue: 96 },
                                    mrp: { doubleValue: 35 },
                                    pCost: { doubleValue: 24.5 },
                                    value: { doubleValue: 96 * 24.5 }
                                }
                            }
                        }
                    ]
                }
            },
            createdAt: { timestampValue: new Date().toISOString() },
            updatedAt: { timestampValue: new Date().toISOString() },
        }
    };
    
    await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/newrelic_challans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hyd588)
    });
    console.log("Created HYD588");
}
addMissing();
