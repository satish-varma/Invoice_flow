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
            const brand = f.brandName.stringValue;
            
            if (brand === 'Storia' && name === 'Coconut Water') {
                f.itemName.stringValue = 'Storia Coconut Water';
                if (f.mrp.doubleValue !== 50) {
                    f.mrp.doubleValue = 50;
                    f.value.doubleValue = f.quantity.integerValue * 50; 
                }
                changed = true;
            }
            if (brand === 'Storia' && name === 'Pomegranate Juice') {
                f.itemName.stringValue = 'Storia Pomogranate'; changed = true;
            }
            if (brand === 'Storia' && name === 'Bnana shake') {
                f.itemName.stringValue = 'Storia Banana Milkshake'; changed = true;
            }
            if (name === 'Hihgh protein soya chips') {
                f.itemName.stringValue = 'Fab Box High Protein Soya Chips'; changed = true;
            }
            if (name === 'Chocochip bnana cookies') {
                f.itemName.stringValue = 'Fab Box Chocochip banana cookies';
                f.mrp = { doubleValue: 47 };
                f.value = { doubleValue: f.quantity.integerValue * 47 };
                changed = true;
            }
            if (name === 'Ginger pineapple') {
                f.itemName.stringValue = 'Peping Pineapple Ginger'; changed = true;
            }
            if (name === 'Fennel coconut') {
                f.itemName.stringValue = 'Peping Coconut Fennel'; changed = true;
            }
            if (name === 'Spearmint Orange') {
                f.itemName.stringValue = 'Peping Oranage Spearmint'; changed = true;
            }
            if (name === 'Vanilla milk shake') {
                f.itemName.stringValue = 'Epigamia Vanilla Milkshake'; changed = true;
            }
            if (name === 'Chocolate milk shake') {
                f.itemName.stringValue = 'Epigamia Chocolate Milkshake'; changed = true;
            }
            if (name === 'Strawberry milk shake') {
                f.itemName.stringValue = 'Epigamia Strawberry  Milkshake'; changed = true;
            }
            if (name === 'Strawberry' && dc === 'BLR063') {
                f.itemName.stringValue = 'Epigamia Everyday Yogurt'; changed = true;
            }
            if (name === 'Alphonso mango') {
                f.itemName.stringValue = 'Epigamia Alphonse Mango'; changed = true;
            }
            if (name === 'Lychee') {
                f.itemName.stringValue = 'Epigamia Lichee'; changed = true;
            }
            if (name === 'Spicy Buttermilk') {
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
