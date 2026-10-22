import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, getDocs, writeBatch, doc, getDoc, updateDoc } from "firebase/firestore";
import { firebaseConfig } from "../src/firebase/config";
import { getFinancialYear } from "../src/services/invoiceService";

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

async function runMigration() {
  console.log("Starting Financial Year 26-27 migration for invoices and settings in Firestore...");

  // 1. Update companyProfiles invoicePrefix in settings/invoiceDefaults
  const settingsDocRef = doc(db, "settings", "invoiceDefaults");
  const settingsSnap = await getDoc(settingsDocRef);
  if (settingsSnap.exists()) {
    const data = settingsSnap.data();
    if (data.companyProfiles && Array.isArray(data.companyProfiles)) {
      let updated = false;
      const updatedProfiles = data.companyProfiles.map((p: any) => {
        if (p.invoicePrefix && p.invoicePrefix.includes("25-26")) {
          updated = true;
          return {
            ...p,
            invoicePrefix: p.invoicePrefix.replace("25-26", "26-27"),
          };
        }
        return p;
      });
      if (updated) {
        await updateDoc(settingsDocRef, { companyProfiles: updatedProfiles });
        console.log("Updated settings/invoiceDefaults companyProfiles invoicePrefix to 26-27");
      }
    }
  }

  // 2. Scan and update invoices
  const invoicesCol = collection(db, "invoices");
  const snapshot = await getDocs(invoicesCol);

  console.log(`Found ${snapshot.size} total invoice documents.`);

  let updatedCount = 0;
  let skippedCount = 0;
  const updates: Array<{ id: string; oldNumber: string; newNumber: string }> = [];

  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const date = data.date;
    const fy = getFinancialYear(date);
    const invoiceNumber = data.invoiceNumber || "";

    if (fy === "26-27" && invoiceNumber.includes("25-26")) {
      const newInvoiceNumber = invoiceNumber.replace("25-26", "26-27");
      updates.push({
        id: docSnap.id,
        oldNumber: invoiceNumber,
        newNumber: newInvoiceNumber,
      });
      updatedCount++;
    } else {
      skippedCount++;
    }
  });

  console.log(`Invoices to update to 26-27: ${updatedCount}`);
  console.log(`Invoices kept as 25-26 (or already up-to-date): ${skippedCount}`);

  if (updates.length === 0) {
    console.log("No invoice updates needed.");
    return;
  }

  // Batch writes in chunks of 400
  const BATCH_SIZE = 400;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = updates.slice(i, i + BATCH_SIZE);

    chunk.forEach((item) => {
      const docRef = doc(db, "invoices", item.id);
      batch.update(docRef, { invoiceNumber: item.newNumber });
    });

    await batch.commit();
    console.log(`Committed batch ${Math.floor(i / BATCH_SIZE) + 1} (${chunk.length} invoices updated).`);
  }

  console.log("Migration complete!");
}

runMigration()
  .then(() => {
    console.log("All done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
