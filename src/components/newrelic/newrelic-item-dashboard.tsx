import React, { useMemo, useState } from 'react';
import { NewRelicChallan } from '@/services/newrelicChallanService';
import { Search, Filter, ArrowUpDown } from 'lucide-react';

interface NewRelicItemDashboardProps {
  challans: NewRelicChallan[];
}

interface AggregatedItem {
  id: string; // usually normalized item name
  brandName: string;
  itemName: string; // The display name
  totalQuantity: number;
  occurrences: number; // How many challans had this item
  sources: { dcNumber: string; dcDate: string; location: string; quantity: number }[];
}

function toTitleCase(str: string) {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

export function NewRelicItemDashboard({ challans }: NewRelicItemDashboardProps) {
  const [searchItem, setSearchItem] = useState('');
  const [searchBrand, setSearchBrand] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<AggregatedItem | null>(null);
  
  const ITEMS_PER_PAGE = 20;

  const uniqueBrands = useMemo(() => {
    const brands = new Set<string>();
    challans.forEach(c => {
      c.lineItems.forEach(item => {
        if (item.brandName && item.brandName.trim()) {
          brands.add(item.brandName.trim());
        }
      });
    });
    return Array.from(brands).sort();
  }, [challans]);

  const aggregatedData = useMemo(() => {
    const map = new Map<string, AggregatedItem>();

    const now = new Date();
    
    // Calculate date ranges
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (dateFilter === 'last_7') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateFilter === 'last_15') {
      startDate = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    } else if (dateFilter === 'this_month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (dateFilter === 'last_month') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
    } else if (dateFilter === 'custom' && customStart && customEnd) {
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
      // Include the full end day
      endDate.setHours(23, 59, 59, 999);
    }

    challans.forEach(c => {
      const cDate = new Date(c.dcDate);
      
      // Apply date filter
      if (startDate && cDate < startDate) return;
      if (endDate && cDate > endDate) return;

      c.lineItems.forEach(item => {
        // Normalize name for grouping (case-insensitive, trimmed)
        const rawName = item.itemName || 'Unknown Item';
        const normalizedKey = rawName.trim().toLowerCase();
        
        // Pick the first brand name encountered for this item, or aggregate brands?
        // Let's just use the raw brand, or normalize it too.
        const brandName = item.brandName || 'N/A';

        const sourceInfo = {
          dcNumber: c.dcNumber,
          dcDate: c.dcDate,
          location: c.location,
          quantity: Number(item.quantity) || 0
        };

        if (map.has(normalizedKey)) {
          const existing = map.get(normalizedKey)!;
          existing.totalQuantity += sourceInfo.quantity;
          existing.occurrences += 1;
          existing.sources.push(sourceInfo);
        } else {
          map.set(normalizedKey, {
            id: normalizedKey,
            itemName: toTitleCase(rawName.trim()), // Store nice title case for display
            brandName: brandName.trim(),
            totalQuantity: sourceInfo.quantity,
            occurrences: 1,
            sources: [sourceInfo]
          });
        }
      });
    });

    let result = Array.from(map.values());

    // Filter by Item Name
    if (searchItem.trim()) {
      const q = searchItem.toLowerCase();
      result = result.filter(r => r.itemName.toLowerCase().includes(q));
    }

    // Filter by Brand Name
    if (searchBrand.trim()) {
      const q = searchBrand.toLowerCase();
      result = result.filter(r => r.brandName.toLowerCase().includes(q));
    }

    // Sort by Quantity
    result.sort((a, b) => {
      if (sortOrder === 'desc') return b.totalQuantity - a.totalQuantity;
      return a.totalQuantity - b.totalQuantity;
    });

    return result;
  }, [challans, searchItem, searchBrand, sortOrder, dateFilter, customStart, customEnd]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchItem, searchBrand, sortOrder, dateFilter, customStart, customEnd]);

  const totalPages = Math.ceil(aggregatedData.length / ITEMS_PER_PAGE);
  const paginatedData = aggregatedData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalQuantityInView = aggregatedData.reduce((acc, curr) => acc + curr.totalQuantity, 0);

  const handleExportCSV = () => {
    const headers = ['Item Name', 'Brand', 'Total Quantity', 'Dispatch Frequency'];
    const rows = aggregatedData.map(item => [
      `"${item.itemName.replace(/"/g, '""')}"`,
      `"${item.brandName.replace(/"/g, '""')}"`,
      item.totalQuantity,
      item.occurrences
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'NewRelic_Item_Ledger.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col relative">
      {/* Header & Filters */}
      <div className="p-4 sm:p-6 border-b border-gray-200 bg-gray-50 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Item Ledger</h2>
            <p className="text-sm text-gray-500 mt-1">Aggregated totals of all dispatched items matching your active month/year filters.</p>
          </div>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            Export CSV
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Item Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Filter by Item Name..." 
              value={searchItem}
              onChange={(e) => setSearchItem(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
            />
          </div>

          {/* Brand Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              list="available-brands"
              placeholder="Filter by Brand..." 
              value={searchBrand}
              onChange={(e) => setSearchBrand(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
            />
            <datalist id="available-brands">
              {uniqueBrands.map(brand => (
                <option key={brand} value={brand} />
              ))}
            </datalist>
          </div>

          {/* Date Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white appearance-none"
            >
              <option value="all">All Dates</option>
              <option value="last_7">Last 7 Days</option>
              <option value="last_15">Last 15 Days</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Custom Date Range (Only visible if 'custom' is selected) */}
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-1">
              <input 
                type="date" 
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
              />
              <span className="text-gray-400 text-sm font-medium">to</span>
              <input 
                type="date" 
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
              />
            </div>
          )}

          {/* Sort */}
          <button 
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowUpDown className="h-4 w-4 text-gray-400" />
            Sort: {sortOrder === 'desc' ? 'Highest Qty' : 'Lowest Qty'}
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white border-b border-gray-200">
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Item Name</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Brand</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Total Quantity</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Dispatch Frequency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedData.length > 0 ? (
              paginatedData.map((item) => (
                <tr 
                  key={item.id} 
                  onClick={() => setSelectedItem(item)}
                  className="hover:bg-gray-50 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4">
                    <span className="font-medium text-gray-900 group-hover:text-[#3b2fc9] transition-colors">{item.itemName}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-600 text-sm">{item.brandName}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-sm font-bold bg-[#3b2fc9]/10 text-[#3b2fc9]">
                      {item.totalQuantity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-gray-500 text-sm">{item.occurrences} {item.occurrences === 1 ? 'challan' : 'challans'}</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                  No items found matching your filters.
                </td>
              </tr>
            )}
          </tbody>
          {aggregatedData.length > 0 && (
            <tfoot className="bg-gray-50 border-t border-gray-200 font-medium text-gray-900">
              <tr>
                <td colSpan={2} className="px-6 py-4 text-right uppercase text-xs tracking-wider text-gray-500">Filtered Total Quantity:</td>
                <td className="px-6 py-4 text-right">{totalQuantityInView}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      
      {/* Footer / Summary */}
      <div className="p-4 border-t border-gray-200 bg-white flex items-center justify-between">
        <span className="text-sm text-gray-500">
          Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, aggregatedData.length)} of {aggregatedData.length} unique items
        </span>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-sm text-gray-600">Page {currentPage} of {totalPages || 1}</span>
          <button 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Drill-down Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedItem.itemName}</h2>
                <p className="text-sm text-gray-500 mt-1">Found in {selectedItem.occurrences} challans</p>
              </div>
              <button 
                onClick={() => setSelectedItem(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto bg-white flex-1">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="pb-3 font-medium">DC Number</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Location</th>
                    <th className="pb-3 font-medium text-right">Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedItem.sources.map((src, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="py-3 font-medium text-[#3b2fc9]">{src.dcNumber}</td>
                      <td className="py-3 text-gray-600">{new Date(src.dcDate).toLocaleDateString()}</td>
                      <td className="py-3 text-gray-600 capitalize">{src.location}</td>
                      <td className="py-3 text-right font-medium">{src.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
