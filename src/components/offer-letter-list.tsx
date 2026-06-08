
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Edit, Trash2, FileText, User } from 'lucide-react';
import { OfferLetter } from '@/services/offerLetterService';
import { format } from 'date-fns';

interface OfferLetterListProps {
  offerLetters: OfferLetter[];
  onSelectOffer: (offer: OfferLetter) => void;
  onDownloadOffer: (offer: OfferLetter) => void;
  onDeleteOffer?: (id: string) => void;
}

export function OfferLetterList({ offerLetters, onSelectOffer, onDownloadOffer, onDeleteOffer }: OfferLetterListProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl font-bold flex items-center gap-2">
          <FileText className="h-5 w-5" /> Recent Offer Letters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {offerLetters.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No offer letters found.</p>
          </div>
        ) : (
          offerLetters.map((offer) => (
            <div
              key={offer.id}
              className="group flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-primary">{offer.offerNumber}</span>
                  <span className="text-xs text-muted-foreground">
                    {offer.offerDate ? format(new Date(offer.offerDate), 'MMM d, yyyy') : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-medium">
                  <User className="h-3 w-3" />
                  <p className="truncate text-sm">{offer.employeeName}</p>
                </div>
                <p className="text-xs text-muted-foreground truncate">{offer.position}</p>
              </div>
              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onDownloadOffer(offer)}
                  title="Download PDF"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onSelectOffer(offer)}
                  title="Edit"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                {onDeleteOffer && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => onDeleteOffer(offer.id!)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
