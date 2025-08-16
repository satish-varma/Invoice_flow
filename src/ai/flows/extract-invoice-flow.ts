'use server';
/**
 * @fileOverview An invoice data extraction AI agent.
 *
 * - extractInvoiceData - A function that handles the invoice data extraction process.
 * - ExtractInvoiceDataInput - The input type for the extractInvoiceData function.
 * - ExtractInvoiceDataOutput - The return type for the extractInvoiceData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const LineItemSchema = z.object({
  name: z.string().describe('The name or description of the line item.'),
  quantity: z.number().describe('The quantity of the line item.'),
  price: z.number().describe('The price or rate of a single unit of the line item.'),
});

const ExtractInvoiceDataInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of an invoice, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractInvoiceDataInput = z.infer<
  typeof ExtractInvoiceDataInputSchema
>;

const ExtractInvoiceDataOutputSchema = z.object({
  invoiceNumber: z.string().optional().describe('The invoice number.'),
  customerName: z.string().optional().describe('The name of the customer or who the invoice is billed to.'),
  date: z.string().optional().describe('The date of the invoice in YYYY-MM-DD format.'),
  lineItems: z.array(LineItemSchema).optional().describe('An array of line items from the invoice.'),
});
export type ExtractInvoiceDataOutput = z.infer<
  typeof ExtractInvoiceDataOutputSchema
>;

export async function extractInvoiceData(
  input: ExtractInvoiceDataInput
): Promise<ExtractInvoiceDataOutput> {
  return extractInvoiceDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractInvoiceDataPrompt',
  input: {schema: ExtractInvoiceDataInputSchema},
  output: {schema: ExtractInvoiceDataOutputSchema},
  prompt: `You are an expert at extracting structured data from images of invoices.
Extract the invoice number, customer name, date, and all line items from the provided invoice image.
For the date, please format it as YYYY-MM-DD. If the year is not specified, assume the current year.
For each line item, extract the description, quantity, and unit price.

Invoice Image: {{media url=photoDataUri}}`,
});

const extractInvoiceDataFlow = ai.defineFlow(
  {
    name: 'extractInvoiceDataFlow',
    inputSchema: ExtractInvoiceDataInputSchema,
    outputSchema: ExtractInvoiceDataOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
