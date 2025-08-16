
import { Invoice, getInvoices } from "@/services/invoiceService";
import { InvoicesDataTable } from "./data-table";
import { columns } from "./columns";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

async function getData(): Promise<Invoice[]> {
  const invoices = await getInvoices();
  return invoices;
}

export default async function InvoicesPage() {
  const data = await getData();

  return (
    <main className="min-h-screen bg-background flex flex-col items-center p-4 sm:p-8">
        <div className="w-full max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <Button variant="outline" asChild>
                        <Link href="/">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Create
                        </Link>
                    </Button>
                    <h1 className="text-4xl font-headline font-bold text-primary mt-4">
                        Saved Invoices
                    </h1>
                    <p className="text-muted-foreground">
                        Here are all the invoices you have saved. You can filter, sort, and manage them from here.
                    </p>
                </div>
            </div>
            <InvoicesDataTable columns={columns} data={data} />
        </div>
    </main>
  );
}

    