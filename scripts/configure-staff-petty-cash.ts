import { db } from '../src/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

async function configureStaffPettyCash() {
  const configs = [
    {
      id: 'vo2NYqB1IiXqAA8fPKJe',
      email: 'laxman@thegutguru.in',
      pettyCashEnabled: true,
      pettyCashSites: ['newrelic_hyderabad'],
      pettyCashLocations: ['hyderabad'],
      pettyCashLimit: 5000,
    },
    {
      id: 'BHVops8w4VPIOfMAWAW9',
      email: 'ravi@tgg.in',
      pettyCashEnabled: true,
      pettyCashSites: ['newrelic_bangalore'],
      pettyCashLocations: ['bangalore'],
      pettyCashLimit: 5000,
    },
    {
      id: 'hAMQcyo3YuXYOnq0uGjN',
      email: 'swami@tgg.in',
      pettyCashEnabled: true,
      pettyCashSites: ['ntt_data', 'dsm', 'resmed'],
      pettyCashLocations: ['hyderabad'],
      pettyCashLimit: 15000,
    },
  ];

  for (const c of configs) {
    const ref = doc(db, 'users', c.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      console.warn(`User ${c.email} not found!`);
      continue;
    }
    console.log(`Configuring Petty Cash for ${c.email}...`);
    await updateDoc(ref, {
      pettyCashEnabled: c.pettyCashEnabled,
      pettyCashSites: c.pettyCashSites,
      pettyCashLocations: c.pettyCashLocations,
      pettyCashLimit: c.pettyCashLimit,
      // Ensure tuckshop permissions are active
      allowedTabs: Array.from(new Set([...(snap.data().allowedTabs || []), 'tuckshop', 'tuckshop_pos'])),
    });
    console.log(`✅ Configured ${c.email}: sites = [${c.pettyCashSites.join(', ')}], limit = ₹${c.pettyCashLimit}`);
  }
}

configureStaffPettyCash()
  .then(() => {
    console.log('All staff petty cash profiles configured successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Configuration failed:', err);
    process.exit(1);
  });
