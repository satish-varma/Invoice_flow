# InvoiceFlow - Professional Invoice Management

InvoiceFlow is a robust, serverless-friendly web application designed to streamline the creation, management, and tracking of professional invoices, quotations, and delivery challans. Built with Next.js 15, Firebase, and Tailwind CSS, it offers intelligent offline PDF parsing and seamless Excel integrations to automate data entry without relying on expensive or unpredictable AI APIs.

## Key Features

- **Offline PDF Parsing (Invoices):** Extract key details like invoice numbers, dates, customer names, and line items directly from PDF invoices. Powered by `unpdf` via a custom API Route to bypass serverless limitations, ensuring lightning-fast extraction without sending data to third-party AI services.
- **Excel Bulk Import:** Automatically populate Quotations and Delivery Challans by uploading standard Excel spreadsheets, bypassing the need for manual entry or OCR.
- **Smart Contact Matching:** Advanced "Ship-To" matching logic that verifies both company names and location-specific address keywords to prevent false positives (e.g., distinguishing between branches like "CGI Nexity" and "CGI Sky View").
- **Secure Cloud Storage:** All documents are securely saved to Firebase Firestore, with real-time syncing and robust data structure.
- **Dynamic Forms & PDF Generation:** Create, edit, and instantly preview professional PDFs for printing or sending to clients.
- **Serverless-Optimized Architecture:** Specifically tuned for deployment on Firebase App Hosting, utilizing App Router API routes to safely bypass Next.js Server Action payload limits and Edge runtime module constraints.

## Getting Started

To run this application locally, you will need Node.js (v20+), npm, and the Firebase CLI.

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2. **Configure Firebase:**
    Ensure you have an active Firebase project. You will need to add your Firebase configuration to your environment variables (e.g., `.env.local`).

3.  **Run the Development Server:**
    ```bash
    npm run dev
    ```

The application will be available at `http://localhost:9002` (or your configured port).

## Project Architecture

- **`src/app`**: Next.js App Router structure containing all main pages (invoices, quotations, challans).
- **`src/app/api/extract-invoice`**: The dedicated REST API route that handles server-side PDF text extraction. It uses `unpdf` and strict `Uint8Array` parsing to ensure compatibility with Firebase App Hosting.
- **`src/components`**: Reusable Shadcn UI components and complex form handlers (e.g., `invoice-form.tsx`, `quotation-form.tsx`).
- **`src/ai/flows`**: Legacy folder name housing the `parseInvoiceText` regex logic. Note: The app no longer relies on external AI endpoints (like Gemini) to save costs and improve reliability.
- **`src/services`**: Firebase Firestore communication layers.

## Technologies Used

- **Next.js 15 (App Router)**
- **Firebase (Firestore, App Hosting, Auth)**
- **unpdf (PDF.js)** for serverless PDF parsing
- **Shadcn/ui & Tailwind CSS** for styling
- **TypeScript**
