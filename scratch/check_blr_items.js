async function check() {
    const projectId = 'invoiceflow-24nxt';
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/newrelic_challans?pageSize=1000`);
    const data = await res.json();
    const docs = data.documents || [];
    
    for (const d of docs) {
        if(d.fields.isDeleted?.booleanValue) continue;
        const dc = d.fields.dcNumber?.stringValue;
        if (!dc.startsWith('BLR')) continue;
        const lineItems = d.fields.lineItems?.arrayValue?.values || [];
        for (const item of lineItems) {
            console.log(item.mapValue.fields.itemName?.stringValue);
        }
    }
}
check();
