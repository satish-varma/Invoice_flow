
'use client'

import { Invoice, getInvoices } from "@/services/invoiceService";
import { InvoicesDataTable } from "./data-table";
import { getColumns } from "./columns";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader } from "lucide-react";
import React from "react";
import { InvoicePreviewDialog } from "@/components/invoice-preview-dialog";

export default function InvoicesPage() {
  const [data, setData] = React.useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [previewingInvoice, setPreviewingInvoice] = React.useState<Invoice | null>(null);

  React.useEffect(() => {
    async function getData() {
      setIsLoading(true);
      const invoices = await getInvoices();
      setData(invoices);
      setIsLoading(false);
    }
    getData();
  }, []);
  
  const handlePreview = (invoice: Invoice) => {
    setPreviewingInvoice(invoice);
  }

  const columns = React.useMemo(() => getColumns(handlePreview), []);

  if (isLoading) {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <Loader className="h-8 w-8 animate-spin" />
        </div>
    )
  }

  return (
    <>
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
            <InvoicesDataTable columns={columns} data={data} onPreview={handlePreview} />
        </div>
    </main>
    {previewingInvoice && (
      <InvoicePreviewDialog
        invoice={previewingInvoice}
        isOpen={!!previewingInvoice}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setPreviewingInvoice(null);
          }
        }}
      />
    )}
    </>
  );
}
