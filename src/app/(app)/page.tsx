
import { InvoiceContainer } from '@/components/invoice-container';

export default function Home() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-7xl mx-auto">
        <InvoiceContainer />
      </div>
    </main>
  );
}
