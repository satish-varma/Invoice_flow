'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Check, X, Search } from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';

interface MultiSelectProps {
  label: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

export function MultiSelect({ label, options, value, onChange }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (e: React.MouseEvent, option: string) => {
    e.stopPropagation();
    triggerHaptic('light');
    let newValue: string[];
    if (value.includes(option)) {
      newValue = value.filter((v) => v !== option);
    } else {
      newValue = [...value, option];
    }
    onChange(newValue);
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('light');
    onChange([]);
  };

  const isAllSelected = value.length === 0;

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayValue = isAllSelected
    ? 'All'
    : value.length === 1
    ? value[0]
    : `${value.length} selected`;

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          triggerHaptic('light');
          setIsOpen(!isOpen);
        }}
        className={`h-10 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-between gap-2 shadow-2xs active:scale-95 ${
          isOpen || !isAllSelected
            ? 'border-indigo-500 ring-2 ring-indigo-100 dark:ring-indigo-950 bg-white dark:bg-slate-800 text-slate-900 dark:text-white'
            : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-slate-500 dark:text-slate-400 font-semibold">{label}:</span>
          <span className="max-w-[130px] truncate font-black text-slate-900 dark:text-white">
            {displayValue}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {!isAllSelected && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic('light');
                onChange([]);
              }}
              className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
              title="Clear selection"
            >
              <X size={12} />
            </span>
          )}
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 z-50 min-w-[240px] max-w-[320px] max-h-[320px] overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl flex flex-col animate-in fade-in zoom-in-95 duration-100">
          {/* Search box inside dropdown */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={`Search ${label}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="w-full h-8 pl-8 pr-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="p-1.5 overflow-y-auto max-h-[220px] space-y-0.5">
            <div
              onClick={handleSelectAll}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                isAllSelected
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-[#3b2fc9] dark:text-indigo-400'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <span>All {label}s</span>
              {isAllSelected && <Check size={14} className="text-[#3b2fc9] dark:text-indigo-400" />}
            </div>

            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400">No options found</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = value.includes(opt);
                return (
                  <div
                    key={opt}
                    onClick={(e) => toggleOption(e, opt)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-[#3b2fc9] dark:text-indigo-400 font-bold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="truncate mr-2">{opt}</span>
                    {isSelected && <Check size={14} className="text-[#3b2fc9] dark:text-indigo-400 shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
