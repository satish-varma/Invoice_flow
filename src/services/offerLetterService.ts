
'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, runTransaction, serverTimestamp, query, orderBy, updateDoc, deleteDoc, writeBatch, getDoc, Timestamp } from 'firebase/firestore';

export interface OfferLetter {
    id?: string;
    offerNumber: string;
    offerDate: string;
    
    // Employee Details
    employeeName: string;
    employeeAddress: string;
    employeeEmail: string;
    
    // Position Details
    position: string;
    proposedStartDate: string;
    compensation: number; // Annual CTC
    probationPeriod: string; // e.g., "3 months"
    
    // Terms
    workHours?: string; // e.g., "9:00 AM to 6:00 PM, 4 working days in a week"
    noticePeriodProbation?: string; // e.g., "15 days"
    noticePeriodPostConfirmation?: string; // e.g., "30 days"
    annualLeaves?: number; // e.g., 12
    
    customTerms?: string;
    createdAt?: any;
    
    companyProfileId?: string; 
}

const OFFER_LETTERS_COLLECTION = 'offerLetters';
const COUNTER_DOCUMENT = 'offerLetterCounter';

async function getNextOfferNumber(prefix: string): Promise<string> {
    const counterRef = doc(db, 'counters', COUNTER_DOCUMENT);

    try {
        const nextNumber = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let nextNumberValue = 1;
            if (counterDoc.exists()) {
                const data = counterDoc.data();
                const currentNumber = data?.currentNumber ?? 0;
                nextNumberValue = currentNumber + 1;
            }
            transaction.set(counterRef, { currentNumber: nextNumberValue }, { merge: true });
            return nextNumberValue;
        });
        
        const year = new Date().getFullYear();
        return `${prefix}${year}/${nextNumber}`;

    } catch (error) {
        console.error("Error in getNextOfferNumber transaction:", error);
        throw new Error("Failed to generate a new offer letter number.");
    }
}

export async function saveOfferLetter(offer: Omit<OfferLetter, 'offerNumber' | 'createdAt'> & {id?: string}): Promise<OfferLetter> {
  try {
    let finalOfferData: any;
    let newOfferNumber: string | null = null;

    if (offer.id) {
      const docRef = doc(db, OFFER_LETTERS_COLLECTION, offer.id);
      const { id, ...offerData } = offer;
      await updateDoc(docRef, {
        ...offerData,
      });
      const updatedDocSnap = await getDoc(docRef);
      finalOfferData = { id: offer.id, ...updatedDocSnap.data() };
    } else {
      const prefix = "TGG/OFFER/";
      newOfferNumber = await getNextOfferNumber(prefix);
      const { id, ...offerData } = offer;
      const completeOfferData = {
        ...offerData,
        offerNumber: newOfferNumber,
        createdAt: serverTimestamp(),
      }
      const docRef = await addDoc(collection(db, OFFER_LETTERS_COLLECTION), completeOfferData);
      const newDocSnap = await getDoc(docRef);
      finalOfferData = { id: docRef.id, ...newDocSnap.data() };
    }

    return {
      ...finalOfferData,
      offerDate: finalOfferData.offerDate instanceof Timestamp ? finalOfferData.offerDate.toDate().toISOString() : new Date(finalOfferData.offerDate).toISOString(),
      proposedStartDate: finalOfferData.proposedStartDate instanceof Timestamp ? finalOfferData.proposedStartDate.toDate().toISOString() : new Date(finalOfferData.proposedStartDate).toISOString(),
      createdAt: finalOfferData.createdAt instanceof Timestamp ? finalOfferData.createdAt.toDate().toISOString() : new Date().toISOString(),
    };

  } catch (e) {
    console.error("Error adding/updating document: ", e);
    throw new Error(`Failed to save offer letter.`);
  }
}

export async function getOfferLetters(): Promise<OfferLetter[]> {
    const q = query(collection(db, OFFER_LETTERS_COLLECTION), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const offerLetters: OfferLetter[] = [];
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        offerLetters.push({ 
            id: doc.id,
            ...data,
            offerDate: data.offerDate ? (data.offerDate instanceof Timestamp ? data.offerDate.toDate().toISOString() : new Date(data.offerDate).toISOString()) : '',
            proposedStartDate: data.proposedStartDate ? (data.proposedStartDate instanceof Timestamp ? data.proposedStartDate.toDate().toISOString() : new Date(data.proposedStartDate).toISOString()) : '',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        } as OfferLetter);
    });
    return offerLetters;
}

export async function deleteOfferLetter(id: string): Promise<void> {
    const docRef = doc(db, OFFER_LETTERS_COLLECTION, id);
    await deleteDoc(docRef);
}
