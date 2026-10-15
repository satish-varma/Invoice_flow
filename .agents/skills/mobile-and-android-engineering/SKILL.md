---
name: mobile-and-android-engineering
description: Guidelines, patterns, and troubleshooting practices for InvoiceFlow mobile web and Capacitor Android hybrid app. Use when enhancing mobile UI/UX, touch/haptics, camera/selfie, hydration, offline/PWA, or Android Capacitor builds.
---

# InvoiceFlow Mobile & Android Engineering Playbook

This skill captures architectural rules, lessons learned, and guidelines for maintaining and expanding the mobile web (PWA) and native Android (Capacitor) applications in InvoiceFlow.

---

## 1. Native Mobile Architecture & Capacitor Android

InvoiceFlow operates as both a mobile PWA (responsive web) and an Android APK/Bundle built with **Capacitor 8**.

* **Capacitor Configuration (`capacitor.config.ts`):**
  - Package ID: `com.gutguru.invoiceflow`
  - Development URL: Configured to local dev IP (`http://192.168.x.x:9002` or `http://10.0.2.2:9002` for Android emulator) with `cleartext: true` for HTTP development.
  - Production URL: Points to production web deployment or static `webDir: 'public'`.
  - Android specific: `allowMixedContent: true`, `webContentsDebuggingEnabled: true` (allows remote debugging via `chrome://inspect`).
* **CLI Scripts in `package.json`:**
  - `npm run cap:sync`: Syncs web assets and plugins to `./android`.
  - `npm run cap:open:android`: Opens the native project in Android Studio.
  - `npm run cap:build:android`: Runs `./gradlew assembleDebug` directly.

---

## 2. Eliminating Hydration Mismatches in Next.js App Router

### The Root Problem:
When pages rely on client-only values (e.g. `localStorage`, user session profile preferences, `new Date()`, live clocks, or browser extension autofill), the Server-Side Rendered (SSR) HTML will not match the client DOM.
In Chromium/Android WebView, autofill and translation extensions also inject attributes such as `_gcruniqueid="1"`, `_gcruniqueid="2"`, triggering:
> *"Hydration failed because the server-rendered HTML didn't match."*

### Proven Solutions:
1. **The `mounted` Guard Pattern:**
   In pages reading `localStorage` or `user.preferredLocations`:
   ```tsx
   const [mounted, setMounted] = useState(false);
   useEffect(() => {
     setMounted(true);
   }, []);

   if (!mounted) {
     return (
       <div className="min-h-screen bg-gray-50 flex items-center justify-center">
         <Loader2 className="h-6 w-6 animate-spin text-[#3b2fc9]" />
       </div>
     );
   }
   ```
2. **`suppressHydrationWarning` on Root and Dynamic Blocks:**
   Add `suppressHydrationWarning` to the parent container:
   ```tsx
   <div className="min-h-screen bg-gray-50" suppressHydrationWarning>
   ```
3. **Clocks and Timers:**
   Never render `new Date()` directly in SSR markup. Use a client `useEffect` to populate `displayDate` or `currentTime` after mounting.

---

## 3. Mobile Touch & Native Feel Patterns

### A. Tactile Micro-Haptics (`src/lib/haptics.ts`)
Web apps on mobile feel unresponsive without tactile feedback. Use `triggerHaptic(type)`:
* `triggerHaptic('light')`: 12ms micro-tick for tab switches, segmented pill buttons, quantity steppers, item dropdown toggles.
* `triggerHaptic('medium')`: 25ms press for Shutter button, Save buttons, Check In / Out, and Native Share.
* `triggerHaptic('success')`: [15, 40, 25]ms double-pulse on successful API save or form completion.
* `triggerHaptic('warning')`: [30, 50, 30]ms boundary/alert vibration on delete confirmations or offline alerts.
* Always wrap inside try/catch with `navigator.vibrate` feature detection so desktop browsers fail silently.

### B. Single-Thumb Mobile Navigation (`src/components/newrelic/mobile-app-navigation.tsx`)
* Fixed bottom navigation bar with iOS 18/Material 3 style pill capsules.
* Height: `h-16 pb-safe` with background blur (`backdrop-blur-md bg-white/90`).
* Active tab uses sliding pill background (`bg-[#3b2fc9]/10 text-[#3b2fc9] font-bold`) and micro-haptics on tab switch.

### C. Offline / Network Status Banner (`src/components/newrelic/network-status-indicator.tsx`)
* Essential for cafeteria staff in underground basements, cold storages, or weak 4G zones.
* Listens to `window.addEventListener('online')` and `'offline'`.
* Automatically alerts the user before they attempt camera photo uploads or Firestore writes.

### D. Native Web Share / WhatsApp Fallback (`Share2`)
* When sharing delivery summaries or invoice line items on mobile:
  ```tsx
  if (typeof navigator !== 'undefined' && navigator.share) {
    await navigator.share({ title, text, url });
  } else {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  }
  ```

---

## 4. UI Density and Single-Row Responsive Rules

* **Mobile Stat Cards (3-Column Rule):**
  When showing overview metrics on mobile (Total Challans, Hyderabad, Bangalore), stack vertically on desktop if needed, but display side-by-side on mobile using `grid grid-cols-3 gap-2`.
  Card elements must scale down (`p-2.5`, `text-base sm:text-2xl font-bold`, `text-[10px] sm:text-sm`) with `truncate` on labels to prevent vertical card wrapping.
* **Segmented Location Bar:**
  Avoid native `<select>` dropdowns for primary locations. Use horizontal pill segments (`[ All ] [ HYD ] [ BLR ]`) inside `overflow-x-auto scrollbar-none`.
* **Role-Based Filter Visibility:**
  - Administrative cycle filters (e.g. `Cycle 1 (1–15)`, `Cycle 2 (16–End)`) must only render for `admin` / `superadmin`.
  - Regular staff and users must have a distraction-free, date-focused UI defaulting automatically to their assigned `user.preferredLocations`.
