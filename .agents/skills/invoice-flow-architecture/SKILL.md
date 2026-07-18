---
name: invoice-flow-architecture
description: Deep dive architectural guidelines, historical context, and critical rules for developing the Invoice Flow Next.js application. Use this whenever working on data extraction, forms, or deployment issues in this project.
---

# Invoice Flow Architecture Deep Dive

This skill contains critical, hard-earned historical context and architectural patterns for developing this Next.js 15 Firebase application. This app was intentionally pivoted away from relying on expensive/unpredictable AI models toward robust, deterministic, offline extraction methods.

## 1. Data Extraction Pipeline (The Anti-AI Pivot)

*   **Gemini AI is Removed:** We have completely removed Gemini/Genkit AI usage for autofilling "Delivery Challans" and "Quotations". These sections now rely exclusively on an **Excel Import** system. Do **not** re-add Gemini logic for these forms unless explicitly requested by the user.
*   **Invoice PDF Extraction:** For the main invoice extraction feature, we use a custom Regex-based parser (`parseInvoiceText`) against raw text extracted from PDFs.
*   **Regex Rules to Maintain:** 
    *   **Hungerbox Force-Override:** If an invoice contains the string "Vendor Address" or targets "Gut Guru", the system forces the customer name to "Hungerbox" to ensure consistency for this specific vendor.
    *   **Item Table Detection:** The parser looks for specific headers (`# item & desc`, `description hsn`, `hsn/sac qty rate amount`) to dynamically identify the start of line items.

## 2. Serverless Environment Constraints (Firebase App Hosting)

Firebase App Hosting uses Cloud Run (Serverless Edge runtimes) which imposes strict limits on how Node.js applications behave, specifically breaking traditional Next.js Server Actions for file parsing.

*   **No Next.js Server Actions for File Uploads:** We do **not** use Next.js Server Actions (`'use server'`) for PDF text extraction. Server Actions have a default 1MB payload limit that blocks Base64 PDFs, and Next.js aggressively masks initialization errors (like native module failures) as generic 500 errors ("An unexpected response was received from the server").
*   **Use API Routes:** All file processing must go through standard Next.js App Router API Routes (e.g., `src/app/api/extract-invoice/route.ts`). This bypasses the Server Action payload limits, prevents Edge-runtime compilation bugs, and ensures clear error propagation to the client.
*   **PDF Parsing Library (`unpdf`):** We use `unpdf` instead of `pdf-parse`. Traditional libraries like `pdf-parse` rely on the Node.js filesystem (`fs`) to dynamically load Web Worker files (`pdf.worker.js`). In serverless environments, this worker file is lost during bundling, causing the server to fatally crash instantly. `unpdf` is designed for universal Edge compatibility.
*   **Buffer Requirements:** `unpdf` strictly requires standard Web APIs (`Uint8Array`). Always convert Node `Buffer` objects explicitly before passing them: `new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)`. Passing a Node `Buffer` directly will result in a runtime crash.
*   **unpdf Return Types:** `unpdf`'s `extractText()` returns an **array of strings** (one array element per page), unlike older libraries that return a single concatenated string. Always verify the return type and join the array (`text.join('\n')`) before running regex or `.trim()`.

## 3. UI and State Management

*   **Ship-To Smart Matching:** When matching extracted invoice text to saved Firebase Contacts (to auto-fill Ship-To details), name-matching alone is insufficient due to corporate branches (e.g., "CGI Nexity" vs "CGI Sky View"). The app utilizes a weighted scoring system in `invoice-form.tsx` that splits the saved contact's address into words, and searches the raw PDF text for those specific address tokens to confirm a branch match and prevent false positives.
*   **Forms (Shadcn):** The app uses Shadcn UI components. Ensure any new forms follow the existing controlled-component patterns with `react-hook-form` and Zod validation, as seen in `invoice-form.tsx` and `quotation-form.tsx`.
*   **Firebase Structure:** 
    *   Collections: `invoices`, `quotations`, `deliveryChallans`, `clients`, `products`, `settings`.
    *   The `settings` collection stores persistent configurations like billing/shipping contacts, standard tax rates, and HSN codes, which are aggressively queried to build dropdown menus across the application.
