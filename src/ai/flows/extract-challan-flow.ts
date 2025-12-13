
'use server';
/**
 * @fileOverview A delivery challan data extraction AI agent.
 *
 * - extractChallanData - A function that handles the challan data extraction process.
 * - ExtractChallanInput - The input type for the extractChallanData function.
 * - ExtractChallanOutput - The return type for the extractChallanData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ChallanLineItemSchema = z.object({
  name: z.string().describe('The name or description of the line item.'),
  hsnCode: z.string().describe('The HSN code of the line item.'),
  quantity: z.number().describe('The quantity of the line item.'),
  unitPrice: z.number().describe('The unit price of a single unit of the line item.'),
});

const ExtractChallanInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a delivery challan, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractChallanInput = z.infer<
  typeof ExtractChallanInputSchema
>;

const ExtractChallanOutputSchema = z.object({
  dcNumber: z.string().optional().describe('The DC (Delivery Challan) number.'),
  dcDate: z.string().optional().describe('The date of the challan in YYYY-MM-DD format.'),
  billToName: z.string().optional().describe('The name of the customer or who the challan is billed to.'),
  billToAddress: z.string().optional().describe('The full address of the "Bill To" party.'),
  shipToName: z.string().optional().describe('The name of the party the goods are shipped to.'),
  shipToAddress: z.string().optional().describe('The full address of the "Ship To" party.'),
  lineItems: z.array(ChallanLineItemSchema).optional().describe('An array of line items from the challan.'),
  subtotal: z.number().optional().describe('The subtotal amount before taxes and other charges.'),
  gstAmount: z.number().optional().describe('The calculated GST amount.'),
  total: z.number().optional().describe('The final total amount.'),
});
export type ExtractChallanOutput = z.infer<
  typeof ExtractChallanOutputSchema
>;

export async function extractChallanData(
  input: ExtractChallanInput
): Promise<ExtractChallanOutput> {
  return extractChallanDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractChallanDataPrompt',
  input: {schema: ExtractChallanInputSchema},
  output: {schema: ExtractChallanOutputSchema},
  prompt: `You are an expert at extracting structured data from images of delivery challans.
Extract the DC number, DC date, bill to name, bill to address, ship to name, ship to address, all line items, subtotal, GST amount, and total amount.
For the date, please format it as YYYY-MM-DD. If the year is not specified, assume the current year.
For each line item, extract the description, HSN code, quantity, and unit price.

IMPORTANT: When parsing numbers, treat commas (,) as thousand separators and dots (.) as decimal separators. Ensure the entire number is captured as a single value.

Challan Image: {{media url=photoDataUri}}`,
});

const extractChallanDataFlow = ai.defineFlow(
  {
    name: 'extractChallanDataFlow',
    inputSchema: ExtractChallanInputSchema,
    outputSchema: ExtractChallanOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
