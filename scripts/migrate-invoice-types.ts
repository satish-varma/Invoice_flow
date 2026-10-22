import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, getDocs, writeBatch, doc } from "firebase/firestore";
import { firebaseConfig } from "../src/firebase/config";
import { determineInvoiceType, InvoiceType } from "../src/services/invoiceService";

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

async function runMigration() {
  console.log("Starting invoiceType migration for all invoices in Firestore...");

  const invoicesCol = collection(db, "invoices");
  const snapshot = await getDocs(invoicesCol);

  console.log(`Found ${snapshot.size} total invoice documents.`);

  let mrpCount = 0;
  let nonMrpCount = 0;
  let alreadyUpdatedCount = 0;
  let needsUpdateCount = 0;

  const updates: Array<{ id: string; invoiceNumber: string; invoiceType: InvoiceType }> = [];

  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const computedType = determineInvoiceType(data);

    if (computedType === "MRP") {
      mrpCount++;
    } else {
      nonMrpCount++;
    }

    if (data.invoiceType !== computedType) {
      needsUpdateCount++;
      updates.push({
        id: docSnap.id,
        invoiceNumber: data.invoiceNumber || docSnap.id,
        invoiceType: computedType,
      });
    } else {
      alreadyUpdatedCount++;
    }
  });

  console.log(`\nClassification Summary:`);
  console.log(`  - Total Invoices: ${snapshot.size}`);
  console.log(`  - MRP Invoices: ${mrpCount}`);
  console.log(`  - NON-MRP Invoices: ${nonMrpCount}`);
  console.log(`  - Already up-to-date: ${alreadyUpdatedCount}`);
  console.log(`  - Documents to update: ${needsUpdateCount}`);

  if (updates.length === 0) {
    console.log("\nAll documents are already up to date. No writes needed!");
    return;
  }

  // Process in batches of 200
  const BATCH_SIZE = 200;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const chunk = updates.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    chunk.forEach((item) => {
      const docRef = doc(db, "invoices", item.id);
      batch.update(docRef, { invoiceType: item.invoiceType });
    });

    console.log(`Committing batch ${Math.floor(i / BATCH_SIZE) + 1} (${chunk.length} documents)...`);
    await batch.commit();
    console.log(`Successfully committed batch ${Math.floor(i / BATCH_SIZE) + 1}.`);
  }

  console.log("\n--- VERIFICATION PASS ---");
  const verifySnapshot = await getDocs(invoicesCol);
  let verifiedMrp = 0;
  let verifiedNonMrp = 0;
  let missingType = 0;

  verifySnapshot.docs.forEach((d) => {
    const data = d.data();
    if (data.invoiceType === "MRP") verifiedMrp++;
    else if (data.invoiceType === "NON-MRP") verifiedNonMrp++;
    else missingType++;
  });

  console.log(`Verified Firestore state:`);
  console.log(`  - Total: ${verifySnapshot.size}`);
  console.log(`  - MRP: ${verifiedMrp}`);
  console.log(`  - NON-MRP: ${verifiedNonMrp}`);
  console.log(`  - Missing: ${missingType}`);

  if (missingType === 0) {
    console.log("\nSUCCESS: All invoices in Firestore now have invoiceType properly populated!");
  } else {
    console.warn(`\nWARNING: ${missingType} documents still missing invoiceType.`);
  }
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
