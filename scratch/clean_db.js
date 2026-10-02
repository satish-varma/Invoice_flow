async function clean() {
    const projectId = 'invoiceflow-24nxt';
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/newrelic_challans?pageSize=1000`);
    const data = await res.json();
    const docs = data.documents || [];
    
    for (const d of docs) {
        if(!d.fields.isDeleted?.booleanValue) {
            const dc = d.fields.dcNumber?.stringValue;
            const note = d.fields.note?.stringValue;
            if (['HYD579','HYD580','HYD581','HYD582','HYD583','HYD584','HYD585','HYD586','HYD587','HYD588'].includes(dc)) {
                if (note !== 'Seeded from aggregator data') {
                    console.log("Deleting duplicate old manual DC:", dc, d.name);
                    await fetch(`https://firestore.googleapis.com/v1/${d.name}`, {
                        method: 'DELETE'
                    });
                }
            }
        }
    }
    console.log("Done");
}
clean();
