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

### 📱 Mobile PWA & Native Android (Capacitor)
- **Native Android APK & Emulator:** Packaged with **Capacitor 8** (`com.gutguru.invoiceflow`) with full hardware access, camera permissions, and Chrome remote inspection support (`chrome://inspect`).
- **Tactile Haptic Feedback Engine (`src/lib/haptics.ts`):** Micro-vibrations across tabs, quantity steppers, quick edits, camera shutter button, and confirmations.
- **Offline & Weak Connection Toast:** Automatic network status banner alerting staff in basements/cold storages before form submissions or photo uploads.
- **Single-Thumb Navigation:** Material 3 / iOS 18 style bottom capsule bar (`mobile-app-navigation.tsx`) optimized for cafeteria floor operators.
- **Tap-to-Expand Mobile Cards & Web Share:** Challans feed allows inline inspection of line items without modal popups and 1-tap WhatsApp / native document sharing.
- **Selfie Attendance & Live Shutter:** Front-camera selfie check-in with GPS geo-tagging, live digital shift timer, and automated shift duration calculations.

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

3.  **Run the Web Development Server:**
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:9002` (or your configured port).

4.  **Run & Build the Native Android App (Capacitor):**
    ```bash
    # Sync web build and plugins into android project
    npm run cap:sync

    # Open Android project in Android Studio
    npm run cap:open:android

    # Build debug APK via Gradle directly
    npm run cap:build:android
    ```
    *Debug APK will be generated at:* `android/app/build/outputs/apk/debug/app-debug.apk`

## Project Architecture

- **`src/app`**: Next.js App Router structure containing all main modules (invoices, quotations, challans, newrelic, payslips).
  - **`/newrelic`**: Main Delivery Challans hub with segmented location switching, 1-row stats, and role-based cycle presets.
  - **`/newrelic/attendance`**: Selfie check-in/out attendance tracking, location shift rules, and staff monthly payroll calculation.
  - **`/newrelic/stock-request`**: Managerial facing UI to submit stock needs with touch quantity steppers.
  - **`/newrelic/stock-requests-admin`**: Administrative dashboard for fulfilling requests and reviewing financial impact.
  - **`/newrelic/pricing`**: Administrative dashboard for calculating and assigning supplier discounts across locations.
  - **`/newrelic/catalog`**: Master item catalog with single-field inline editing for Case Sizes and MRPs.
- **`src/app/api/newrelic/parse-invoice`**: The dedicated AI endpoint for parsing NewRelic vendor invoices using the `@google/genai` SDK.
- **`src/app/api/extract-invoice`**: A lightweight REST API route that handles server-side text extraction for standard PDFs using `unpdf`.
- **`src/components`**: Reusable Shadcn UI components, forms, and mobile interfaces (`mobile-app-navigation.tsx`, `network-status-indicator.tsx`, `newrelic-challan-list.tsx`).
- **`src/services`**: Firebase Firestore communication layers and role verification logic.
- **`src/lib/haptics.ts`**: Universal cross-platform haptic feedback engine for tactile user interactions.
- **`android`**: Native Android project wrapper generated and synchronized by Capacitor CLI.

## Technologies Used

- **Next.js 15 (App Router)**
- **Capacitor 8** (Android native app bridge)
- **Firebase (Firestore, Auth, Storage, App Hosting)**
- **Google Gemini API** for unstructured image/PDF parsing
- **unpdf (PDF.js)** for lightweight text extraction
- **react-hook-form & Zod** for robust form state management and payload validation
- **Shadcn/ui & Tailwind CSS** for styling
- **TypeScript**
