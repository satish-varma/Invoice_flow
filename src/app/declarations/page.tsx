'use client';

import { DeclarationForm } from '@/components/declarations/declaration-form';

export default function DeclarationsPage() {
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">GST Declaration Generator</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generate URD GST Declaration letterheads for EatGood Technologies Pvt. Ltd. (HungerBox).
        </p>
      </div>
      <DeclarationForm />
    </div>
  );
}
