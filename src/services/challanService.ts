
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, runTransaction, serverTimestamp, query, orderBy, updateDoc, deleteDoc, writeBatch, getDoc, Timestamp } from 'firebase/firestore';
import { assertWritePermission } from '@/lib/readOnlyGuard';

export interface ChallanLineItem {
  id: number;
  name: string;
  hsnCode: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  mrp?: number;
  procurementCost?: number;
  marginPercent?: number;
}

export interface Challan {
  id?: string;
  dcNumber: string;
  dcDate: string; // Storing date as ISO string
  lineItems: ChallanLineItem[];
  subtotal: number;
  gstAmount: number;
  shipping: number;
  other: number;
  total: number;
  note?: string;
  createdAt?: any;
  updatedAt?: any;

  companyProfileId?: string;

  billToName?: string;
  billToAddress?: string;
  shipToName?: string;
  shipToAddress?: string;

  createdBy?: string;
  creatorEmail?: string;
  creatorName?: string;
  updatedBy?: string;

  // Modern Financials (like NewRelic)
  procurementCost?: number;
  commissionRate?: number;
  commissionAmount?: number;
  revenue?: number;
  grossProfit?: number;
  marginPercent?: number;

  // Internal Expenses (Private - Not sent to client, used for profit calculation)
  transportCost?: number;
  transportationExpense?: number;
  otherExpense?: number;

  // Document Attachments
  signedCopyUrls?: string[];
  goodsReceivedInvoiceUrls?: string[];
}

const CHALLANS_COLLECTION = 'challans';
const COUNTER_DOCUMENT = 'challanCounter';

async function getNextChallanNumber(prefix: string): Promise<string> {
  const counterRef = doc(db, 'counters', COUNTER_DOCUMENT);

  try {
    const newChallanNumber = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      let nextNumber = 1;
      if (counterDoc.exists()) {
        const data = counterDoc.data();
        const currentNumber = data?.currentNumber ?? 0;
        nextNumber = currentNumber + 1;
      }
      transaction.set(counterRef, { currentNumber: nextNumber }, { merge: true });
      return nextNumber;
    });

    // Format to TGG/SL/24-25/2210 style, assuming prefix is TGG/SL/ and we need to format number
    const year = new Date().getFullYear().toString().slice(-2);
    const nextYear = (parseInt(year) + 1).toString();
    // This is a simplified version. A real app might need more robust logic for the number part.
    return `${prefix}${year}-${nextYear}/${newChallanNumber}`;

  } catch (error) {
    console.error("Error in getNextChallanNumber transaction:", error);
    throw new Error("Failed to generate a new challan number.");
  }
}


export async function saveChallan(challan: Omit<Challan, 'dcNumber' | 'createdAt'> & { id?: string }): Promise<Challan> {
  await assertWritePermission('Saving Delivery Challan');
  try {
    let finalChallanData: any;
    let docRef;

    if (challan.id) {
      // Update existing challan
      docRef = doc(db, CHALLANS_COLLECTION, challan.id);
      const { id, ...challanData } = challan;
      await updateDoc(docRef, {
        ...challanData,
        updatedAt: serverTimestamp(),
      });
      const updatedDocSnap = await getDoc(docRef);
      finalChallanData = { id: challan.id, ...updatedDocSnap.data() };
    } else {
      // Create new challan
      const prefix = "TGG/SL/";
      const newChallanNumber = await getNextChallanNumber(prefix);
      const { id, ...challanData } = challan;
      const completeChallanData = {
        ...challanData,
        dcNumber: newChallanNumber,
        createdAt: serverTimestamp(),
        createdBy: challanData.createdBy || 'Satya',
        creatorEmail: challanData.creatorEmail || 'satya@tgg.in',
        creatorName: challanData.creatorName || 'Satya',
      };
      docRef = await addDoc(collection(db, CHALLANS_COLLECTION), completeChallanData);

      const newDocSnap = await getDoc(docRef);
      finalChallanData = { id: docRef.id, ...newDocSnap.data() };
    }

    const serializableChallan: Challan = {
      ...finalChallanData,
      dcNumber: finalChallanData.dcNumber,
      dcDate: finalChallanData.dcDate instanceof Timestamp ? finalChallanData.dcDate.toDate().toISOString() : new Date(finalChallanData.dcDate).toISOString(),
      createdAt: finalChallanData.createdAt instanceof Timestamp ? finalChallanData.createdAt.toDate().toISOString() : (finalChallanData.createdAt ? new Date(finalChallanData.createdAt).toISOString() : new Date().toISOString()),
      updatedAt: finalChallanData.updatedAt instanceof Timestamp ? finalChallanData.updatedAt.toDate().toISOString() : undefined,
    };

    return serializableChallan;

  } catch (e) {
    console.error("Error adding/updating document: ", e);
    const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
    throw new Error(`Failed to save challan: ${errorMessage}`);
  }
}


export async function getChallans(): Promise<Challan[]> {
  try {
    console.log("Fetching challans from Firestore...");
    const q = query(collection(db, CHALLANS_COLLECTION), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const challans: Challan[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();

      // Safe date handling
      let dDate: string;
      try {
        if (data.dcDate instanceof Timestamp) {
          dDate = data.dcDate.toDate().toISOString();
        } else if (data.dcDate) {
          dDate = new Date(data.dcDate).toISOString();
        } else {
          dDate = new Date().toISOString();
        }
      } catch (e) {
        dDate = new Date().toISOString();
      }

      let cAt: string | undefined;
      try {
        if (data.createdAt instanceof Timestamp) {
          cAt = data.createdAt.toDate().toISOString();
        } else if (data.createdAt) {
          cAt = new Date(data.createdAt).toISOString();
        }
      } catch (e) { }

      let uAt: string | undefined;
      try {
        if (data.updatedAt instanceof Timestamp) {
          uAt = data.updatedAt.toDate().toISOString();
        } else if (data.updatedAt) {
          uAt = new Date(data.updatedAt).toISOString();
        }
      } catch (e) { }

      // Line items with P.Cost & margin
      const lineItems: ChallanLineItem[] = (data.lineItems || []).map((item: any, idx: number) => {
        const qty = Number(item.quantity) || 0;
        const uPrice = Number(item.unitPrice) || 0;
        const pCost = item.procurementCost !== undefined && item.procurementCost !== null ? Number(item.procurementCost) : 0;
        const marginPct = uPrice > 0 ? ((uPrice - pCost) / uPrice) * 100 : 0;
        return {
          id: item.id || Date.now() + idx,
          name: item.name || '',
          hsnCode: item.hsnCode || '',
          unit: item.unit || '',
          quantity: qty,
          unitPrice: uPrice,
          total: Number(item.total) || qty * uPrice,
          mrp: item.mrp ? Number(item.mrp) : uPrice,
          procurementCost: pCost,
          marginPercent: marginPct,
        };
      });

      const subtotal = Number(data.subtotal) || lineItems.reduce((acc, i) => acc + i.total, 0);
      const computedPCost = lineItems.reduce((acc, i) => acc + ((i.procurementCost || 0) * i.quantity), 0);
      const procurementCost = data.procurementCost !== undefined && data.procurementCost !== null
        ? Number(data.procurementCost)
        : computedPCost;

      const commRate = data.commissionRate !== undefined && data.commissionRate !== null ? Number(data.commissionRate) : 5.5;
      const commissionAmount = data.commissionAmount !== undefined && data.commissionAmount !== null
        ? Number(data.commissionAmount)
        : (subtotal * commRate) / 100;

      const transportExp = Number(data.transportationExpense ?? data.transportCost) || 0;
      const otherExp = Number(data.otherExpense) || 0;
      const totalExpenses = procurementCost + transportExp + otherExp;

      const revenue = subtotal - commissionAmount;
      const grossProfit = data.grossProfit !== undefined && data.grossProfit !== null
        ? Number(data.grossProfit)
        : (revenue - totalExpenses);
      const marginPercent = subtotal > 0 ? (grossProfit / subtotal) * 100 : 0;

      challans.push({
        id: doc.id,
        ...data,
        lineItems,
        subtotal,
        procurementCost,
        commissionRate: commRate,
        commissionAmount,
        transportCost: transportExp,
        transportationExpense: transportExp,
        otherExpense: otherExp,
        revenue,
        grossProfit,
        marginPercent,
        dcDate: dDate,
        createdAt: cAt,
        updatedAt: uAt,
        createdBy: data.createdBy || data.creatorEmail || 'Satya',
        creatorEmail: data.creatorEmail || (data.createdBy?.includes('@') ? data.createdBy : 'satya@tgg.in'),
        creatorName: data.creatorName || (data.createdBy?.includes('@') ? data.createdBy.split('@')[0] : (data.createdBy || 'Satya')),
        signedCopyUrls: data.signedCopyUrls || [],
        goodsReceivedInvoiceUrls: data.goodsReceivedInvoiceUrls || [],
      } as Challan);
    });

    console.log(`Successfully fetched ${challans.length} challans.`);
    return JSON.parse(JSON.stringify(challans));
  } catch (error) {
    console.error("Error in getChallans:", error);
    return [];
  }
}

export async function addChallanAttachment(
  challanId: string,
  url: string,
  type: 'signed_copy' | 'invoice',
  userEmail?: string | null
): Promise<void> {
  const docRef = doc(db, CHALLANS_COLLECTION, challanId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error('Challan not found');

  const data = docSnap.data();
  const fieldName = type === 'signed_copy' ? 'signedCopyUrls' : 'goodsReceivedInvoiceUrls';
  const currentUrls: string[] = data[fieldName] || [];

  await updateDoc(docRef, {
    [fieldName]: [...currentUrls, url],
    updatedAt: serverTimestamp(),
    updatedBy: userEmail || 'Admin',
  });
}

export async function removeChallanAttachment(
  challanId: string,
  urlToRemove: string,
  type: 'signed_copy' | 'invoice',
  userEmail?: string | null
): Promise<void> {
  const docRef = doc(db, CHALLANS_COLLECTION, challanId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error('Challan not found');

  const data = docSnap.data();
  const fieldName = type === 'signed_copy' ? 'signedCopyUrls' : 'goodsReceivedInvoiceUrls';
  const currentUrls: string[] = data[fieldName] || [];

  await updateDoc(docRef, {
    [fieldName]: currentUrls.filter(u => u !== urlToRemove),
    updatedAt: serverTimestamp(),
    updatedBy: userEmail || 'Admin',
  });
}

export async function deleteChallan(id: string): Promise<void> {
  await assertWritePermission('Deleting Delivery Challan');
  try {
    const docRef = doc(db, CHALLANS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (e) {
    console.error("Error deleting document: ", e);
    throw new Error("Failed to delete challan.");
  }
}

export async function deleteChallans(ids: string[]): Promise<void> {
  await assertWritePermission('Bulk Deleting Delivery Challans');
  try {
    const batch = writeBatch(db);
    ids.forEach(id => {
      const docRef = doc(db, CHALLANS_COLLECTION, id);
      batch.delete(docRef);
    });
    await batch.commit();
  } catch (e) {
    console.error("Error deleting documents in batch: ", e);
    throw new Error("Failed to delete challans.");
  }
}
