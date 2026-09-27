import React from 'react';
import { Sparkles, Loader2, UploadCloud, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SAMPLE_INVOICES_LIST } from '@/services/newrelicInvoiceParser';

interface PdfAutoParserProps {
  isParsingInvoice: boolean;
  selectedSample: string;
  setSelectedSample: (val: string) => void;
  handleParseInvoice: (file?: File, sampleName?: string) => void;
}

export function PdfAutoParser({
  isParsingInvoice,
  selectedSample,
  setSelectedSample,
  handleParseInvoice,
}: PdfAutoParserProps) {
  return (
    <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-blue-50 border border-indigo-100 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-[#3b2fc9]/10 rounded-xl text-[#3b2fc9]">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-xs sm:text-sm flex items-center gap-1.5">
              Local Invoice / Challan Parser
              <span className="bg-[#3b2fc9] text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
                Fast & Local
              </span>
            </h3>
            <p className="text-[11px] sm:text-xs text-gray-500">
              Upload any vendor invoice (PDF or Image) to automatically populate item rows using local parser
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
        {/* File Upload Button */}
        <div className="relative flex-1">
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            disabled={isParsingInvoice}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleParseInvoice(file);
                e.target.value = '';
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={isParsingInvoice}
            className="w-full h-10 border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 text-xs gap-2 shadow-xs"
          >
            {isParsingInvoice ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#3b2fc9]" />
            ) : (
              <UploadCloud className="h-4 w-4 text-[#3b2fc9]" />
            )}
            {isParsingInvoice ? 'Extracting Items Locally...' : 'Upload & Extract Invoice (PDF/Image)'}
          </Button>
        </div>

        <span className="text-xs text-gray-400 text-center font-medium">or</span>

        {/* Sample Invoice Dropdown */}
        <div className="flex-1 flex gap-1.5">
          <Select
            value={selectedSample}
            onValueChange={setSelectedSample}
            disabled={isParsingInvoice}
          >
            <SelectTrigger className="h-10 text-xs bg-white border-indigo-200 text-gray-700">
              <SelectValue placeholder="Select sample invoice..." />
            </SelectTrigger>
            <SelectContent className="max-h-60 text-xs">
              {SAMPLE_INVOICES_LIST.map((item) => (
                <SelectItem key={item.name} value={item.name} className="text-xs">
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="secondary"
            disabled={isParsingInvoice || !selectedSample}
            onClick={() => handleParseInvoice(undefined, selectedSample)}
            className="h-10 px-3 text-xs bg-indigo-100 text-indigo-800 hover:bg-indigo-200 whitespace-nowrap gap-1"
          >
            {isParsingInvoice ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            Parse Sample
          </Button>
        </div>
      </div>
    </div>
  );
}
