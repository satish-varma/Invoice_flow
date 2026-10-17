
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Edit, Trash2, FileText, User, Calendar, Briefcase } from 'lucide-react';
import { OfferLetter } from '@/services/offerLetterService';
import { format } from 'date-fns';
import { triggerHaptic } from '@/lib/haptics';

interface OfferLetterListProps {
  offerLetters: OfferLetter[];
  onSelectOffer: (offer: OfferLetter) => void;
  onDownloadOffer: (offer: OfferLetter) => void;
  onDeleteOffer?: (id: string) => void;
}

export function OfferLetterList({ offerLetters, onSelectOffer, onDownloadOffer, onDeleteOffer }: OfferLetterListProps) {
  return (
    <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-950/40 border border-violet-200/60 dark:border-violet-800/40 flex items-center justify-center text-violet-600 dark:text-violet-400">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              Recent Offer Letters
            </h2>
            <p className="text-xs text-slate-500">
              {offerLetters.length} {offerLetters.length === 1 ? 'letter' : 'letters'} issued
            </p>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-6 space-y-3">
        {offerLetters.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            <FileText className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="font-medium">No offer letters found.</p>
            <p className="text-xs text-slate-400 mt-0.5">Use the form above to generate and issue a new offer letter.</p>
          </div>
        ) : (
          offerLetters.map((offer) => (
            <div
              key={offer.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all gap-3"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-xs text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/40 px-2 py-0.5 rounded-lg border border-violet-200/50 dark:border-violet-800/50">
                    {offer.offerNumber}
                  </span>
                  {offer.offerDate && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(offer.offerDate), 'MMM d, yyyy')}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 text-xs font-bold shrink-0">
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {offer.employeeName}
                  </p>
                </div>

                {offer.position && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Briefcase className="h-3 w-3 text-slate-400" />
                    <span className="truncate">{offer.position}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 rounded-xl font-bold text-xs gap-1.5 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 active:scale-95"
                  onClick={() => {
                    triggerHaptic('light');
                    onDownloadOffer(offer);
                  }}
                  title="Download PDF"
                >
                  <Download className="h-3.5 w-3.5 text-violet-600" />
                  <span>PDF</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-3 rounded-xl font-bold text-xs gap-1.5 active:scale-95"
                  onClick={() => {
                    triggerHaptic('light');
                    onSelectOffer(offer);
                  }}
                  title="Edit"
                >
                  <Edit className="h-3.5 w-3.5 text-blue-600" />
                  <span>Edit</span>
                </Button>
                {onDeleteOffer && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 active:scale-95"
                    onClick={() => {
                      triggerHaptic('light');
                      onDeleteOffer(offer.id!);
                    }}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
