# InvoiceFlow - Professional Invoice Management

InvoiceFlow is a robust, serverless-friendly web application designed to streamline the creation, management, and tracking of professional invoices, quotations, delivery challans, stock requests, and employee payslips. Built with Next.js 15, Firebase, and Tailwind CSS, it offers both intelligent offline PDF parsing and cloud-powered AI extractions to automate data entry.

## Key Features

### 🏢 NewRelic Operations Suite
A dedicated module for managing NewRelic operations, featuring:
- **Stock Request Management System:**
  - **Managers:** Create, edit, and track stock requests by Location, Brand, and Item. The system automatically pulls `caseSize` and `MRP` from the catalog. Purchase Cost (P.Cost) is intelligently tracked in the background but hidden from managerial view.
  - **Admins:** Centralized fulfillment dashboard. Admins can view aggregated financial metrics (**Total Pending Budget (MRP)** and **Total Pending Cost (P.Cost)**), fulfill partial or complete quantities, and instantly convert fulfilled requests into Delivery Challans.
- **Centralized Catalog & Pricing System:** Master catalog management combined with location-specific pricing. Automatically calculates exact Purchase Costs based on MRP and supplier discount percentages.
- **AI-Powered Challan Parsing:** Seamlessly extract line items, prices, and taxes from physical invoices using Google Gemini multimodal AI via Firebase AI Logic.
- **Tuckshop Tracking:** A fully reactive ledger with location-based filtering (Bangalore vs. Hyderabad) and an admin-only financial dashboard to track net profit and loss.
- **Role-Based Access Control (RBAC):** Distinct permissions for Superadmins, Admins, Managers, and Users, ensuring sensitive financial data (like Purchase Costs) is restricted.

### 📄 Document & Data Management
- **Offline PDF Parsing (Standard Invoices):** Extract key details like invoice numbers, dates, customer names, and line items directly from PDF invoices without sending data to third-party APIs (powered by `unpdf`).
- **Excel Bulk Import:** Automatically populate Quotations and Delivery Challans by uploading standard Excel spreadsheets.
- **Smart Contact Matching:** Advanced "Ship-To" matching logic that verifies both company names and location-specific address keywords to prevent false positives.
- **Dynamic Forms & PDF Generation:** Create, edit, and instantly preview professional PDFs for printing or sending to clients.

### ☁️ Cloud & Architecture
- **Secure Cloud Storage:** All documents are securely saved to Firebase Firestore, with real-time syncing and robust data structure.
- **Serverless-Optimized Architecture:** Specifically tuned for deployment on Firebase App Hosting, utilizing App Router API routes to safely bypass Next.js Server Action payload limits.

## Getting Started

To run this application locally, you will need Node.js (v20+), npm, and the Firebase CLI.

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2. **Configure Firebase & AI Credentials:**
    Ensure you have an active Firebase project. You will need to add your Firebase configuration and Gemini API Key to your environment variables (`.env.local`).
    ```bash
    GEMINI_API_KEY=your_api_key_here
    NEXT_PUBLIC_FIREBASE_API_KEY=your_key
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
    # ...other firebase config
    ```

3.  **Run the Development Server:**
    ```bash
    npm run dev
    ```

The application will be available at `http://localhost:9002` (or your configured port).

## Project Architecture

- **`src/app`**: Next.js App Router structure containing all main modules (invoices, quotations, challans, newrelic, payslips).
  - **`/newrelic/stock-request`**: Managerial facing UI to submit stock needs.
  - **`/newrelic/stock-requests-admin`**: Administrative dashboard for fulfilling requests and reviewing financial impact.
  - **`/newrelic/pricing`**: Administrative dashboard for calculating and assigning supplier discounts across locations.
- **`src/app/api/newrelic/parse-invoice`**: The dedicated AI endpoint for parsing NewRelic vendor invoices using the `@google/genai` SDK.
- **`src/app/api/extract-invoice`**: A lightweight REST API route that handles server-side text extraction for standard PDFs using `unpdf`.
- **`src/components`**: Reusable Shadcn UI components and complex form handlers (e.g., `invoice-form.tsx`, `newrelic-challan-form.tsx`).
- **`src/services`**: Firebase Firestore communication layers and role verification logic.
- **`scripts/sync-pricing.js`**: Maintenance script to synchronize catalog changes into the location-based pricing collections.

## Technologies Used

- **Next.js 15 (App Router)**
- **Firebase (Firestore, Auth, App Hosting)**
- **Google Gemini API** for unstructured image/PDF parsing
- **unpdf (PDF.js)** for lightweight text extraction
- **react-hook-form & Zod** for robust form state management and payload validation
- **Shadcn/ui & Tailwind CSS** for styling
- **TypeScript**
