# **App Name**: InvoiceFlow

## Core Features:

- Invoice Details Input: Provide input fields for invoice number, customer name, and date, with the date defaulting to the current date.
- Dynamic Line Items: Implement a dynamic table for adding, entering, and removing invoice items.
- Real-time Calculations: Calculate and display the subtotal, tax (fixed 10%), and total amount in real-time.
- PDF Generation: Enable users to download the invoice as a PDF file, converting the HTML invoice into a PDF document using html2canvas and jsPDF.
- Form Management: Allow users to reset all input fields and calculations to their initial state with a 'Clear Form' button.

## Style Guidelines:

- Primary color: Deep indigo (#3F51B5) for a professional and trustworthy feel.
- Background color: Light gray (#F0F2F5), a very light tint of the primary hue to ensure readability.
- Accent color: Teal (#009688) to provide contrast to the primary and create a fresh feeling for calls to action.
- Body and headline font: 'Inter', a grotesque-style sans-serif font, to give a machined, objective, neutral look, perfect for invoices
- Use a clean, well-spaced layout to present information clearly. Prioritize readability and ease of use with Tailwind CSS.
- Incorporate subtle animations for user interactions, such as adding or removing line items, to enhance user experience.