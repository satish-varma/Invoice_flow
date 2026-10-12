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

## 4. UI/UX Rules and Data Integrity (NewRelic Forms)

*   **P.Cost / procurementCost Mapping:** The source of truth is now `procurementCost`. Do NOT use the legacy field `pCost`. During save/update operations, explicit cleanup (`deleteField()`) should be used to clear legacy data on Firebase to prevent conflict.
*   **Zod Schema & Number Coercion:** Empty input fields (`<input type="number">`) return empty strings `""`. Do not use `.preprocess()` for handling these in Zod, as it breaks the `zodResolver` mapping to `react-hook-form`. Instead, use standard `z.coerce.number().optional()` to coerce `""` to `0` safely, and handle `0` vs original values explicitly in the `onSubmit` logic.
*   **Silent Failures:** Always wire up the `onValidationError` callback on `handleSubmit` (passing it as the second argument) to display validation errors in a toast. Otherwise, form buttons will seem "unresponsive" and silent-fail when a nested line item fails validation.
*   **Critical Features to Maintain:** The NewRelic dashboards and views must **ALWAYS** retain:
    1.  **Reconcile Navigation:** A direct button/link to the `/newrelic/reconcile` interface.
    2.  **Export to Excel:** Restricted to `admin` and `superadmin`. Hidden from regular `user` and `manager` roles.
    3.  **Cycles Filters:** Date filters that specifically allow viewing Cycle 1 (1st-15th) and Cycle 2 (16th-End). Visible ONLY to `admin` / `superadmin`. Non-admin users see simplified month/year pickers with their preferred location preselected by default.

## 5. Mobile & Android Hydration Guidelines

*   **Mounted Guard against SSR Mismatch:** Any page reading `localStorage`, `sessionStorage`, or user preferences (e.g., `user.preferredLocations`) MUST implement a `mounted` guard (`if (!mounted) return <Loader />`) or add `suppressHydrationWarning`. This prevents Chrome extensions (injecting `_gcruniqueid="1"`, `_gcruniqueid="2"`, etc.) and client-only state from throwing hydration mismatch fatal warnings.
*   **Tactile Feedback (`triggerHaptic`):** All interactive steps on mobile (tab switches, +/- steppers, photo shutter, and saves) must trigger lightweight haptics via `src/lib/haptics.ts`.
*   **Android Capacitor Bridge:** Mobile builds are managed via Capacitor 8 in `./android`. Keep `allowMixedContent` and `cleartext` enabled in `capacitor.config.ts` during local testing.

## 6. Multi-Site Architecture & Zero Data Loss Guarantee

The operations and tuckshop suite supports multiple company stalls in Hyderabad & Bangalore:
- **NewRelic (`newrelic`):** Locations in `hyderabad` and `bangalore`. Has full feature access including Delivery Challans (`/delivery-challans`).
- **DSM (`dsm`):** Tuckshop stall strictly in `hyderabad`. Delivery Challans is completely forbidden & hidden.
- **NTT Data (`ntt_data`):** Tuckshop stall strictly in `hyderabad`. Delivery Challans is completely forbidden & hidden.

### Core Rules to Preserve:
1.  **Zero Data Loss Fallback (`resolveSiteId`):** Legacy Firestore documents (in `newrelic_tuckshop`, `newrelic_stock_requests`, `newrelic_employees`, `newrelic_catalog`) do NOT have a `siteId` property. Any reader/query MUST use `docData.siteId || 'newrelic'` or `resolveSiteId(siteId)`. Never perform destructive migrations or assume missing `siteId` is invalid.
2.  **Location Locking:** When DSM or NTT Data is selected or assigned, the location MUST be locked to `hyderabad`. Bangalore is strictly disabled.
3.  **Delivery Challans Isolation:** Non-admin managers assigned to DSM or NTT Data are blocked from accessing delivery challans both via navigation bars and layout route redirects. In stock request approvals, "Create Challan" is restricted to NewRelic requests only.
4.  **Catalog Scoping:** Catalog items have `applicableSites?: ('newrelic' | 'dsm' | 'ntt_data' | 'all')[]`. Items without this field default to `['newrelic']`, preserving the entire 113-item existing catalog for NewRelic.
5.  **Ledger & Payroll Multi-Site Scoping:**
    - **Tuckshop Ledger:** Admins can view/filter transactions across all sites or isolate NewRelic, DSM, or NTT Data. Transactions feature color-coded company badges in both mobile cards and desktop table views.
    - **Attendance & Payroll:** Admins can switch between all sites or isolate DSM / NTT Data for daily check-ins, history logs, and salary advance deductions. Export to Excel automatically scopes staff and filenames to the selected site.


