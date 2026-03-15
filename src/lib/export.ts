
/**
 * Utility to export data to CSV and trigger download
 */
export function exportToCSV(data: any[], fileName: string) {
    if (data.length === 0) return;

    // Get headers from the first object, excluding common internal fields
    const excludeFields = ['id', 'createdAt', 'companyProfileId', 'lineItems', 'columns', 'appliedTaxes'];
    const headers = Object.keys(data[0]).filter(key => !excludeFields.includes(key));

    const csvRows = [];
    csvRows.push(headers.join(','));

    for (const row of data) {
        const values = headers.map(header => {
            const val = row[header];
            const escaped = ('' + val).replace(/"/g, '""'); // Escape double quotes
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
