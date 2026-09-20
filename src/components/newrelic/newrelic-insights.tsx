import React, { useMemo, useRef, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import { NewRelicChallan, NEWRELIC_LOCATIONS } from '@/services/newrelicChallanService';
import { FileText, Package, MapPin, Download, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface NewRelicInsightsProps {
  challans: NewRelicChallan[];
}

const COLORS = ['#3b2fc9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export function NewRelicInsights({ challans }: NewRelicInsightsProps) {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  // 1. Trend Data (Volume per month in the filtered set)
  const trendData = useMemo(() => {
    const monthCounts: Record<string, { challans: number; items: number }> = {};
    challans.forEach(c => {
      const date = new Date(c.dcDate);
      const monthStr = date.toLocaleString('default', { month: 'short', year: '2-digit' });
      
      if (!monthCounts[monthStr]) {
        monthCounts[monthStr] = { challans: 0, items: 0 };
      }
      monthCounts[monthStr].challans += 1;
      
      const itemQty = c.lineItems.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
      monthCounts[monthStr].items += itemQty;
    });

    // Sort chronologically (rough sort by assuming data isn't spanning decades, or just string sort by standard JS)
    // To properly sort, we can extract timestamp, but since we just want a rough view, 
    // let's sort by date of the first occurrence of that month
    const sortedKeys = Object.keys(monthCounts).sort((a, b) => {
      const dateA = new Date(`01 ${a}`);
      const dateB = new Date(`01 ${b}`);
      return dateA.getTime() - dateB.getTime();
    });

    return sortedKeys.map(k => ({
      name: k,
      Challans: monthCounts[k].challans,
      Items: monthCounts[k].items,
    }));
  }, [challans]);

  // 2. Location Split
  const locationData = useMemo(() => {
    const counts: Record<string, number> = {};
    challans.forEach(c => {
      const label = NEWRELIC_LOCATIONS[c.location]?.label || c.location;
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.keys(counts).map(k => ({ name: k, value: counts[k] }));
  }, [challans]);

  // 2b. Brand Split
  const brandData = useMemo(() => {
    const counts: Record<string, number> = {};
    challans.forEach(c => {
      c.lineItems.forEach(item => {
        const brand = item.brandName?.trim() || 'Unknown Brand';
        counts[brand] = (counts[brand] || 0) + (Number(item.quantity) || 0);
      });
    });
    // Sort and take top 10 if there are too many
    return Object.keys(counts)
      .map(k => ({ name: k, value: counts[k] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [challans]);

  // 3. Top Items Dispatched
  const topItemsData = useMemo(() => {
    const itemCounts: Record<string, number> = {};
    challans.forEach(c => {
      c.lineItems.forEach(item => {
        const name = item.itemName || 'Unknown Item';
        itemCounts[name] = (itemCounts[name] || 0) + Number(item.quantity);
      });
    });

    // Sort by quantity descending and take top 5
    return Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name, Quantity: qty }));
  }, [challans]);

  const totalItemsDispatched = topItemsData.reduce((acc, curr) => acc + curr.Quantity, 0);

  // 4. Total Value
  const financials = useMemo(() => {
    return challans.reduce((acc, challan) => {
      const mrpTotal = (challan.lineItems || []).reduce((sum, item) => sum + ((item.mrp || 0) * (item.quantity || 1)), 0);
      const revenue = mrpTotal - (mrpTotal * 0.055);
      const cost = (challan.procurementCost || 0) + (challan.transportCost || 0) + (challan.otherCharges || 0);
      return {
        revenue: acc.revenue + revenue,
        cost: acc.cost + cost,
        profit: acc.profit + (revenue - cost),
      };
    }, { revenue: 0, cost: 0, profit: 0 });
  }, [challans]);

  const handleExportPDF = async () => {
    if (!dashboardRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(dashboardRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);
      pdf.save('NewRelic_Insights_Report.pdf');
    } catch (error) {
      console.error('Failed to export PDF', error);
      alert('Failed to generate PDF report.');
    } finally {
      setIsExporting(false);
    }
  };

  if (challans.length === 0) {
    return (
      <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
        <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No Data Available</h3>
        <p className="text-sm text-gray-500 mt-1">There are no challans in the current view to analyze.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      <div className="flex items-center justify-end">
        <button
          onClick={handleExportPDF}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
        >
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export Report
        </button>
      </div>

      <div ref={dashboardRef} className="space-y-6 bg-gray-50 p-1 sm:p-2">
        {/* Top Cards for Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Challans Analyzed</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{challans.length}</p>
          </div>
          <div className="bg-[#3b2fc9]/10 p-3 rounded-full">
            <FileText className="h-6 w-6 text-[#3b2fc9]" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Top 5 Items Volume</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{totalItemsDispatched}</p>
          </div>
          <div className="bg-emerald-100 p-3 rounded-full">
            <Package className="h-6 w-6 text-emerald-600" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Revenue</p>
            <p className="text-2xl font-bold text-gray-900 mt-1" title={`₹${financials.revenue.toLocaleString('en-IN')}`}>
              ₹{financials.revenue > 10000000 
                  ? (financials.revenue / 10000000).toFixed(2) + ' Cr' 
                  : financials.revenue > 100000 
                    ? (financials.revenue / 100000).toFixed(2) + ' L' 
                    : financials.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="bg-amber-100 p-3 rounded-full">
            <span className="text-amber-600 font-bold text-lg">₹</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Profit</p>
            <p className={`text-2xl font-bold mt-1 ${financials.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`} title={`₹${financials.profit.toLocaleString('en-IN')}`}>
              {financials.profit < 0 ? '-' : ''}₹{Math.abs(financials.profit) > 10000000 
                  ? (Math.abs(financials.profit) / 10000000).toFixed(2) + ' Cr' 
                  : Math.abs(financials.profit) > 100000 
                    ? (Math.abs(financials.profit) / 100000).toFixed(2) + ' L' 
                    : Math.abs(financials.profit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className={`p-3 rounded-full ${financials.profit >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
            <span className={`font-bold text-lg ${financials.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>₹</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Volume Trend</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dx={-10} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dx={10} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{stroke: '#e5e7eb', strokeWidth: 2}}
                />
                <Legend verticalAlign="top" height={36} />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  name="Challans"
                  dataKey="Challans" 
                  stroke="#3b2fc9" 
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} 
                  activeDot={{ r: 6, stroke: '#3b2fc9', strokeWidth: 0, fill: '#3b2fc9' }} 
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  name="Total Items"
                  dataKey="Items" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} 
                  activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 0, fill: '#10b981' }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Location Split */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Location Split</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={locationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {locationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#1f2937', fontWeight: 500 }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Brand Split */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm lg:col-span-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Brand Volume</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={brandData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {brandData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#1f2937', fontWeight: 500 }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Items Chart */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Dispatched Items</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topItemsData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#4b5563', fontSize: 13, fontWeight: 500}} width={150} />
                <Tooltip 
                  cursor={{fill: '#f9fafb'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="Quantity" fill="#10b981" radius={[0, 4, 4, 0]} barSize={32}>
                  {topItemsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 1) % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        </div>
      </div>
    </div>
  );
}
