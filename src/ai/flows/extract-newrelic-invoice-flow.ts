'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExtractedItemSchema = z.object({
  brandName: z.string().optional().describe('Brand name of the item or supplier/manufacturer brand.'),
  itemName: z.string().describe('Item description or product name.'),
  quantity: z.number().describe('Quantity of the item.'),
  expiry: z.string().optional().describe('Expiry date if available (e.g. DD-MM-YYYY or MM-YYYY).'),
});

const ExtractInvoiceInputSchema = z.object({
  fileDataUri: z
    .string()
    .describe("Data URI of the invoice PDF or image file (e.g., 'data:application/pdf;base64,...' or 'data:image/jpeg;base64,...')."),
});

const ExtractInvoiceOutputSchema = z.object({
  brandName: z.string().optional().describe('Primary brand or supplier name on invoice.'),
  dcNumber: z.string().optional().describe('Invoice number or delivery challan reference number.'),
  date: z.string().optional().describe('Document date.'),
  lineItems: z.array(ExtractedItemSchema).describe('List of line items extracted from the invoice.'),
});

export type ExtractInvoiceInput = z.infer<typeof ExtractInvoiceInputSchema>;
export type ExtractInvoiceOutput = z.infer<typeof ExtractInvoiceOutputSchema>;

const prompt = ai.definePrompt({
  name: 'extractNewRelicInvoicePrompt',
  input: { schema: ExtractInvoiceInputSchema },
  output: { schema: ExtractInvoiceOutputSchema },
  prompt: `You are an expert AI parser for vendor invoices, purchase orders, and delivery challans (e.g., Gut Guru, Healthy Master, Unibic, Happilo, Paper Boat, etc.).
Analyze the provided document: {{media url=fileDataUri}}

Extract:
1. Primary brand or supplier name (brandName) appearing at the top or header (e.g., "Gut Guru", "Healthy Master", "Unibic", "Paper Boat", etc.).
2. Invoice / DC Number (dcNumber) if visible.
3. Date of the invoice/challan if visible.
4. All product line items. For each line item:
   - brandName: The item's brand name (default to primary brand name if not specified per row).
   - itemName: Full clean product name/description.
   - quantity: Numeric quantity of units/boxes.
   - expiry: Expiry date string if specified on invoice.

Return crisp, clean structured JSON.`,
});

export async function extractNewRelicInvoiceData(
  input: ExtractInvoiceInput
): Promise<ExtractInvoiceOutput> {
  const { output } = await prompt(input);
  return output!;
}
