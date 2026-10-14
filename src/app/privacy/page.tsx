import React from 'react';
import Link from 'next/link';
import { ShieldCheck, ArrowLeft, Mail } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy | InvoiceFlow',
  description: 'Privacy Policy for the InvoiceFlow application by HungerBox operations.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#3b2fc9] flex items-center justify-center text-white font-bold">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-gray-900">InvoiceFlow</h1>
              <p className="text-xs text-gray-500">Privacy Policy</p>
            </div>
          </div>
          <Link
            href="/newrelic"
            className="text-xs font-semibold text-[#3b2fc9] hover:underline flex items-center gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Portal
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 sm:p-10 space-y-8 leading-relaxed">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Privacy Policy</h2>
            <p className="text-xs text-gray-400 mt-1">Last updated: October 14, 2026</p>
          </div>

          <section className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900">1. Overview</h3>
            <p className="text-sm text-gray-600">
              InvoiceFlow (&quot;we&quot;, &quot;our&quot;, or &quot;the app&quot;) is an internal enterprise operations management platform designed for HungerBox cafeteria stalls and corporate food courts (including NewRelic, DSM, and NTT Data sites). This Privacy Policy explains how we collect, handle, and protect user and operational data.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900">2. Information We Collect</h3>
            <p className="text-sm text-gray-600">
              To operate stall management and staff attendance features effectively, the application collects only necessary operational data:
            </p>
            <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1.5">
              <li>
                <strong>Account & Profile Information:</strong> Authorized supervisor and staff names, employee IDs, email addresses, and assigned cafeteria site/location.
              </li>
              <li>
                <strong>Camera & Photo Uploads:</strong> When employees mark attendance (Check-In or Check-Out), the app captures an identification selfie via the device camera or image picker. Photo uploads are also used when submitting vendor purchase bills.
              </li>
              <li>
                <strong>Location Data:</strong> Approximate or precise GPS coordinates are collected solely at the moment of attendance check-in/out to verify on-site cafeteria presence. Location is never tracked continuously or in the background.
              </li>
              <li>
                <strong>Operational Records:</strong> Stock indent requests, Tuckshop daily sales entries, expense logs, and delivery challan invoices.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900">3. How Information Is Used</h3>
            <p className="text-sm text-gray-600">
              The collected information is used strictly for internal operational purposes:
            </p>
            <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1.5">
              <li>Authenticating authorized cafeteria personnel and managers.</li>
              <li>Validating shift attendance and calculating monthly payroll/advances for staff.</li>
              <li>Tracking inventory usage, daily sales, and operational expense ledgers.</li>
              <li>Preventing unauthorized transactions or fraudulent attendance logs.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900">4. Data Sharing and Disclosure</h3>
            <p className="text-sm text-gray-600">
              We do <strong>not</strong> sell, rent, monetize, or trade any personal or operational data with third parties or advertisers. Data is stored securely in encrypted cloud databases (Google Cloud / Firebase) protected by strict role-based access rules. Data is only accessible to designated corporate administrators and cafeteria managers.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900">5. Security of Your Data</h3>
            <p className="text-sm text-gray-600">
              We employ industry-standard encryption protocols (HTTPS/TLS) for data in transit and enterprise-grade storage security for all images and transaction logs. Access tokens and sessions are authenticated securely.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900">6. Data Retention and Deletion</h3>
            <p className="text-sm text-gray-600">
              Operational records and attendance logs are retained as required for business bookkeeping and audit compliance. Employees and operators may request correction or deletion of their account information by contacting their site administrator.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-semibold text-gray-900">7. Contact Information</h3>
            <p className="text-sm text-gray-600">
              If you have any questions or concerns regarding this Privacy Policy or data handling practices, please contact:
            </p>
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-xs sm:text-sm text-gray-700 space-y-1">
              <p className="font-semibold text-gray-900">HungerBox Operations / InvoiceFlow Team</p>
              <p className="flex items-center gap-1.5 text-gray-600">
                <Mail className="h-3.5 w-3.5 text-[#3b2fc9]" />
                Email: <a href="mailto:sangarajuvamsi99@gmail.com" className="text-[#3b2fc9] hover:underline">sangarajuvamsi99@gmail.com</a>
              </p>
            </div>
          </section>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} InvoiceFlow · HungerBox Operations. All rights reserved.
      </footer>
    </div>
  );
}
