import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor Configuration for InvoiceFlow Android App
 *
 * NOTE ON SERVER URL:
 * - In Development: You can point `server.url` to your local dev machine (e.g. 'http://192.168.29.101:9002' or 'http://10.0.2.2:9002' for Android Emulator).
 * - In Production: Set `server.url` to your production deployment domain (e.g. Vercel, Firebase App Hosting, or custom domain).
 *
 * If `server.url` is omitted or empty, Capacitor loads the static files from `webDir`.
 */
const config: CapacitorConfig = {
  appId: 'com.hungerbox.invoiceflow',
  appName: 'The Gut Guru Tracker',
  webDir: 'public',
  server: {
    // When testing on device/emulator, this allows loading your live dev server directly into the operations portal
    // Change this to your deployed domain in production (e.g. 'https://invoice-flow.vercel.app/newrelic')
    url: process.env.CAPACITOR_SERVER_URL || 'https://studio--invoiceflow-24nxt.us-central1.hosted.app/newrelic',
    cleartext: false, // Enforce HTTPS for live production play store release
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true, // Enables Chrome remote inspection via chrome://inspect
  },
  plugins: {
    // Plugin-specific settings can be added here
  },
};

export default config;
