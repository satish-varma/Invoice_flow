import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GST Declaration — HungerBox',
  description: 'Generate URD GST Declaration Letterheads',
};

export default function DeclarationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-100 bg-white sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-3 sm:px-8 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hungerbox_logo.png"
              alt="HungerBox"
              className="h-7 sm:h-8 w-auto object-contain"
            />
            <span className="text-sm text-gray-400 font-medium hidden xs:inline">×</span>
            <span className="text-xs sm:text-sm font-semibold text-gray-700 hidden xs:inline">
              URD Declaration Portal
            </span>
          </div>
          <span className="text-[11px] sm:text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5 sm:px-3 sm:py-1 truncate">
            GST Compliance
          </span>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
