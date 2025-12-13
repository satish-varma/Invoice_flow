
'use server';
/**
 * @fileOverview A quotation data extraction AI agent.
 *
 * - extractQuotationData - A function that handles the quotation data extraction process.
 * - ExtractQuotationInput - The input type for the extractQuotationData function.
 * - ExtractQuotationOutput - The return type for the extractQuotationData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const QuotationLineItemSchema = z.object({
  name: z.string().describe('The name or description of the line item.'),
  unit: z.string().describe('The unit of the line item (e.g., kg, pcs, box).'),
  quantity: z.number().describe('The quantity of the line item.'),
  unitPrice: z.number().describe('The unit price of a single unit of the line item.'),
});

const ExtractQuotationInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a quotation, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractQuotationInput = z.infer<
  typeof ExtractQuotationInputSchema
>;

const ExtractQuotationOutputSchema = z.object({
  quotationNumber: z.string().optional().describe('The Quotation number.'),
  quotationDate: z.string().optional().describe('The date of the quotation in YYYY-MM-DD format.'),
  validityDate: z.string().optional().describe('The validity date of the quotation in Y-MM-DD format.'),
  billToName: z.string().optional().describe('The name of the customer or who the quotation is billed to.'),
  billToAddress: z.string().optional().describe('The full address of the "Bill To" party.'),
  lineItems: z.array(QuotationLineItemSchema).optional().describe('An array of line items from the quotation.'),
  subtotal: z.number().optional().describe('The subtotal amount before taxes and other charges.'),
  gstAmount: z.number().optional().describe('The calculated GST amount.'),
  shipping: z.number().optional().describe('The shipping or handling charges.'),
  other: z.number().optional().describe('Any other miscellaneous charges.'),
  total: z.number().optional().describe('The final total amount.'),
  terms: z.string().optional().describe('The terms and conditions of the quotation.'),
});
export type ExtractQuotationOutput = z.infer<
  typeof ExtractQuotationOutputSchema
>;

export async function extractQuotationData(
  input: ExtractQuotationInput
): Promise<ExtractQuotationOutput> {
  return extractQuotationDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractQuotationDataPrompt',
  input: {schema: ExtractQuotationInputSchema},
  output: {schema: ExtractQuotationOutputSchema},
  prompt: `You are an expert at extracting structured data from images of corporate quotations for food items.
Extract the Quotation number, quotation date, validity date, bill to name, bill to address, all line items, terms and conditions, subtotal, GST, shipping, other charges, and the total amount.
For the dates, please format it as YYYY-MM-DD. If the year is not specified, assume the current year.
For each line item, extract the description, unit, quantity, and unit price.

IMPORTANT: When parsing numbers, treat commas (,) as thousand separators and dots (.) as decimal separators. Ensure the entire number is captured as a single value.

Quotation Image: {{media url=photoDataUri}}`,
});

const extractQuotationDataFlow = ai.defineFlow(
  {
    name: 'extractQuotationDataFlow',
    inputSchema: ExtractQuotationInputSchema,
    outputSchema: ExtractQuotationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
