'use client';

import React, { useEffect, useState } from 'react';
import { Users, UserPlus, Search, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { NewRelicEmployee } from '@/types/employee';
import {
  getEmployees,
  saveEmployee,
  deleteEmployee,
} from '@/services/newrelicEmployeeService';
import { EmployeeForm } from '@/components/newrelic/employee/employee-form';
import { EmployeeList } from '@/components/newrelic/employee/employee-list';

export default function EmployeesPage() {
  const { toast } = useToast();
  const { user, role } = useAuth();
  const [employees, setEmployees] = useState<NewRelicEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editEmployee, setEditEmployee] = useState<NewRelicEmployee | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterLoc, setFilterLoc] = useState('all');

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
    setEditEmployee(emp);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (emp: NewRelicEmployee) => {
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
    setShowForm(false);
    setEditEmployee(null);
  };

  const displayEmployees = employees.filter((e) => {
    const matchLoc = filterLoc === 'all' || e.location === filterLoc;
    const matchSearch =
      !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.employeeId.toLowerCase().includes(search.toLowerCase()) ||
      e.designation.toLowerCase().includes(search.toLowerCase());
    return matchLoc && matchSearch;
  });

  const hydCount = employees.filter((e) => e.location === 'hyderabad' && e.isActive).length;
  const blrCount = employees.filter((e) => e.location === 'bangalore' && e.isActive).length;
  const totalSalary = employees.filter(e => e.isActive).reduce((s, e) => s + (e.monthlySalary || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-3 sm:px-8 py-4 sm:py-8 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Employees" value={employees.length} color="text-[#3b2fc9]" bg="bg-[#3b2fc9]/5" />
          <StatCard label="Hyderabad" value={hydCount} color="text-blue-600" bg="bg-blue-50" />
          <StatCard label="Bangalore" value={blrCount} color="text-emerald-600" bg="bg-emerald-50" />
          {isAdmin && (
            <StatCard
              label="Monthly Payroll"
              value={`\u20b9${(totalSalary / 1000).toFixed(0)}K`}
              color="text-amber-600"
              bg="bg-amber-50"
              isText
            />
          )}
        </div>

        {/* Add button */}
        {isAdmin && !showForm && (
          <button
            onClick={() => { setEditEmployee(null); setShowForm(true); }}
            className="w-full sm:w-auto flex items-center gap-2 bg-[#3b2fc9] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#3b2fc9]/90 shadow-sm"
          >
            <UserPlus className="h-4 w-4" />
            Add Employee
          </button>
        )}

        {/* Form */}
        {showForm && isAdmin && (
          <EmployeeForm
            initialData={editEmployee}
            onSave={handleSave}
            onCancel={handleCancel}
            isSaving={isSaving}
          />
        )}

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, ID, designation…"
              className="w-full h-9 pl-9 pr-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
            />
          </div>
          <select
            value={filterLoc}
            onChange={(e) => setFilterLoc(e.target.value)}
            className="h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white"
          >
            <option value="all">All Locations</option>
            <option value="hyderabad">Hyderabad</option>
            <option value="bangalore">Bangalore</option>
          </select>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <EmployeeList
            employees={displayEmployees}
            onEdit={isAdmin ? handleEdit : () => {}}
            onDelete={isAdmin ? handleDelete : () => {}}
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
  bg,
  isText,
}: {
  label: string;
  value: number | string;
  color: string;
  bg: string;
  isText?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <p className={`${isText ? 'text-lg' : 'text-2xl'} font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
