import React from 'react';
import Link from 'next/link';
import { ShieldCheck, ArrowLeft, Mail } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy | InvoiceFlow',
  description: 'Privacy Policy for the InvoiceFlow application by HungerBox operations.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-600/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">InvoiceFlow</h1>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Privacy Policy</p>
            </div>
          </div>
          <Link
            href="/newrelic"
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Portal
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)] p-6 sm:p-10 space-y-8 leading-relaxed">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-black tracking-widest uppercase mb-2">
              Legal & Compliance
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Privacy Policy</h2>
            <p className="text-xs text-slate-400 mt-1">Last updated: October 14, 2026</p>
          </div>

          <section className="space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">1. Overview</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              InvoiceFlow (&quot;we&quot;, &quot;our&quot;, or &quot;the app&quot;) is an internal enterprise operations management platform designed for HungerBox cafeteria stalls and corporate food courts (including NewRelic, DSM, and NTT Data sites). This Privacy Policy explains how we collect, handle, and protect user and operational data.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">2. Information We Collect</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              To operate stall management and staff attendance features effectively, the application collects only necessary operational data:
            </p>
            <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-300 space-y-1.5">
              <li>
                <strong className="text-slate-900 dark:text-white">Account & Profile Information:</strong> Authorized supervisor and staff names, employee IDs, email addresses, and assigned cafeteria site/location.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Camera & Photo Uploads:</strong> When employees mark attendance (Check-In or Check-Out), the app captures an identification selfie via the device camera or image picker. Photo uploads are also used when submitting vendor purchase bills.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Location Data:</strong> Approximate or precise GPS coordinates are collected solely at the moment of attendance check-in/out to verify on-site cafeteria presence. Location is never tracked continuously or in the background.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-white">Operational Records:</strong> Stock indent requests, Tuckshop daily sales entries, expense logs, and delivery challan invoices.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">3. How Information Is Used</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              The collected information is used strictly for internal operational purposes:
            </p>
            <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-300 space-y-1.5">
              <li>Authenticating authorized cafeteria personnel and managers.</li>
              <li>Validating shift attendance and calculating monthly payroll/advances for staff.</li>
              <li>Tracking inventory usage, daily sales, and operational expense ledgers.</li>
              <li>Preventing unauthorized transactions or fraudulent attendance logs.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">4. Data Sharing and Disclosure</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              We do <strong>not</strong> sell, rent, monetize, or trade any personal or operational data with third parties or advertisers. Data is stored securely in encrypted cloud databases (Google Cloud / Firebase) protected by strict role-based access rules. Data is only accessible to designated corporate administrators and cafeteria managers.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">5. Security of Your Data</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              We employ industry-standard encryption protocols (HTTPS/TLS) for data in transit and enterprise-grade storage security for all images and transaction logs. Access tokens and sessions are authenticated securely.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">6. Data Retention and Deletion</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Operational records and attendance logs are retained as required for business bookkeeping and audit compliance. Employees and operators may request correction or deletion of their account information by contacting their site administrator.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">7. Contact Information</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              If you have any questions or concerns regarding this Privacy Policy or data handling practices, please contact:
            </p>
            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300 space-y-1">
              <p className="font-bold text-slate-900 dark:text-white">HungerBox Operations / InvoiceFlow Team</p>
              <p className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <Mail className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                Email: <a href="mailto:sangarajuvamsi99@gmail.com" className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold">sangarajuvamsi99@gmail.com</a>
              </p>
            </div>
          </section>
        </div>
      </main>

      <footer className="py-6 text-center text-xs font-medium text-slate-400">
        © {new Date().getFullYear()} InvoiceFlow · HungerBox Operations. All rights reserved.
      </footer>
    </div>
  );
}
