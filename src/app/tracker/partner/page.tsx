'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { TrackerHeader } from '@/components/tracker/TrackerHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Building2,
  FileText,
  DollarSign,
  Download,
  ExternalLink,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Landmark,
  UserCheck,
  Calendar,
  Layers,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function HungerBoxPartnerPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  // State management
  const [activeTab, setActiveTab] = useState<
    'company-paid' | 'cash-and-carry' | 'commission-invoices' | 'zoho-statements' | 'companies'
  >('company-paid');

  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingTurso, setIsSyncingTurso] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Partner data state
  const [userProfile, setUserProfile] = useState<any>(null);
  const [companyPaidInvoices, setCompanyPaidInvoices] = useState<any[]>([]);
  const [companyPaidCounts, setCompanyPaidCounts] = useState<any>({
    totalInvoiceCount: 0,
    settledInvoiceCount: 0,
    ongoingInvoiceCount: 0,
    pendingInvoiceCount: 0,
  });
  const [cncPayments, setCncPayments] = useState<any[]>([]);
  const [commissionInvoices, setCommissionInvoices] = useState<any[]>([]);
  const [commissionType, setCommissionType] = useState<'companyPaid' | 'cashNCarry'>('companyPaid');
  const [zohoDownloads, setZohoDownloads] = useState<any[]>([]);
  const [filterData, setFilterData] = useState<any>(null);

  // Settlement breakdown modal state
  const [selectedSettlementId, setSelectedSettlementId] = useState<string | null>(null);
  const [settlementDetails, setSettlementDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Statement generation modal state
  const [isStmtModalOpen, setIsStmtModalOpen] = useState(false);
  const [stmtFromDate, setStmtFromDate] = useState('2026-10-01');
  const [stmtToDate, setStmtToDate] = useState('2026-11-07');
  const [stmtPaymentType, setStmtPaymentType] = useState<'companyPaid' | 'cashNCarry'>('companyPaid');
  const [generatingStmt, setGeneratingStmt] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  // Initial load
  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch summary (profile, counts, latest CNC payments)
      const sumRes = await fetch('/api/tracker/partner?action=summary');
      const sumData = await sumRes.json();
      if (sumData.success && sumData.data) {
        setUserProfile(sumData.data.userProfile);
        if (sumData.data.companyPaidCounts) {
          setCompanyPaidCounts(sumData.data.companyPaidCounts);
        }
        if (Array.isArray(sumData.data.recentSettlements)) {
          setCncPayments(sumData.data.recentSettlements);
        }
      }

      // 2. Fetch Company Paid invoices
      const cpRes = await fetch('/api/tracker/partner?action=company-paid&limit=100');
      const cpData = await cpRes.json();
      if (cpData.success && cpData.data?.invoices) {
        setCompanyPaidInvoices(cpData.data.invoices);
        if (cpData.data.counts) {
          setCompanyPaidCounts(cpData.data.counts);
        }
      }
    } catch (err) {
      console.error('Failed to load HungerBox Partner data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Lazy load tab data
  useEffect(() => {
    if (activeTab === 'cash-and-carry' && cncPayments.length <= 10) {
      fetch('/api/tracker/partner?action=cash-and-carry&limit=50')
        .then((res) => res.json())
        .then((res) => {
          if (res.success && res.data?.paymentAdviceDetails) {
            setCncPayments(res.data.paymentAdviceDetails);
          }
        })
        .catch(console.error);
    } else if (activeTab === 'commission-invoices') {
      fetch(`/api/tracker/partner?action=commission-invoices&paymentType=${commissionType}&limit=50`)
        .then((res) => res.json())
        .then((res) => {
          if (res.success && res.data?.commissionInvoiceDetails) {
            setCommissionInvoices(res.data.commissionInvoiceDetails);
          }
        })
        .catch(console.error);
    } else if (activeTab === 'zoho-statements') {
      fetch('/api/tracker/partner?action=zoho-downloads&paymentType=companyPaid')
        .then((res) => res.json())
        .then((res) => {
          if (res.success && res.data?.downloads) {
            setZohoDownloads(res.data.downloads);
          }
        })
        .catch(console.error);
    } else if (activeTab === 'companies' && !filterData) {
      fetch('/api/tracker/partner?action=filters')
        .then((res) => res.json())
        .then((res) => {
          if (res.success && res.data) {
            setFilterData(res.data);
          }
        })
        .catch(console.error);
    }
  }, [activeTab, commissionType]);

  // Load settlement details
  const handleViewBreakdown = async (settlementId: string) => {
    setSelectedSettlementId(settlementId);
    setLoadingDetails(true);
    setSettlementDetails(null);
    try {
      const res = await fetch(`/api/tracker/partner?action=advice-details&settlementId=${settlementId}`);
      const data = await res.json();
      if (data.success && data.data) {
        setSettlementDetails(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch breakdown:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Sync to Turso database
  const handleSyncTurso = async () => {
    try {
      setIsSyncingTurso(true);
      const res = await fetch('/api/tracker/partner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-to-turso', orgId: 'default' }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Successfully synced ${data.syncedCount} settlements into your Remittances database!`);
      } else {
        alert(data.error || 'Failed to sync');
      }
    } catch (err: any) {
      alert(`Sync error: ${err.message}`);
    } finally {
      setIsSyncingTurso(false);
    }
  };

  // Generate Zoho statement
  const handleGenerateStatement = async () => {
    try {
      setGeneratingStmt(true);
      setGeneratedLink(null);
      const res = await fetch('/api/tracker/partner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-statement',
          fromDate: stmtFromDate,
          toDate: stmtToDate,
          paymentType: stmtPaymentType,
          format: 'pdf',
        }),
      });
      const data = await res.json();
      if (data.success && data.data?.fileLink) {
        setGeneratedLink(data.data.fileLink);
        // Refresh downloads list
        fetch(`/api/tracker/partner?action=zoho-downloads&paymentType=${stmtPaymentType}`)
          .then((r) => r.json())
          .then((r) => {
            if (r.success && r.data?.downloads) setZohoDownloads(r.data.downloads);
          });
      } else {
        alert(data.error || 'Failed to generate statement');
      }
    } catch (err: any) {
      alert(`Statement generation error: ${err.message}`);
    } finally {
      setGeneratingStmt(false);
    }
  };

  // Filtered Company-Paid Invoices
  const filteredCompanyPaid = useMemo(() => {
    return companyPaidInvoices.filter((inv) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        inv.invoiceNumber?.toLowerCase().includes(q) ||
        inv.companyName?.toLowerCase().includes(q) ||
        inv.poId?.toLowerCase().includes(q) ||
        inv.serviceMonth?.toLowerCase().includes(q);

      const matchStatus =
        statusFilter === 'ALL' ||
        inv.status?.toLowerCase() === statusFilter.toLowerCase();

      return matchSearch && matchStatus;
    });
  }, [companyPaidInvoices, searchQuery, statusFilter]);

  // Filtered C&C Payments
  const filteredCnc = useMemo(() => {
    return cncPayments.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        p.settlementID?.toLowerCase().includes(q) ||
        p.companyName?.toLowerCase().includes(q) ||
        p.counterName?.toLowerCase().includes(q) ||
        p.dateRange?.toLowerCase().includes(q)
      );
    });
  }, [cncPayments, searchQuery]);

  return (
    <div className="space-y-6">
      {/* ── Top Header ── */}
      <TrackerHeader
        title="HungerBox Partner Portal"
        subtitle="Direct live API connection with partner.hungerbox.com. Real-time DC payments, Cash & Carry remittance advices, commission invoices, and vendor account statements."
        badge="Live Portal API"
        onSync={loadInitialData}
        isSyncing={isLoading}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsStmtModalOpen(true)}
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              <FileText className="w-4 h-4 mr-1.5" />
              Generate Statement
            </Button>
            <Button
              size="sm"
              onClick={handleSyncTurso}
              disabled={isSyncingTurso}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${isSyncingTurso ? 'animate-spin' : ''}`} />
              {isSyncingTurso ? 'Syncing...' : 'Sync to Remittances'}
            </Button>
          </div>
        }
      />

      {/* ── Master Vendor & Bank Details Card ── */}
      {userProfile && (
        <Card className="border-indigo-100 bg-linear-to-r from-indigo-50/60 via-white to-sky-50/40 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                  <Landmark className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 text-base">
                      {userProfile.master_vendor_details?.registered_name || 'THE GUT GURU'}
                    </h3>
                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs">
                      Master Vendor #{userProfile.master_vendor_details?.id || 5009}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Account: <span className="font-mono font-medium text-gray-800">{userProfile.master_vendor_details?.account_number || '50200095177481'}</span> ({userProfile.master_vendor_details?.bank_name || 'HDFC Bank'}) • IFSC: <span className="font-mono text-gray-800">{userProfile.master_vendor_details?.ifsc_code || 'HDFC0000045'}</span> • PAN: <span className="font-mono text-gray-800">{userProfile.master_vendor_details?.pan || 'DDTPJ6536D'}</span>
                  </p>
                </div>
              </div>

              {userProfile.relationship_manager_user && (
                <div className="flex items-center gap-2.5 bg-white/80 border border-indigo-100 rounded-lg px-3 py-2 text-xs">
                  <UserCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <span className="text-gray-500">HungerBox RM:</span>{' '}
                    <span className="font-medium text-gray-900">{userProfile.relationship_manager_user.name}</span>
                    <span className="text-gray-400 mx-1">•</span>
                    <span className="text-indigo-600 font-mono">{userProfile.relationship_manager_user.mobile_number}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Key Metrics Overview ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-gray-200 shadow-2xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
              <span>Total DC Invoices</span>
              <FileText className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900 mt-2">
              {companyPaidCounts.totalInvoiceCount || 0}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">Across all client companies</div>
          </CardContent>
        </Card>

        <Card className="border-emerald-100 bg-emerald-50/20 shadow-2xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-emerald-700 text-xs font-medium">
              <span>Settled Invoices</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-700 mt-2">
              {companyPaidCounts.settledInvoiceCount || 0}
            </div>
            <div className="text-[11px] text-emerald-600 mt-0.5">Payment received &amp; cleared</div>
          </CardContent>
        </Card>

        <Card className="border-amber-100 bg-amber-50/20 shadow-2xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-amber-700 text-xs font-medium">
              <span>Ongoing / Processing</span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-amber-700 mt-2">
              {companyPaidCounts.ongoingInvoiceCount || 0}
            </div>
            <div className="text-[11px] text-amber-600 mt-0.5">Under invoice review / cycle</div>
          </CardContent>
        </Card>

        <Card className="border-sky-100 bg-sky-50/20 shadow-2xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sky-700 text-xs font-medium">
              <span>Pending Submission</span>
              <AlertCircle className="w-4 h-4 text-sky-600" />
            </div>
            <div className="text-2xl font-bold text-sky-700 mt-2">
              {companyPaidCounts.pendingInvoiceCount || 0}
            </div>
            <div className="text-[11px] text-sky-600 mt-0.5">Pending vendor validation</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Sub-Navigation Tabs ── */}
      <div className="flex flex-wrap gap-1.5 p-1 bg-gray-100/80 rounded-xl border border-gray-200">
        <button
          onClick={() => {
            setActiveTab('company-paid');
            setSearchQuery('');
          }}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-all ${
            activeTab === 'company-paid'
              ? 'bg-white text-indigo-700 shadow-xs font-semibold'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          Company-Paid (DC Invoices)
          <span className="ml-1 px-1.5 py-0.2 bg-indigo-50 text-indigo-700 rounded-full text-[10px]">
            {companyPaidCounts.totalInvoiceCount || companyPaidInvoices.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab('cash-and-carry');
            setSearchQuery('');
          }}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-all ${
            activeTab === 'cash-and-carry'
              ? 'bg-white text-indigo-700 shadow-xs font-semibold'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          C&amp;C Remittance Advices
          <span className="ml-1 px-1.5 py-0.2 bg-emerald-50 text-emerald-700 rounded-full text-[10px]">
            {cncPayments.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab('commission-invoices');
            setSearchQuery('');
          }}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-all ${
            activeTab === 'commission-invoices'
              ? 'bg-white text-indigo-700 shadow-xs font-semibold'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          HB Commission Tax Invoices
        </button>

        <button
          onClick={() => {
            setActiveTab('zoho-statements');
            setSearchQuery('');
          }}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-all ${
            activeTab === 'zoho-statements'
              ? 'bg-white text-indigo-700 shadow-xs font-semibold'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          Zoho Statements
        </button>

        <button
          onClick={() => {
            setActiveTab('companies');
            setSearchQuery('');
          }}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition-all ${
            activeTab === 'companies'
              ? 'bg-white text-indigo-700 shadow-xs font-semibold'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Mapped Clients &amp; Counters
        </button>
      </div>

      {/* ── Tab Content: 1. Company-Paid Invoices (DCs) ── */}
      {activeTab === 'company-paid' && (
        <Card className="border-gray-200 shadow-2xs">
          <CardHeader className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-gray-900">
                Company-Paid (DC) Invoices
              </CardTitle>
              <CardDescription className="text-xs text-gray-500">
                Delivery challans and invoices billed directly to corporate clients via HungerBox
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-48 sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search invoice, company, PO..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 text-xs h-8 bg-gray-50/50"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 px-2.5 text-xs rounded-md border border-gray-200 bg-white text-gray-700"
              >
                <option value="ALL">All Status</option>
                <option value="paid">Paid</option>
                <option value="ongoing">Ongoing</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-16 text-center text-gray-400 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                Loading company-paid invoices...
              </div>
            ) : filteredCompanyPaid.length === 0 ? (
              <div className="py-16 text-center text-gray-400 text-xs">
                No company-paid invoices match your search.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50/70 border-b border-gray-200 text-gray-600 font-medium">
                      <th className="py-2.5 px-4">Invoice Number</th>
                      <th className="py-2.5 px-4">Company / Client</th>
                      <th className="py-2.5 px-4">Service Month</th>
                      <th className="py-2.5 px-4">PO ID</th>
                      <th className="py-2.5 px-4 text-right">Invoice Amount</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                      <th className="py-2.5 px-4">Received Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredCompanyPaid.map((inv, idx) => {
                      const isPaid = inv.status?.toLowerCase() === 'paid';
                      const isOngoing = inv.status?.toLowerCase() === 'ongoing';
                      const amountNum = parseFloat(inv.amount || '0');

                      return (
                        <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-medium text-gray-900">
                            {inv.invoiceNumber}
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-800">
                            {inv.companyName}
                            {inv.sourceState && (
                              <span className="text-[10px] text-gray-400 ml-1.5 font-normal">
                                ({inv.sourceState})
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-600 font-mono text-[11px]">
                            {inv.serviceMonth}
                          </td>
                          <td className="py-3 px-4 font-mono text-gray-500 text-[11px]">
                            {inv.poId || '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-gray-900">
                            ₹{amountNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge
                              className={`text-[10px] px-2 py-0.5 border ${
                                isPaid
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : isOngoing
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-sky-50 text-sky-700 border-sky-200'
                              }`}
                            >
                              {inv.status ? inv.status.toUpperCase() : 'PENDING'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-gray-500 text-[11px]">
                            {inv.dateReceived || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Tab Content: 2. Cash & Carry Payment Advices ── */}
      {activeTab === 'cash-and-carry' && (
        <Card className="border-gray-200 shadow-2xs">
          <CardHeader className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-gray-900">
                Cash &amp; Carry Remittance Advices
              </CardTitle>
              <CardDescription className="text-xs text-gray-500">
                Settlements and bank advice PDFs for stall transactions (2 payout cycles per week)
              </CardDescription>
            </div>

            <div className="relative w-48 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search settlement, counter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-8 bg-gray-50/50"
              />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {filteredCnc.length === 0 ? (
              <div className="py-16 text-center text-gray-400 text-xs">
                No payment advices found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50/70 border-b border-gray-200 text-gray-600 font-medium">
                      <th className="py-2.5 px-4">Settlement ID</th>
                      <th className="py-2.5 px-4">Cycle Date Range</th>
                      <th className="py-2.5 px-4">Counter &amp; Location</th>
                      <th className="py-2.5 px-4 text-right">Net Payable</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredCnc.map((item, idx) => (
                      <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-indigo-700">
                          #{item.settlementID}
                        </td>
                        <td className="py-3 px-4 text-gray-700 font-medium">
                          {item.dateRange}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-gray-900">{item.counterName}</div>
                          <div className="text-[11px] text-gray-500 truncate max-w-xs">
                            {item.companyName}
                            {item.cafeteriaNames && item.cafeteriaNames.length > 0 && (
                              <span className="text-gray-400 ml-1">({item.cafeteriaNames.join(', ')})</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                          ₹{item.netPayable}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {item.statusFormatted || item.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewBreakdown(item.settlementID)}
                              className="h-7 px-2.5 text-[11px] border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                            >
                              Breakdown
                            </Button>
                            {item.fileUrl && (
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="h-7 px-2.5 text-[11px] border-gray-200 text-gray-700 hover:bg-gray-50"
                              >
                                <a href={item.fileUrl} target="_blank" rel="noopener noreferrer">
                                  <Download className="w-3 h-3 mr-1 text-gray-500" />
                                  PDF
                                </a>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Tab Content: 3. Commission Invoices ── */}
      {activeTab === 'commission-invoices' && (
        <Card className="border-gray-200 shadow-2xs">
          <CardHeader className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold text-gray-900">
                HungerBox Commission Tax Invoices
              </CardTitle>
              <CardDescription className="text-xs text-gray-500">
                Monthly official GST tax invoices issued by HungerBox for marketplace &amp; management fees
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={commissionType === 'companyPaid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCommissionType('companyPaid')}
                className={`text-xs h-7 ${commissionType === 'companyPaid' ? 'bg-indigo-600' : ''}`}
              >
                Company Paid
              </Button>
              <Button
                variant={commissionType === 'cashNCarry' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCommissionType('cashNCarry')}
                className={`text-xs h-7 ${commissionType === 'cashNCarry' ? 'bg-indigo-600' : ''}`}
              >
                Cash &amp; Carry
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {commissionInvoices.length === 0 ? (
              <div className="py-16 text-center text-gray-400 text-xs">
                No commission invoices found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50/70 border-b border-gray-200 text-gray-600 font-medium">
                      <th className="py-2.5 px-4">Invoice Number</th>
                      <th className="py-2.5 px-4">State</th>
                      <th className="py-2.5 px-4">Service Period</th>
                      <th className="py-2.5 px-4 text-right">Invoice PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {commissionInvoices.map((inv, idx) => (
                      <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-gray-900">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {inv.sourceState ? inv.sourceState.join(', ') : 'Telangana'}
                        </td>
                        <td className="py-3 px-4 text-gray-500 font-mono text-[11px]">
                          {inv.serviceMonth || inv.invoiceDate || '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {inv.supportingDocumentUrl ? (
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                            >
                              <a href={inv.supportingDocumentUrl} target="_blank" rel="noopener noreferrer">
                                <Download className="w-3 h-3 mr-1 text-indigo-600" />
                                Download PDF
                              </a>
                            </Button>
                          ) : (
                            <span className="text-gray-400 text-[11px]">No file</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Tab Content: 4. Zoho Statements & Historical Downloads ── */}
      {activeTab === 'zoho-statements' && (
        <div className="space-y-4">
          <Card className="border-indigo-100 bg-linear-to-r from-indigo-50/40 via-white to-sky-50/30 shadow-2xs">
            <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Generate Custom Zoho Statement</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Produce signed statement of accounts for any financial year or date range
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setIsStmtModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
              >
                <FileText className="w-4 h-4 mr-1.5" />
                Generate Statement PDF
              </Button>
            </CardContent>
          </Card>

          <Card className="border-gray-200 shadow-2xs">
            <CardHeader className="p-4 sm:p-5 border-b border-gray-100">
              <CardTitle className="text-base font-semibold text-gray-900">
                Available Statements
              </CardTitle>
              <CardDescription className="text-xs text-gray-500">
                Historical vendor statements generated for The Gut Guru
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {zohoDownloads.length === 0 ? (
                <div className="py-16 text-center text-gray-400 text-xs">
                  No statements available. Click "Generate Statement PDF" above to generate one.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50/70 border-b border-gray-200 text-gray-600 font-medium">
                        <th className="py-2.5 px-4">Period</th>
                        <th className="py-2.5 px-4">Type</th>
                        <th className="py-2.5 px-4">Generated At</th>
                        <th className="py-2.5 px-4">File Name</th>
                        <th className="py-2.5 px-4 text-right">Download</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {zohoDownloads.map((dl, idx) => (
                        <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-medium text-gray-900">
                            {dl.fromDate} → {dl.toDate}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-[10px]">
                              {dl.paymentType}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-gray-500 text-[11px] font-mono">
                            {dl.createdAt}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-gray-600 max-w-xs truncate">
                            {dl.fileName}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {dl.fileDownloadUrl && (
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                              >
                                <a href={dl.fileDownloadUrl} target="_blank" rel="noopener noreferrer">
                                  <Download className="w-3 h-3 mr-1 text-indigo-600" />
                                  Download PDF
                                </a>
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Tab Content: 5. Mapped Companies & Counters ── */}
      {activeTab === 'companies' && (
        <Card className="border-gray-200 shadow-2xs">
          <CardHeader className="p-4 sm:p-5 border-b border-gray-100">
            <CardTitle className="text-base font-semibold text-gray-900">
              Mapped Client Companies &amp; Vendor Counters
            </CardTitle>
            <CardDescription className="text-xs text-gray-500">
              Corporate clients and service counters configured under Master Vendor #5009
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            {filterData ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-xs text-gray-700 mb-3 uppercase tracking-wider">
                    Client Companies ({filterData.companies?.length || 0})
                  </h4>
                  <div className="space-y-1.5 max-h-96 overflow-y-auto pr-2">
                    {filterData.companies?.map((c: any, i: number) => (
                      <div
                        key={i}
                        className="p-2 rounded-lg bg-gray-50 border border-gray-200/70 text-xs flex items-center justify-between"
                      >
                        <span className="font-medium text-gray-800">{c.name}</span>
                        <span className="text-[10px] font-mono text-gray-400">ID: {c.id}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-xs text-gray-700 mb-3 uppercase tracking-wider">
                    Vendor Counters ({filterData.vendorCounters?.length || 0})
                  </h4>
                  <div className="space-y-1.5 max-h-96 overflow-y-auto pr-2">
                    {filterData.vendorCounters?.map((vc: any, i: number) => (
                      <div
                        key={i}
                        className="p-2 rounded-lg bg-gray-50 border border-gray-200/70 text-xs flex items-center justify-between"
                      >
                        <span className="font-medium text-gray-800">{vc.name}</span>
                        <span className="text-[10px] font-mono text-gray-400">ID: {vc.id}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-gray-400 text-xs">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-600" />
                Loading mapped companies...
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Modal: Settlement Advice Details Breakdown ── */}
      <Dialog
        open={!!selectedSettlementId}
        onOpenChange={(open) => {
          if (!open) setSelectedSettlementId(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900">
              Payment Advice Breakdown #{selectedSettlementId}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Full breakdown of gross sales, HungerBox commissions, GST, TCS and net payable
            </DialogDescription>
          </DialogHeader>

          {loadingDetails ? (
            <div className="py-12 text-center text-gray-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
              Loading remittance breakdown...
            </div>
          ) : settlementDetails ? (
            <div className="space-y-4 pt-2">
              {/* Header metrics */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <div className="text-[11px] text-gray-500 font-medium">Total Sales</div>
                  <div className="text-base font-bold text-gray-900 font-mono mt-0.5">
                    ₹{settlementDetails.paymentAdviceDetails?.totalSales}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-rose-600 font-medium">Total Deductions</div>
                  <div className="text-base font-bold text-rose-600 font-mono mt-0.5">
                    -₹{settlementDetails.paymentAdviceDetails?.totalDeductions}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-emerald-700 font-medium">Net Remittance</div>
                  <div className="text-base font-bold text-emerald-700 font-mono mt-0.5">
                    ₹{settlementDetails.paymentAdviceDetails?.netPayable}
                  </div>
                </div>
              </div>

              {/* Deductions Breakdown */}
              <div>
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Deductions &amp; Commissions
                </h4>
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden text-xs">
                  {settlementDetails.paymentAdviceDeductions?.map((d: any, i: number) => (
                    <div key={i} className="p-2.5 flex items-center justify-between bg-white hover:bg-gray-50/50">
                      <span className="text-gray-700">{d.deductionName}</span>
                      <span className="font-mono font-medium text-gray-900">₹{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* PDF Document Download */}
              {settlementDetails.paymentAdviceDocuments?.[0]?.fileUrl && (
                <div className="pt-2 flex justify-end">
                  <Button asChild size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
                    <a
                      href={settlementDetails.paymentAdviceDocuments[0].fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      Download Official Payment Advice PDF
                    </a>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="py-6 text-center text-gray-400 text-xs">
              Breakdown could not be retrieved.
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Modal: Generate Zoho Vendor Statement ── */}
      <Dialog open={isStmtModalOpen} onOpenChange={setIsStmtModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900">
              Generate Zoho Vendor Statement
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Select date range and payment type to request a signed vendor statement PDF
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Payment Stream</label>
              <select
                value={stmtPaymentType}
                onChange={(e) => setStmtPaymentType(e.target.value as any)}
                className="w-full h-9 px-3 text-xs rounded-md border border-gray-200 bg-white"
              >
                <option value="companyPaid">Company Paid (DC Orders / Invoices)</option>
                <option value="cashNCarry">Cash &amp; Carry (Stalls &amp; Cafeterias)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">From Date</label>
                <Input
                  type="date"
                  value={stmtFromDate}
                  onChange={(e) => setStmtFromDate(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">To Date</label>
                <Input
                  type="date"
                  value={stmtToDate}
                  onChange={(e) => setStmtToDate(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
            </div>

            {generatedLink && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between">
                <span>Statement generated successfully!</span>
                <Button asChild size="sm" variant="outline" className="h-7 text-xs border-emerald-300 text-emerald-700 bg-white">
                  <a href={generatedLink} target="_blank" rel="noopener noreferrer">
                    <Download className="w-3 h-3 mr-1" />
                    Download PDF
                  </a>
                </Button>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsStmtModalOpen(false)}
                className="text-xs"
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={handleGenerateStatement}
                disabled={generatingStmt}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
              >
                {generatingStmt ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate PDF'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
