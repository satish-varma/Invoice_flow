'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, UserPlus, Search, Loader2, ArrowLeft, Sparkles, X, MapPin, IndianRupee } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { NewRelicEmployee } from '@/types/employee';
import { SiteId, SITE_OPTIONS, resolveSiteId, COMPANY_SITES } from '@/types/site';
import {
  getEmployees,
  saveEmployee,
  deleteEmployee,
} from '@/services/newrelicEmployeeService';
import { EmployeeForm } from '@/components/newrelic/employee/employee-form';
import { EmployeeList } from '@/components/newrelic/employee/employee-list';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';

export default function EmployeesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, role, isReadOnly } = useAuth();
  const [employees, setEmployees] = useState<NewRelicEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEmployee, setEditEmployee] = useState<NewRelicEmployee | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterLoc, setFilterLoc] = useState('all');
  const [filterSite, setFilterSite] = useState<string>(user?.assignedSite || 'all');

  const isAdmin = role === 'admin' || role === 'superadmin';

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await getEmployees();
      setEmployees(data);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to load employees' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async (data: Omit<NewRelicEmployee, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (isReadOnly || role === 'guest') {
      toast({ variant: 'destructive', title: 'Read-Only Mode', description: 'Guest account cannot create or edit employees.' });
      return;
    }
    setIsSaving(true);
    try {
      await saveEmployee(data, user?.email || null, editEmployee?.id);
      toast({ title: editEmployee ? 'Employee updated' : 'Employee added' });
      setShowForm(false);
      setEditEmployee(null);
      fetchData();
    } catch {
      toast({ variant: 'destructive', title: 'Failed to save employee' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (emp: NewRelicEmployee) => {
    if (isReadOnly || role === 'guest') {
      toast({ variant: 'destructive', title: 'Read-Only Mode', description: 'Guest account cannot edit employees.' });
      return;
    }
    triggerHaptic('light');
    setEditEmployee(emp);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (emp: NewRelicEmployee) => {
    if (isReadOnly || role === 'guest') {
      toast({ variant: 'destructive', title: 'Read-Only Mode', description: 'Guest account cannot delete employees.' });
      return;
    }
    triggerHaptic('medium');
    if (!confirm(`Delete ${emp.name}? This cannot be undone.`)) return;
    try {
      await deleteEmployee(emp.id!);
      toast({ title: `${emp.name} removed` });
      fetchData();
    } catch {
      toast({ variant: 'destructive', title: 'Delete failed' });
    }
  };

  const handleCancel = () => {
    triggerHaptic('light');
    setShowForm(false);
    setEditEmployee(null);
  };

  const displayEmployees = employees.filter((e) => {
    const site = resolveSiteId(e.siteId);
    const matchSite = filterSite === 'all' || site === filterSite;
    const matchLoc = filterLoc === 'all' || e.location === filterLoc;
    const matchSearch =
      !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.employeeId.toLowerCase().includes(search.toLowerCase()) ||
      e.designation.toLowerCase().includes(search.toLowerCase());
    return matchSite && matchLoc && matchSearch;
  });

  const siteScopedEmployees = employees.filter(e => filterSite === 'all' || resolveSiteId(e.siteId) === filterSite);
  const hydCount = siteScopedEmployees.filter((e) => e.location === 'hyderabad' && e.isActive).length;
  const blrCount = siteScopedEmployees.filter((e) => e.location === 'bangalore' && e.isActive).length;
  const totalSalary = siteScopedEmployees.filter(e => e.isActive).reduce((s, e) => s + (e.monthlySalary || 0), 0);

  return (
    <div className="min-h-screen bg-transparent">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-8 space-y-6">

        {/* Large Title Mobile Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  triggerHaptic('light');
                  router.back();
                }}
                className="sm:hidden p-2 -ml-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 dark:bg-blue-400/10 border border-blue-500/20 text-[#3b2fc9] dark:text-blue-400 text-[10px] sm:text-xs font-black tracking-widest uppercase">
                <Sparkles className="h-3 w-3" />
                <span>HR & Staff Hub</span>
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Team Roster
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Manage staff profiles, designated sites, base salary, and shift timings
            </p>
          </div>

          {isAdmin && !showForm && (
            <button
              onClick={() => {
                triggerHaptic('medium');
                setEditEmployee(null);
                setShowForm(true);
              }}
              className="w-full sm:w-auto h-12 sm:h-10 px-5 rounded-2xl sm:rounded-xl bg-gradient-to-r from-[#3b2fc9] to-indigo-600 hover:from-[#2f25a8] hover:to-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <UserPlus className="h-4 w-4" />
              <span>Add Employee</span>
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Staff" value={siteScopedEmployees.length} color="text-[#3b2fc9] dark:text-indigo-400" icon={<Users className="h-4 w-4 text-[#3b2fc9]" />} />
          <StatCard label="Hyderabad" value={hydCount} color="text-blue-600 dark:text-blue-400" icon={<MapPin className="h-4 w-4 text-blue-600" />} />
          <StatCard label="Bangalore" value={blrCount} color="text-emerald-600 dark:text-emerald-400" icon={<MapPin className="h-4 w-4 text-emerald-600" />} />
          {isAdmin && (
            <StatCard
              label="Payroll"
              value={`₹${(totalSalary / 1000).toFixed(0)}K`}
              color="text-amber-600 dark:text-amber-400"
              icon={<IndianRupee className="h-4 w-4 text-amber-600" />}
              isText
            />
          )}
        </div>

        {/* Form */}
        {showForm && isAdmin && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-md">
            <EmployeeForm
              initialData={editEmployee}
              onSave={handleSave}
              onCancel={handleCancel}
              isSaving={isSaving}
            />
          </div>
        )}

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, ID, designation…"
              className="w-full h-12 sm:h-10 pl-10 pr-10 border border-slate-200/80 dark:border-slate-800 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white"
            />
            {search && (
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setSearch('');
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {isAdmin && (
            <select
              value={filterSite}
              onChange={(e) => {
                triggerHaptic('light');
                setFilterSite(e.target.value);
              }}
              className="h-12 sm:h-10 px-3.5 border border-slate-200/80 dark:border-slate-800 rounded-2xl text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-xs"
            >
              <option value="all">🏢 All Sites</option>
              {SITE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
          <select
            value={filterLoc}
            onChange={(e) => {
              triggerHaptic('light');
              setFilterLoc(e.target.value);
            }}
            className="h-12 sm:h-10 px-3.5 border border-slate-200/80 dark:border-slate-800 rounded-2xl text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-xs"
          >
            <option value="all">📍 All Locations</option>
            <option value="hyderabad">Hyderabad</option>
            <option value="bangalore">Bangalore</option>
          </select>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-[#3b2fc9]" />
          </div>
        ) : (
          <EmployeeList
            employees={displayEmployees}
            onEdit={isAdmin ? handleEdit : () => {}}
            onDelete={isAdmin ? handleDelete : () => {}}
            isAdmin={isAdmin}
          />
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  icon,
  isText,
}: {
  label: string;
  value: number | string;
  color: string;
  icon?: React.ReactNode;
  isText?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] p-3.5 sm:p-4 space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        {icon && <div className="p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800">{icon}</div>}
      </div>
      <p className={cn("font-mono font-black", color, isText ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl')}>
        {value}
      </p>
    </div>
  );
}

