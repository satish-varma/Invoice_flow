'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { NewRelicEmployee } from '@/types/employee';
import { generateEmployeeId } from '@/services/newrelicEmployeeService';
import { X, UserCheck, UserPlus, ChevronDown } from 'lucide-react';
import { collection, getDocs, query, orderBy, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { hashPassword } from '@/lib/hash';

interface DbUser {
  id: string;
  email: string;
  role: string;
  preferredLocations?: string[];
}

interface EmployeeFormProps {
  initialData?: NewRelicEmployee | null;
  onSave: (data: Omit<NewRelicEmployee, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

export function EmployeeForm({ initialData, onSave, onCancel, isSaving }: EmployeeFormProps) {
  const isEditing = !!initialData?.id;

  // --- System users ---
  const [systemUsers, setSystemUsers] = useState<DbUser[]>([]);
  const [userMode, setUserMode] = useState<'link' | 'new'>(isEditing ? 'link' : 'link');
  const [selectedUserId, setSelectedUserId] = useState<string>(initialData?.userId || '');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'manager'>('user');
  const [suggestedId, setSuggestedId] = useState('');

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      employeeId: initialData?.employeeId || '',
      name: initialData?.name || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      designation: initialData?.designation || '',
      location: initialData?.location || 'hyderabad',
      monthlySalary: initialData?.monthlySalary || 0,
      joinDate: initialData?.joinDate
        ? initialData.joinDate.substring(0, 10)
        : new Date().toISOString().substring(0, 10),
      isActive: initialData?.isActive !== undefined ? initialData.isActive : true,
    },
  });

  const location = watch('location') as 'hyderabad' | 'bangalore';

  /* ── Load system users ── */
  useEffect(() => {
    getDocs(query(collection(db, 'users'), orderBy('email', 'asc')))
      .then((snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DbUser));
        setSystemUsers(list);
      })
      .catch(() => {});
  }, []);

  /* ── Auto-suggest employee ID ── */
  useEffect(() => {
    if (!isEditing) generateEmployeeId(location).then(setSuggestedId);
  }, [location, isEditing]);

  useEffect(() => {
    if (!isEditing && suggestedId) setValue('employeeId', suggestedId);
  }, [suggestedId, isEditing, setValue]);

  /* ── When an existing user is selected, fill email ── */
  useEffect(() => {
    if (userMode === 'link' && selectedUserId) {
      const u = systemUsers.find((u) => u.id === selectedUserId);
      if (u) setValue('email', u.email);
    }
  }, [selectedUserId, systemUsers, userMode, setValue]);

  /* ── Submit ── */
  const onSubmit = async (values: any) => {
    let linkedUserId = initialData?.userId || '';
    let finalEmail = values.email;

    if (!isEditing) {
      if (userMode === 'link') {
        // Just link — user already exists
        linkedUserId = selectedUserId;
        const u = systemUsers.find((u) => u.id === selectedUserId);
        if (u) finalEmail = u.email;
      } else {
        // Create new user in Firestore users collection
        if (!newUserEmail.trim() || !newUserPassword.trim()) {
          alert('Email and password are required for new user.');
          return;
        }
        const newEmail = newUserEmail.toLowerCase().trim();
        // Check duplicate
        const exists = systemUsers.some((u) => u.email === newEmail);
        if (exists) {
          alert(`A user with email "${newEmail}" already exists. Use "Link existing user" instead.`);
          return;
        }
        const newDocRef = doc(collection(db, 'users'));
        await setDoc(newDocRef, {
          email: newEmail,
          password: hashPassword(newUserPassword),
          role: newUserRole,
          preferredLocations: [values.location],
          assignedApps: ['/newrelic'],
          createdAt: new Date().toISOString(),
        });
        linkedUserId = newDocRef.id;
        finalEmail = newEmail;
      }
    }

    await onSave({
      ...values,
      email: finalEmail,
      userId: linkedUserId,
      monthlySalary: Number(values.monthlySalary),
      joinDate: new Date(values.joinDate).toISOString(),
      isActive: values.isActive === true || values.isActive === 'true',
    });
  };

  const inputCls =
    'w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-gray-800">
          {isEditing ? 'Edit Employee' : 'Add New Employee'}
        </h2>
        <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400">
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* ── User Account Section (add mode only) ── */}
        {!isEditing && (
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">System Account</p>

            {/* Toggle */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setUserMode('link')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  userMode === 'link'
                    ? 'bg-[#3b2fc9] text-white border-[#3b2fc9]'
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <UserCheck className="h-3.5 w-3.5" />
                Link Existing User
              </button>
              <button
                type="button"
                onClick={() => setUserMode('new')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  userMode === 'new'
                    ? 'bg-[#3b2fc9] text-white border-[#3b2fc9]'
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Create New User
              </button>
            </div>

            {userMode === 'link' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Select existing user
                </label>
                <div className="relative">
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full h-9 pl-3 pr-8 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white appearance-none"
                  >
                    <option value="">-- Choose a user --</option>
                    {systemUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.email} ({u.role})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
                {selectedUserId && (
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    <UserCheck className="h-3 w-3" />
                    Linked to:{' '}
                    <span className="font-medium">
                      {systemUsers.find((u) => u.id === selectedUserId)?.email}
                    </span>
                  </p>
                )}
              </div>
            )}

            {userMode === 'new' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className={inputCls}
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Password *</label>
                  <input
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className={inputCls}
                    placeholder="Set a password"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as any)}
                    className={`${inputCls} bg-white`}
                  >
                    <option value="user">User</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
                <p className="sm:col-span-2 text-[11px] text-gray-400">
                  A new login account will be created with access to <strong>/newrelic</strong> and the selected location.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Employee Details ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Employee ID */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Employee ID</label>
            <input
              {...register('employeeId', { required: 'Required' })}
              className={`${inputCls} bg-gray-50`}
              placeholder="Auto-generated"
            />
            {errors.employeeId && (
              <p className="text-red-500 text-xs mt-1">{String(errors.employeeId.message)}</p>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
            <select
              {...register('location')}
              className={`${inputCls} bg-white`}
            >
              <option value="hyderabad">Hyderabad</option>
              <option value="bangalore">Bangalore</option>
            </select>
          </div>

          {/* Name */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
            <input
              {...register('name', { required: 'Name is required' })}
              className={inputCls}
              placeholder="e.g. Rahul Sharma"
            />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1">{String(errors.name.message)}</p>
            )}
          </div>

          {/* Designation */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Designation *</label>
            <input
              {...register('designation', { required: 'Required' })}
              className={inputCls}
              placeholder="e.g. Cafeteria Staff"
            />
            {errors.designation && (
              <p className="text-red-500 text-xs mt-1">{String(errors.designation.message)}</p>
            )}
          </div>

          {/* Monthly Salary */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Monthly Salary (₹)</label>
            <input
              type="number"
              min={0}
              {...register('monthlySalary', { min: 0 })}
              className={inputCls}
              placeholder="0"
            />
          </div>

          {/* Email (shown when editing or when user mode = link with no selection) */}
          {(isEditing || userMode === 'link') && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Email {!isEditing && <span className="text-gray-400">(auto-filled from user)</span>}
              </label>
              <input
                type="email"
                {...register('email')}
                readOnly={!isEditing && userMode === 'link' && !!selectedUserId}
                className={`${inputCls} ${!isEditing && userMode === 'link' && selectedUserId ? 'bg-gray-50 text-gray-500' : ''}`}
                placeholder="auto-filled when user is selected"
              />
            </div>
          )}

          {/* Phone */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
            <input
              {...register('phone')}
              className={inputCls}
              placeholder="optional"
            />
          </div>

          {/* Join Date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Join Date</label>
            <input
              type="date"
              {...register('joinDate')}
              className={inputCls}
            />
          </div>

          {/* Active (edit mode only) */}
          {isEditing && (
            <div className="flex items-center gap-3 pt-1">
              <input
                type="checkbox"
                id="isActive"
                {...register('isActive')}
                className="h-4 w-4 rounded text-[#3b2fc9] focus:ring-[#3b2fc9]"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700 cursor-pointer">
                Active Employee
              </label>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 py-2.5 bg-[#3b2fc9] text-white rounded-xl text-sm font-medium hover:bg-[#3b2fc9]/90 disabled:opacity-50"
          >
            {isSaving
              ? 'Saving…'
              : isEditing
              ? 'Save Changes'
              : userMode === 'new'
              ? 'Create User & Add Employee'
              : 'Add Employee'}
          </button>
        </div>
      </form>
    </div>
  );
}
