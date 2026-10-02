async function fixBlr() {
    const projectId = 'invoiceflow-24nxt';
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/newrelic_challans?pageSize=1000`);
    const data = await res.json();
    const docs = data.documents || [];
    
    for (const d of docs) {
        if(d.fields.isDeleted?.booleanValue) continue;
        const dc = d.fields.dcNumber?.stringValue;
        if (!dc.startsWith('BLR')) continue;
        
        let changed = false;
        const lineItems = d.fields.lineItems?.arrayValue?.values || [];
        
        for (const item of lineItems) {
            const f = item.mapValue.fields;
            const name = f.itemName.stringValue;
            
            // Storia Coconut Water MRP
            if (name === 'Storia Coconut Water') {
                if (f.mrp.doubleValue !== 50) {
                    f.mrp.doubleValue = 50;
                    f.value.doubleValue = f.quantity.integerValue * 50; // update value
                    changed = true;
                }
            }
            if (name === 'Storia Pomegranate Juice') {
                f.itemName.stringValue = 'Storia Pomogranate'; changed = true;
            }
            if (name === 'Storia Bnana shake') {
                f.itemName.stringValue = 'Storia Banana Milkshake'; changed = true;
            }
            if (name === 'Fab box Hihgh protein soya chips') {
                f.itemName.stringValue = 'Fab Box High Protein Soya Chips';
                f.brandName.stringValue = 'Fab Box';
                changed = true;
            }
            if (name === 'Fab box Chocochip bnana cookies') {
                f.itemName.stringValue = 'Fab Box Chocochip banana cookies';
                f.brandName.stringValue = 'Fab Box';
                f.mrp = { doubleValue: 47 };
                f.value = { doubleValue: f.quantity.integerValue * 47 };
                changed = true;
            }
            if (name === 'Peping Ginger pineapple') {
                f.itemName.stringValue = 'Peping Pineapple Ginger'; changed = true;
            }
            if (name === 'Peping Fennel coconut') {
                f.itemName.stringValue = 'Peping Coconut Fennel'; changed = true;
            }
            if (name === 'Peping Spearmint Orange') {
                f.itemName.stringValue = 'Peping Oranage Spearmint'; changed = true;
            }
            if (name === 'Epigamia Vanilla milk shake') {
                f.itemName.stringValue = 'Epigamia Vanilla Milkshake'; changed = true;
            }
            if (name === 'Epigamia Chocolate milk shake') {
                f.itemName.stringValue = 'Epigamia Chocolate Milkshake'; changed = true;
            }
            if (name === 'Epigamia Strawberry milk shake') {
                f.itemName.stringValue = 'Epigamia Strawberry  Milkshake'; changed = true; // Note the double space in aggregator data
            }
            if (name === 'Epigamia Strawberry' && dc === 'BLR063') {
                f.itemName.stringValue = 'Epigamia Everyday Yogurt'; changed = true;
            }
            if (name === 'Epigamia Alphonso mango') {
                f.itemName.stringValue = 'Epigamia Alphonse Mango'; changed = true;
            }
            if (name === 'Epigamia Lychee') {
                f.itemName.stringValue = 'Epigamia Lichee'; changed = true;
            }
            if (name === 'Akshaykalpa Spicy Buttermilk') {
                f.itemName.stringValue = 'Akshaykalpa Spicy Butter Milk'; changed = true;
            }
        }
        
        if (changed) {
            console.log("Updating", dc);
            await fetch(`https://firestore.googleapis.com/v1/${d.name}?updateMask.fieldPaths=lineItems`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: { lineItems: d.fields.lineItems } })
            });
        }
    }
    console.log("Done");
}
fixBlr();
