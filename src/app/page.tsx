import { InvoiceForm } from '@/components/invoice-form';

export default function Home() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-5xl mx-auto">
        <InvoiceForm />
      </div>
    </main>
  );
}
