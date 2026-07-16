'use server';
/**
 * @fileOverview Quotation extraction — Gemini AI removed.
 * Excel import is now used instead. These exports are kept for
 * backward compatibility only and will throw if called.
 */

export type ExtractQuotationInput = { photoDataUri: string };
export type ExtractQuotationOutput = Record<string, never>;

export async function extractQuotationData(
  _input: ExtractQuotationInput
): Promise<ExtractQuotationOutput> {
  throw new Error('AI-based quotation extraction has been removed. Use the Excel import feature instead.');
}
