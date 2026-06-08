
'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, runTransaction, serverTimestamp, query, orderBy, updateDoc, deleteDoc, getDoc, Timestamp } from 'firebase/firestore';

export interface PayslipEarning {
    label: string;
    amount: number;
}

export interface PayslipDeduction {
    label: string;
    amount: number;
}

export interface Payslip {
    id?: string;
    payslipNumber: string;
    payPeriodMonth: number;  // 1–12
    payPeriodYear: number;
    payDate: string;         // ISO date string

    // Employee Details
    employeeName: string;
    employeeId: string;
    designation: string;
    department: string;
    bankAccount?: string;
    panNumber?: string;
    pfNumber?: string;

    // Earnings
    earnings: PayslipEarning[];
    grossEarnings: number;

    // Deductions
    deductions: PayslipDeduction[];
    totalDeductions: number;

    // Net Pay
    netPay: number;

    // Attendance
    workingDays: number;
    paidDays: number;
    lopDays: number;

    companyProfileId?: string;
    createdAt?: any;
}

const PAYSLIPS_COLLECTION = 'payslips';
const COUNTER_DOCUMENT = 'payslipCounter';

async function getNextPayslipNumber(): Promise<string> {
    const counterRef = doc(db, 'counters', COUNTER_DOCUMENT);
    const nextNum = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        const next = (counterDoc.exists() ? (counterDoc.data()?.currentNumber ?? 0) : 0) + 1;
        transaction.set(counterRef, { currentNumber: next }, { merge: true });
        return next;
    });
    const year = new Date().getFullYear().toString().slice(-2);
    return `TGG/PAY/${year}/${String(nextNum).padStart(4, '0')}`;
}

export async function savePayslip(payslip: Omit<Payslip, 'payslipNumber' | 'createdAt'> & { id?: string }): Promise<Payslip> {
    let finalData: any;

    if (payslip.id) {
        const docRef = doc(db, PAYSLIPS_COLLECTION, payslip.id);
        const { id, ...data } = payslip;
        await updateDoc(docRef, data);
        const snap = await getDoc(docRef);
        finalData = { id: payslip.id, ...snap.data() };
    } else {
        const payslipNumber = await getNextPayslipNumber();
        const { id, ...data } = payslip;
        const docRef = await addDoc(collection(db, PAYSLIPS_COLLECTION), {
            ...data,
            payslipNumber,
            createdAt: serverTimestamp(),
        });
        const snap = await getDoc(docRef);
        finalData = { id: docRef.id, ...snap.data() };
    }

    return {
        ...finalData,
        payDate: finalData.payDate instanceof Timestamp ? finalData.payDate.toDate().toISOString() : (finalData.payDate || ''),
        createdAt: finalData.createdAt instanceof Timestamp ? finalData.createdAt.toDate().toISOString() : new Date().toISOString(),
    };
}

export async function getPayslips(): Promise<Payslip[]> {
    const q = query(collection(db, PAYSLIPS_COLLECTION), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            ...data,
            payDate: data.payDate instanceof Timestamp ? data.payDate.toDate().toISOString() : (data.payDate || ''),
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        } as Payslip;
    });
}

export async function deletePayslip(id: string): Promise<void> {
    await deleteDoc(doc(db, PAYSLIPS_COLLECTION, id));
}
