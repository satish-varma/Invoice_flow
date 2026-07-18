---
name: invoice-flow-architecture
description: Architectural guidelines, historical context, and critical rules for developing the Invoice Flow Next.js application. Use this whenever working on data extraction, forms, or deployment issues in this project.
---

# Invoice Flow Architecture

This skill contains critical, hard-earned historical context for developing this Next.js 15 Firebase application. 

## 1. Data Extraction & AI

*   **Gemini AI is Removed:** We have intentionally removed Gemini/Genkit AI usage for autofilling "Delivery Challans" and "Quotations." These sections now rely exclusively on an **Excel Import** system. Do **not** re-add Gemini logic for these forms unless explicitly requested by the user.
*   **Invoice PDF Extraction:** For the main invoice extraction feature, we use a regex-based parser against raw text extracted from PDFs.
*   **Customer Extraction Rules:** For Hungerbox invoices (often listing "Vendor Address"), the system forces the customer name to "Hungerbox" (or handles "Gut Guru" references) to ensure consistency.

## 2. Serverless Environment Constraints (Firebase App Hosting)

*   **No Next.js Server Actions for File Uploads:** We do **not** use Next.js Server Actions for PDF text extraction. Server Actions have a default 1MB payload limit that blocks Base64 PDFs, and Next.js aggressively masks initialization errors (like native module failures) as generic 500 errors in production.
*   **Use API Routes:** All file processing must go through standard Next.js App Router API Routes (e.g., `/api/extract-invoice`). This bypasses the Server Action payload limits and ensures clear error propagation.
*   **PDF Parsing Library (`unpdf`):** We use `unpdf` instead of `pdf-parse`. Traditional libraries like `pdf-parse` rely on the Node.js filesystem (`fs`) to load worker files, which causes fatal crashes in Firebase App Hosting serverless/edge environments. 
*   **Buffer Requirements:** `unpdf` is built for modern Web APIs and strictly requires `Uint8Array`. Always convert Node `Buffer` objects explicitly before passing them: `new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)`.
*   **unpdf Return Types:** `unpdf`'s `extractText()` returns an array of strings (one per page). Always verify the return type and join the array into a single string before running regex or `.trim()`.

## 3. UI and State Management

*   **Ship-To Matching:** When matching extracted invoice text to saved Firebase Contacts (to auto-fill Ship-To details), name-matching alone is insufficient due to corporate branches (e.g., "CGI Nexity" vs "CGI Sky View"). The app utilizes a weighted scoring system that validates **address words** alongside the name to prevent false positives.
*   **Forms:** The app uses Shadcn UI components. Ensure any new forms follow the existing controlled-component patterns (e.g., `invoice-form.tsx`).
