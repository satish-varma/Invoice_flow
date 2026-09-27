const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
// It will automatically use the FIREBASE_CONFIG environment variable or Google Application Default Credentials
// Or we can manually pass the service account if set in env vars:
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  // handle newlines in GitHub Secrets properly
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
  console.error("Missing Firebase Service Account environment variables.");
  console.error("Please ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set.");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Define which collections you want to back up
const collectionsToBackup = [
  'newrelic_challans',
  'newrelic_pricing',
  'catalog'
];

async function backup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '../backups');
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }

  const backupData = {};

  for (const collectionName of collectionsToBackup) {
    console.log(`Backing up collection: ${collectionName}...`);
    const snapshot = await db.collection(collectionName).get();
    
    backupData[collectionName] = [];
    snapshot.forEach(doc => {
      backupData[collectionName].push({
        id: doc.id,
        ...doc.data()
      });
    });
    console.log(`Saved ${backupData[collectionName].length} documents from ${collectionName}.`);
  }

  const filename = `firestore-backup-${timestamp}.json`;
  const filePath = path.join(backupDir, filename);

  // Write all data to a JSON file
  fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));
  console.log(`\nBackup successfully saved to ${filePath}`);
  
  // Also output the filename so the action can use it if needed
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `backup_file=${filePath}\n`);
  }
}

backup().catch(console.error);
