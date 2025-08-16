import { InvoiceForm } from '@/components/invoice-form';

export default function Home() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-4xl mx-auto">
        <h1 className="text-4xl font-headline font-bold text-center mb-2 text-primary">
          InvoiceFlow
        </h1>
        <p className="text-center text-muted-foreground mb-8">
          Create and manage your invoices with ease.
        </p>
        <InvoiceForm />
      </div>
    </main>
  );
}
