import { forwardRef } from 'react';
import type { DeclarationData } from './declaration-form';

interface DeclarationPreviewProps {
  data: DeclarationData;
}

export const DeclarationPreview = forwardRef<HTMLDivElement, DeclarationPreviewProps>(
  ({ data }, ref) => {
    // Format date string from YYYY-MM-DD to DD/MM/YYYY
    const formattedDate = data.date
      ? new Date(data.date).toLocaleDateString('en-GB') // DD/MM/YYYY
      : '';

    return (
      <div
        ref={ref}
        className="bg-white text-black relative"
        // Standard A4 dimensions at 96 DPI: 794 x 1123 pixels
        style={{
          width: '794px',
          height: '1123px',
          boxSizing: 'border-box',
          fontFamily: 'sans-serif',
          lineHeight: '1.5',
        }}
      >
        {/* Letterhead Header Margin */}
        <div className="pt-[50px] px-[60px] pb-6 border-b-[3px] border-[#333] mb-8 relative flex justify-between items-center">
          {/* Logo */}
          <div className="flex-shrink-0">
            {data.vendorName?.toLowerCase().includes('gut guru') && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src="/logo.svg" alt="The Gut Guru Logo" className="h-[120px] w-auto object-contain" />
            )}
          </div>
          
          <div className="text-right ml-8">
            <h1 className="text-2xl font-bold uppercase tracking-wide text-gray-900 mb-1 leading-tight">
              {data.vendorName || 'Vendor Name'}
            </h1>
            <div className="text-[12px] space-y-0.5 text-gray-700 font-medium">
              <p>{data.address}</p>
              {data.phone && <p>Phone: {data.phone}</p>}
              {data.email && <p>Email: {data.email}</p>}
              {data.website && <p>Website: {data.website}</p>}
              <p className="mt-1"><span className="font-bold">GSTIN:</span> {data.gstin}</p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="px-[60px]">
          {/* Date and Ref */}
          <div className="flex justify-between text-[14px] font-semibold mb-8">
            <div>{data.refNo ? `Ref No: ${data.refNo}` : ''}</div>
            <div>Date: {formattedDate}</div>
          </div>

          {/* Addressee */}
          <div className="text-[15px] mb-8 leading-snug font-bold text-gray-800">
            <p>To,</p>
            <p>EatGood Technologies Private Limited (Hungerbox)</p>
          </div>

          <div className="text-center font-bold text-[17px] underline mb-8 tracking-wide">
            DECLARATION TO BE TAKEN FROM URD SUPPLIER
          </div>

          {/* Body content */}
          <div className="text-[15px] space-y-5 text-justify leading-relaxed text-gray-900 whitespace-pre-wrap">
            {data.declarationText
              ?.replace(/\{vendorName\}/g, data.vendorName || '')
              ?.replace(/\{address\}/g, data.address || '')
              ?.replace(/\{financialYear\}/g, data.financialYear || '')}
          </div>
        </div>

        {/* Footer / Signatures */}
        <div className="absolute bottom-[80px] left-[60px] right-[60px] flex justify-between items-end text-[15px]">
          <div className="space-y-1">
            <p className="mb-4">Thanking you,</p>
            <p className="mb-2">Yours sincerely,</p>
            <div className="mt-[100px] text-[13px] text-gray-800 space-y-0.5 font-semibold">
              <p>Name: {data.personName}</p>
              <p>Designation: {data.designation}</p>
            </div>
          </div>
          
          <div className="space-y-1 text-right flex flex-col items-end">
            <div className="h-[100px] w-56 relative mb-2 flex justify-end">
              {data.vendorName?.toLowerCase().includes('gut guru') && (
                // eslint-disable-next-line @next/next/no-img-element
                <img 
                  src="/sigwithsign_small.png" 
                  alt="Signature & Seal" 
                  className="absolute bottom-0 right-0 max-h-full max-w-full object-contain"
                />
              )}
            </div>
            <p className="pt-2 font-semibold border-t border-gray-900 mt-2 w-64 text-center">
              Signature of Authorized Person
            </p>
            <div className="mt-1 text-[13px] text-gray-800 space-y-0.5 text-center w-64">
              <p><span className="font-semibold">Place:</span> {data.place}</p>
              <p><span className="font-semibold">Date:</span> {formattedDate}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

DeclarationPreview.displayName = 'DeclarationPreview';
