'use client';

import React, { useState } from 'react';
import { useFinancialAuth } from '@/contexts/FinancialAuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock, Eye, EyeOff, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';

interface FinancialPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  description?: string;
}

export function FinancialPasswordModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'Re-Enter Admin Password',
  description = 'Financial reports, sales analytics, and profit margins are confidential. Please authenticate to view.',
}: FinancialPasswordModalProps) {
  const { unlockWithPassword } = useFinancialAuth();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await unlockWithPassword(password);
    setIsSubmitting(false);

    if (result.success) {
      setPassword('');
      onSuccess?.();
      onClose();
    } else {
      setError(result.error || 'Authentication failed. Please check your password.');
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setPassword('');
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-gray-100">
        <DialogHeader className="space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#3b2fc9] mb-2 mx-auto sm:mx-0">
            <Lock className="w-6 h-6" />
          </div>
          <DialogTitle className="text-xl font-bold text-gray-900 tracking-tight">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500 leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your account password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                disabled={isSubmitting}
                className="pr-10 h-11 border-gray-200 focus:border-[#3b2fc9] focus:ring-[#3b2fc9]/20 rounded-xl text-sm"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-100">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-800">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-snug">
              Unlocking grants access for <strong>15 minutes</strong> across all financial views in this tab. You can lock it anytime.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 h-11 rounded-xl border-gray-200 hover:bg-gray-50 text-gray-600 text-sm font-medium"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !password.trim()}
              className="flex-1 h-11 rounded-xl bg-[#3b2fc9] hover:bg-[#2f25a3] text-white text-sm font-semibold shadow-sm transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Unlock Financials'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
