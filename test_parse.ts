import { extractDataFromText } from './src/services/localInvoiceParserServer';

const text1 = `
Invoice No : HYD123
Date: 12.12.2026
Healthy Master
1 Ragi Chips 200 45.00 Pcs
`;

console.log(extractDataFromText(text1, ''));
