async function check() {
    const projectId = 'invoiceflow-24nxt';
    const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/newrelic_challans?pageSize=1000`);
    const data = await res.json();
    const docs = data.documents || [];
    const counts = {};
    docs.forEach(d => {
        if(!d.fields.isDeleted?.booleanValue) {
            const dc = d.fields.dcNumber?.stringValue;
            counts[dc] = (counts[dc] || 0) + 1;
        }
    });
    console.log(counts);
}
check();
