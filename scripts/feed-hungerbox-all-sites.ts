import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// 1. Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

// 2. Initialize Turso
const turso = createClient({
  url: process.env.TURSO_DATABASE_URL || 'libsql://thegutguru-tracker-satish-varma.aws-ap-south-1.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

export const HUNGERBOX_CLIENT_ID = '2c0939632f65c1d362ee68675a7757b4';

export interface SiteSyncConfig {
  siteId: 'ntt_data' | 'dsm' | 'newrelic';
  companyId: number;
  siteName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  vendors: number[];
  locations: number[];
}

export const SITES: SiteSyncConfig[] = [
  {
    siteId: 'newrelic',
    companyId: 665,
    siteName: 'NewRelic',
    startDate: '2026-09-01',
    endDate: '2026-11-06',
    vendors: [31127, 31142],
    locations: [2849, 3123],
  },
  {
    siteId: 'ntt_data',
    companyId: 299,
    siteName: 'NTT Data',
    startDate: '2026-07-20',
    endDate: '2026-11-06',
    vendors: [30225],
    locations: [3070],
  },
  {
    siteId: 'dsm',
    companyId: 403,
    siteName: 'DSM',
    startDate: '2025-06-15',
    endDate: '2026-11-06',
    vendors: [23221],
    locations: [1992, 139, 2292],
  },
];

// Helper: Split a date range into chunks of at most 80 days (to stay safely within HungerBox 3-month limit)
function splitDateRange(startDate: string, endDate: string, maxDays = 80): { from: string; to: string }[] {
  const chunks: { from: string; to: string }[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  let currentStart = new Date(start);

  while (currentStart <= end) {
    const currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + maxDays - 1);

    const actualEnd = currentEnd > end ? end : currentEnd;

    const fromStr = currentStart.toISOString().split('T')[0];
    const toStr = actualEnd.toISOString().split('T')[0];
    chunks.push({ from: fromStr, to: toStr });

    currentStart = new Date(actualEnd);
    currentStart.setDate(currentStart.getDate() + 1);
  }

  return chunks;
}

// Format ordinal date: "1st-jan-26"
export function formatOrdinalDate(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const parts = clean.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parts[0].slice(-2);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(day) || monthIdx < 0 || monthIdx > 11) return dateStr;

  const getSuffix = (n: number) => {
    if (n >= 11 && n <= 13) return 'th';
    switch (n % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  return `${day}${getSuffix(day)}-${months[monthIdx]}-${year}`;
}

// Convert Excel serial number to YYYY-MM-DD
function parseOrderDate(rawDate: any): string {
  if (!rawDate) return '';
  const str = String(rawDate).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }
  const num = parseFloat(str);
  if (!isNaN(num) && num > 40000 && num < 60000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + num * 86400000);
    return d.toISOString().substring(0, 10);
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().substring(0, 10);
  }
  return str.substring(0, 10);
}

// Authenticate with HungerBox
async function getHungerBoxToken(): Promise<string> {
  const username = process.env.HUNGERBOX_USERNAME || 'the_gut_guru';
  const password = process.env.HUNGERBOX_PASSWORD || 'hungerbox@123';

  const res = await fetch('https://admin.hungerbox.com/api/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'password',
      client_id: HUNGERBOX_CLIENT_ID,
      client_secret: '',
      username,
      password,
    }),
  });

  if (!res.ok) {
    throw new Error(`Authentication failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.access_token;
}

// Parse CSV manually or safely
function parseCsvRows(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Parse header
  const parseLine = (line: string): string[] => {
    const values: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuote = !inQuote;
      } else if (c === ',' && !inQuote) {
        values.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    values.push(cur.trim());
    return values.map((v) => v.replace(/^"|"$/g, '').trim());
  };

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] !== undefined ? values[j] : '';
    }
    rows.push(row);
  }

  return rows;
}

// Pull HBR2 report for a chunk
async function pullHbr2Chunk(
  token: string,
  site: SiteSyncConfig,
  from: string,
  to: string
): Promise<Record<string, string>[]> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Currentcompany: String(site.companyId),
    Companyid: String(site.companyId),
    'Content-Type': 'application/json',
  };

  const options = [
    { type: 'timestamp', label: 'From Date', key: '#fromDate', value: from, from_tz: 'Asia/Kolkata', to_tz: 'Asia/Kolkata' },
    { type: 'timestamp', label: 'To Date', key: '#toDate', value: to, from_tz: 'Asia/Kolkata', to_tz: 'Asia/Kolkata' },
    { type: 'vendor', label: 'Select Vendors', key: '#vendors', value: site.vendors },
    { type: 'location', label: 'Select Cafeteria', key: '#locations', value: site.locations },
  ];

  console.log(`  Scheduling HBR2 [${site.siteName}] ${from} to ${to}...`);
  const schedRes = await fetch('https://admin.hungerbox.com/api/report/schedule', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      companyId: site.companyId,
      options: JSON.stringify(options),
      reportRef: 'HBR2',
    }),
  });

  if (!schedRes.ok) {
    const err = await schedRes.text();
    throw new Error(`Schedule failed (${schedRes.status}): ${err}`);
  }

  const schedJson = await schedRes.json();
  const reportId = schedJson.data?.id;
  if (!reportId) throw new Error('No report ID returned by HungerBox scheduler');

  // Poll for completion (up to 30s)
  let fileDownloadId: number | null = null;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const pRes = await fetch(`https://admin.hungerbox.com/api/report/download/${site.companyId}`, { headers });
    if (!pRes.ok) continue;
    const pJson = await pRes.json();
    const rep = pJson.data?.find((r: any) => r.id === reportId);
    if (rep?.status === 'ready_for_download' && rep.file_download_id) {
      fileDownloadId = rep.file_download_id;
      break;
    }
    if (rep?.status === 'error') {
      console.warn(`    Report ${reportId} error: ${rep.status_reason}`);
      return [];
    }
  }

  if (!fileDownloadId) {
    console.warn(`    Report ${reportId} timed out waiting for download.`);
    return [];
  }

  // Get signed S3 URL
  const sRes = await fetch(`https://admin.hungerbox.com/api/report/signed-url/${fileDownloadId}`, { headers });
  if (!sRes.ok) throw new Error(`Signed URL request failed (${sRes.status})`);
  const sJson = await sRes.json();
  const signedUrl = sJson.data?.signed_url;
  if (!signedUrl) throw new Error('No signed_url in response');

  // Download CSV
  const fRes = await fetch(signedUrl);
  if (!fRes.ok) throw new Error(`S3 download failed (${fRes.status})`);
  const csvText = await fRes.text();

  const rows = parseCsvRows(csvText);
  console.log(`    Downloaded ${rows.length} product rows.`);
  return rows;
}

// Main execution function
async function main() {
  console.log('====================================================');
  console.log('   HUNGERBOX COMPREHENSIVE MULTI-SITE DATA FEED');
  console.log('====================================================');

  const token = await getHungerBoxToken();
  console.log('Authenticated with HungerBox successfully.\n');

  // Load existing Firestore tuckshop sales
  console.log('Fetching existing Firestore sales records...');
  const snap = await getDocs(query(collection(db, 'newrelic_tuckshop'), where('type', '==', 'sale')));
  const existingRecords = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  console.log(`Found ${existingRecords.length} existing sales records in Firestore.\n`);

  for (const site of SITES) {
    console.log(`\n----------------------------------------------------`);
    console.log(`Processing Site: ${site.siteName} (${site.siteId})`);
    console.log(`Date Range: ${site.startDate} to ${site.endDate}`);
    console.log(`----------------------------------------------------`);

    const chunks = splitDateRange(site.startDate, site.endDate, 80);
    console.log(`Split into ${chunks.length} batches.`);

    // Daily accumulator for this site
    const dailyMap: Record<
      string,
      {
        date: string;
        mrpSales: number;
        nonMrpSales: number;
        itemsCount: number;
        totalUnits: number;
        topItems: Record<string, { qty: number; amount: number; isMrp: boolean }>;
        categories: Record<string, number>;
      }
    > = {};

    for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
      const chunk = chunks[cIdx];
      console.log(`\n[${site.siteName}] Batch ${cIdx + 1}/${chunks.length}: ${chunk.from} to ${chunk.to}`);
      try {
        const rows = await pullHbr2Chunk(token, site, chunk.from, chunk.to);

        for (const row of rows) {
          const rawDate = row['order_date'] || row['orderdate'] || row['date'];
          const date = parseOrderDate(rawDate);
          if (!date || date < site.startDate || date > site.endDate) continue;

          const amount = parseFloat(row['actual_value'] || row['actualvalue'] || row['price'] || '0') || 0;
          const qty = parseInt(row['qty'] || row['quantity'] || '1', 10) || 1;
          const isMrp = row['is_mrp_item'] === '1' || row['ismrpitem'] === '1' || row['is_mrp'] === '1';
          const productName = row['product_name'] || row['productname'] || 'Unknown Item';
          const category = row['category'] || 'General';

          if (!dailyMap[date]) {
            dailyMap[date] = {
              date,
              mrpSales: 0,
              nonMrpSales: 0,
              itemsCount: 0,
              totalUnits: 0,
              topItems: {},
              categories: {},
            };
          }

          if (isMrp) {
            dailyMap[date].mrpSales += amount;
          } else {
            dailyMap[date].nonMrpSales += amount;
          }

          dailyMap[date].itemsCount++;
          dailyMap[date].totalUnits += qty;

          if (!dailyMap[date].topItems[productName]) {
            dailyMap[date].topItems[productName] = { qty: 0, amount: 0, isMrp };
          }
          dailyMap[date].topItems[productName].qty += qty;
          dailyMap[date].topItems[productName].amount += amount;

          dailyMap[date].categories[category] = (dailyMap[date].categories[category] || 0) + amount;
        }

        // Small pause between report generation to be gentle on Redshift
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err: any) {
        console.error(`  Batch ${chunk.from} to ${chunk.to} failed:`, err.message);
      }
    }

    const dates = Object.keys(dailyMap).sort();
    console.log(`\nAggregated ${dates.length} distinct days for ${site.siteName}.`);

    let updatedCount = 0;
    let createdCount = 0;
    let tursoItemsCount = 0;

    // Turso batch statements
    const tursoBatch: any[] = [];

    for (const d of dates) {
      const data = dailyMap[d];
      const mrpSales = Math.round(data.mrpSales * 100) / 100;
      const nonMrpSales = Math.round(data.nonMrpSales * 100) / 100;
      const totalAmount = Math.round((mrpSales + nonMrpSales) * 100) / 100;

      // Exact commission formulas
      const mrpCommission = Math.round(mrpSales * 0.03 * 100) / 100; // 3% on MRP
      const nonMrpCommission = Math.round(nonMrpSales * 0.19 * 100) / 100; // 19% on Non-MRP
      const mrpNet = Math.round((mrpSales - mrpCommission) * 100) / 100;
      const nonMrpNet = Math.round((nonMrpSales - nonMrpCommission) * 100) / 100;
      const totalCommission = Math.round((mrpCommission + nonMrpCommission) * 100) / 100;
      const netSales = Math.round((totalAmount - totalCommission) * 100) / 100;

      const topItemsList = Object.entries(data.topItems)
        .map(([name, stat]) => ({
          name,
          quantity: stat.qty,
          amount: Math.round(stat.amount * 100) / 100,
          isMrp: stat.isMrp,
        }))
        .sort((a, b) => b.amount - a.amount);

      // Build meal session representation
      const mealSessions = [
        { session: 'MRP Packaged Goods (3%)', amount: mrpSales, count: topItemsList.filter((i) => i.isMrp).length },
        { session: 'Fresh Kitchen & Beverages (19%)', amount: nonMrpSales, count: topItemsList.filter((i) => !i.isMrp).length },
      ];

      const description = `HungerBox Verified Product Sales — ${data.totalUnits} items across ${data.itemsCount} lines (MRP: ₹${mrpSales.toLocaleString('en-IN')}, Non-MRP: ₹${nonMrpSales.toLocaleString('en-IN')})`;

      // Find existing Firestore record
      const existing = existingRecords.find((r) => {
        const recDate = (r.date || '').split('T')[0];
        const recSite = r.siteId === site.siteId || (r.location && r.location.toLowerCase().includes(site.siteName.toLowerCase()));
        return recDate === d && recSite;
      });

      const payload = {
        type: 'sale',
        category: 'Sales',
        amount: totalAmount,
        siteId: site.siteId,
        location: site.siteName,
        date: `${d}T12:00:00.000Z`,
        orderCount: data.totalUnits,
        mealSessions,
        source: 'hungerbox',
        description,
        mrpSales,
        mrpCommission,
        mrpNet,
        nonMrpSales,
        nonMrpCommission,
        nonMrpNet,
        totalCommission,
        netSales,
        topItems: topItemsList.slice(0, 10),
        updatedAt: serverTimestamp(),
        updatedBy: 'hungerbox-hbr2-sync@admin',
      };

      if (existing) {
        const docRef = doc(db, 'newrelic_tuckshop', existing.id);
        await updateDoc(docRef, payload);
        updatedCount++;
      } else {
        const colRef = collection(db, 'newrelic_tuckshop');
        await setDoc(doc(colRef), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: 'hungerbox-hbr2-sync@admin',
        });
        createdCount++;
      }

      // Prepare Turso items
      for (const item of topItemsList) {
        tursoBatch.push({
          sql: `INSERT OR REPLACE INTO hungerbox_sales 
                (order_id, order_date, vendor_name, cafeteria_name, amount, item_name, status, org_id, quantity) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            `${site.siteId}_${d}_${item.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`,
            d,
            site.siteName,
            site.siteId,
            item.amount,
            item.name,
            item.isMrp ? 'MRP (3%)' : 'Non-MRP (19%)',
            site.siteId,
            item.quantity,
          ],
        });
        tursoItemsCount++;
      }
    }

    // Batch insert into Turso in chunks of 200
    for (let i = 0; i < tursoBatch.length; i += 200) {
      const slice = tursoBatch.slice(i, i + 200);
      try {
        await turso.batch(slice);
      } catch (err: any) {
        console.warn(`Turso batch insert error at ${i}:`, err.message);
      }
    }

    console.log(`\nFinished ${site.siteName}:`);
    console.log(`  Updated ${updatedCount} Firestore documents.`);
    console.log(`  Created ${createdCount} Firestore documents.`);
    console.log(`  Saved ${tursoItemsCount} product items into Turso.`);
  }

  console.log('\n====================================================');
  console.log('   ALL SITES SYNC COMPLETED SUCCESSFULLY!');
  console.log('====================================================');
}

main().catch((e) => {
  console.error('Fatal error in sync script:', e);
  process.exit(1);
});
