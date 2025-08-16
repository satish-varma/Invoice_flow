# InvoiceFlow - Professional Invoice Management

InvoiceFlow is a modern, web-based application designed to streamline the process of creating, managing, and tracking professional invoices. Built with Next.js, Firebase, and Genkit, it offers a user-friendly interface for generating invoices from scratch or automatically extracting data from uploaded images using AI.

## Key Features

- **AI-Powered Data Extraction:** Automatically populate invoice fields by simply uploading an image of an invoice. The AI agent extracts key details like invoice number, customer name, date, and line items.
- **Dynamic Invoice Form:** Create and edit invoices with an intuitive form that supports multiple line items, tax calculations, and customer details.
- **Secure Cloud Storage:** All invoices are securely saved to Firebase Firestore, allowing you to access them from anywhere.
- **PDF Generation & Download:** Generate professional-looking PDF versions of your invoices for printing or sending to clients.
- **Invoice Previews:** Instantly preview how your final invoice will look before saving or downloading.
- **Saved Invoices Management:** View, filter, and sort all your saved invoices in a clean, organized data table.
- **Responsive Design:** The application is fully responsive and works seamlessly on desktops, tablets, and mobile devices.

## Getting Started

To run this application locally, you will need to have Node.js, npm, and the Firebase CLI installed.

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2. **Deploy Firestore Rules:**
   The application requires open access to Firestore for development. You need to deploy the included security rules.
   First, log in to Firebase:
   ```bash
   firebase login
   ```
   Then, deploy the rules:
   ```bash
   firebase deploy --only firestore
   ```
   **Note:** These rules are insecure and should not be used in a production environment.

3.  **Run the Development Server:**
    ```bash
    npm run dev
    ```

The application will be available at `http://localhost:9002`.

## Project Structure

- **`src/app`**: Contains the main pages of the application, built using the Next.js App Router.
  - **`src/app/page.tsx`**: The main invoice creation page.
  - **`src/app/invoices`**: The page for viewing and managing saved invoices.
- **`src/components`**: Reusable React components used throughout the application.
  - **`src/components/invoice-form.tsx`**: The primary form for creating and editing invoices.
  - **`src/components/invoice-preview.tsx`**: The component that renders the final invoice layout for previews and PDF generation.
  - **`src/components/ui`**: UI components from `shadcn/ui`.
- **`src/ai`**: Contains the AI-related logic, powered by Genkit.
  - **`src/ai/flows/extract-invoice-flow.ts`**: The Genkit flow that defines the AI agent for extracting data from invoice images.
- **`src/services`**: Handles communication with backend services, primarily Firebase Firestore.
  - **`src/services/invoiceService.ts`**: Contains functions for saving and retrieving invoices from Firestore.
- **`src/lib`**: Utility functions and Firebase configuration.
  - **`src/lib/firebase.ts`**: Initializes the Firebase SDK.

## Technologies Used

- **Next.js:** React framework for building the user interface.
- **Firebase:** Backend services, including Firestore for database storage.
- **Genkit:** AI framework for building the data extraction flow.
- **Shadcn/ui:** A collection of beautifully designed UI components.
- **Tailwind CSS:** For styling the application.
- **TypeScript:** For type-safe code.
