'use client';

import React, { useState } from 'react';
import { useFinancialAuth } from '@/contexts/FinancialAuthContext';
import { FinancialPasswordModal } from '@/components/newrelic/financial-password-modal';
import { Lock, Unlock, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FinancialGateProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  /**
   * If true, renders a full-page or section replacement block when locked.
   * If false, blurs the children and puts a lock overlay on top.
   */
  fallbackMode?: 'block' | 'blur';
}

export function FinancialGate({
  children,
  title = 'Confidential Financial Data Locked',
  description = 'Executive Insights, P&L Ledgers, Revenues, and Gross Profit Margins are password protected.',
  fallbackMode = 'block',
}: FinancialGateProps) {
  const { isUnlocked, remainingMinutes, lockFinancials } = useFinancialAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (isUnlocked) {
    return (
      <div className="relative">
        <div className="mb-3 flex items-center justify-between bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-xl text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <Unlock className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              Financial figures unlocked · Auto-locks in <strong>{remainingMinutes}m</strong>
            </span>
          </div>
          <button
            onClick={lockFinancials}
            className="text-xs font-semibold text-emerald-900 hover:text-red-700 underline flex items-center gap-1 transition-colors"
          >
            <Lock className="w-3 h-3" /> Lock Now
          </button>
        </div>
        {children}
      </div>
    );
  }

  if (fallbackMode === 'block') {
    return (
      <>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 sm:p-12 text-center max-w-xl mx-auto my-6 space-y-4">
          <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-[#3b2fc9] mx-auto shadow-xs">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
              {description}
            </p>
          </div>
          <div className="pt-2">
            <Button
              onClick={() => setIsModalOpen(true)}
              className="bg-[#3b2fc9] hover:bg-[#2f25a3] text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm flex items-center gap-2 mx-auto"
            >
              <Lock className="w-4 h-4" />
              Unlock with Admin Password
            </Button>
          </div>
        </div>

        <FinancialPasswordModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </>
    );
  }

  // Blur overlay mode
  return (
    <>
      <div className="relative overflow-hidden rounded-xl">
        <div className="filter blur-sm select-none pointer-events-none opacity-40">
          {children}
        </div>
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/70 backdrop-blur-xs p-4 text-center">
          <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-[#3b2fc9] mb-2 shadow-xs">
            <Lock className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-gray-800 mb-2">Financials Protected</p>
          <Button
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="bg-[#3b2fc9] hover:bg-[#2f25a3] text-white text-xs h-8 px-3 rounded-lg shadow-xs flex items-center gap-1.5"
          >
            <Lock className="w-3 h-3" />
            Enter Password to Reveal
          </Button>
        </div>
      </div>

      <FinancialPasswordModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
