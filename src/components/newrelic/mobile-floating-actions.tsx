'use client';

import React, { useState } from 'react';
import { Plus, X, FileText, RefreshCcw, FileSpreadsheet, MapPin, Calculator } from 'lucide-react';
import Link from 'next/link';
import { NewRelicLocation } from '@/types/challan';

interface MobileFloatingActionsProps {
  onNewChallan: (loc: NewRelicLocation) => void;
  onExportExcel?: () => void;
  canReconcile?: boolean;
  onOpenCalculator?: () => void;
}

export function MobileFloatingActions({
  onNewChallan,
  onExportExcel,
  canReconcile = false,
  onOpenCalculator,
}: MobileFloatingActionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="sm:hidden">
      {/* Floating Action Button (+) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed right-5 bottom-26 z-30 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white transition-all transform active:scale-90 ${
          isOpen
            ? 'bg-gray-800 rotate-45'
            : 'bg-gradient-to-tr from-indigo-600 via-[#3b2fc9] to-violet-600 shadow-indigo-500/40'
        }`}
        aria-label="Create Action"
      >
        <Plus className="w-7 h-7 stroke-[2.5] transition-transform" />
      </button>

      {/* Slide-up Action Sheet when (+) is tapped */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Action List */}
          <div className="relative bg-white rounded-t-3xl p-5 pb-8 shadow-2xl space-y-3 animate-in slide-in-from-bottom duration-200">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-2" />

            <div className="flex items-center justify-between pb-1">
              <h4 className="text-sm font-bold text-gray-900">Create & Export Actions</h4>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Hyderabad DC */}
            <button
              onClick={() => {
                setIsOpen(false);
                onNewChallan('hyderabad');
              }}
              className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-gradient-to-r from-blue-50/90 to-indigo-50/70 border border-blue-200/80 text-left active:scale-[0.99] transition-transform shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-blue-950">New Challan · Hyderabad</p>
                <p className="text-xs text-blue-700 font-medium">Mindspace, Hitec City cafeteria DC</p>
              </div>
            </button>

            {/* Bangalore DC */}
            <button
              onClick={() => {
                setIsOpen(false);
                onNewChallan('bangalore');
              }}
              className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50/90 to-teal-50/70 border border-emerald-200/80 text-left active:scale-[0.99] transition-transform shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-950">New Challan · Bangalore</p>
                <p className="text-xs text-emerald-700 font-medium">Bagmane Tech Park cafeteria DC</p>
              </div>
            </button>

            {/* MRP % Calculator */}
            {onOpenCalculator && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenCalculator();
                }}
                className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-gradient-to-r from-purple-50/90 to-indigo-50/70 border border-purple-200/80 text-left active:scale-[0.99] transition-transform shadow-xs"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-purple-950">MRP % Calculator</p>
                  <p className="text-xs text-purple-700 font-medium">Find margins, discounts &amp; vendor costs</p>
                </div>
              </button>
            )}

            {(canReconcile || onExportExcel) && (
              <div className={`grid ${canReconcile && onExportExcel ? 'grid-cols-2' : 'grid-cols-1'} gap-2 pt-1`}>
                {/* Reconcile (Admin / Superadmin only) */}
                {canReconcile && (
                  <Link
                    href="/newrelic/reconcile"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-900 font-bold text-xs"
                  >
                    <RefreshCcw className="w-4 h-4 text-amber-600" />
                    Reconcile
                  </Link>
                )}

                {/* Export Excel (Admin / Superadmin only) */}
                {onExportExcel && (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onExportExcel();
                    }}
                    className="flex items-center justify-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 font-bold text-xs"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    Export Excel
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
