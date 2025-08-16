import { InvoiceForm } from '@/components/invoice-form';

export default function Home() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-5xl mx-auto">
        <div className="text-center mb-8">
            <h1 className="text-4xl font-headline font-bold text-primary">
              InvoiceFlow
            </h1>
            <p className="text-muted-foreground">
              Create professional invoices, or upload an image to have AI extract the data for you.
            </p>
        </div>
        <InvoiceForm />
      </div>
    </main>
  );
}
