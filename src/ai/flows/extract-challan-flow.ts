'use server';
/**
 * @fileOverview Delivery Challan extraction — Gemini AI removed.
 * Excel import is now used instead. These exports are kept for
 * backward compatibility only and will throw if called.
 */

export type ExtractChallanInput = { photoDataUri: string };
export type ExtractChallanOutput = Record<string, never>;

export async function extractChallanData(
  _input: ExtractChallanInput
): Promise<ExtractChallanOutput> {
  throw new Error('AI-based challan extraction has been removed. Use the Excel import feature instead.');
}
