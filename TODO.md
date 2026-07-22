# InvoiceFlow - Future Enhancements & TODOs

## Automation Ideas

- [ ] **The "Ghost Assistant" (Local Folder Watcher)**
  - **Goal:** Eliminate the manual steps of uploading POs into the InvoiceFlow app.
  - **Concept:** A background script (Node.js or Python) that runs locally on the user's Mac and monitors the `~/Downloads` folder.
  - **Workflow:** 
    1. When a new Hungerbox PO PDF is downloaded, the script instantly detects it.
    2. It automatically processes the PDF, extracts the data, and generates the final Invoice PDF using the InvoiceFlow logic.
    3. It saves the final invoice back to the `Downloads` folder as `READY_TO_UPLOAD_INVOICE.pdf`.
    4. The user simply downloads the PO from Hungerbox and immediately uploads the generated invoice back to Hungerbox, entirely skipping the manual interaction with the InvoiceFlow UI.
