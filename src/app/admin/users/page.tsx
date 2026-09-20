'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { hashPassword } from '@/lib/hash';
import { useAuth, AppUser, UserRole } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, Trash2, Edit2, ShieldAlert } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface DbUser {
  id: string;
  email: string;
  password?: string;
  role: UserRole;
  createdAt?: string;
  preferredLocations?: string[];
  assignedApps?: string[];
}

export default function AdminUsersPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<DbUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<DbUser | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('user');
  const [preferredLocations, setPreferredLocations] = useState<string[]>([]);
  const [assignedApps, setAssignedApps] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ALL_APPS = [
    { id: '/newrelic', label: 'NewRelic' },
    { id: '/invoices', label: 'Invoices' },
    { id: '/declarations', label: 'Declarations' },
    { id: '/delivery-challans', label: 'Delivery Challans' },
    { id: '/quotations', label: 'Quotations' },
    { id: '/payslip', label: 'Payslips' },
    { id: '/offer-letter', label: 'Offer Letters' },
    { id: '/settings', label: 'Settings' }
  ];

  useEffect(() => {
    if (!loading && role !== 'admin') {
      router.push('/newrelic');
    }
  }, [loading, role, router]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const fetchedUsers: DbUser[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DbUser[];
      setUsers(fetchedUsers);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to load users', description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (role === 'admin') {
      loadUsers();
    }
  }, [role]);

  const handleOpenModal = (userToEdit?: DbUser) => {
    if (userToEdit) {
      setEditingUser(userToEdit);
      setEmail(userToEdit.email);
      setPassword(''); // keep blank for editing
      setUserRole(userToEdit.role);
      setPreferredLocations(userToEdit.preferredLocations || []);
      setAssignedApps(userToEdit.assignedApps || []);
    } else {
      setEditingUser(null);
      setEmail('');
      setPassword('');
      setUserRole('user');
      setPreferredLocations([]);
      setAssignedApps([]);
    }
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingUser) {
        // Edit existing
        const updateData: any = { role: userRole, preferredLocations, assignedApps };
        if (password.trim() !== '') {
          updateData.password = hashPassword(password); // Only update password if provided
        }
        await updateDoc(doc(db, 'users', editingUser.id), updateData);
        toast({ title: 'User updated successfully' });
      } else {
        // Create new
        const newEmail = email.toLowerCase().trim();
        // Check if exists
        const q = query(collection(db, 'users'));
        const allUsers = await getDocs(q);
        if (allUsers.docs.some(d => d.data().email === newEmail)) {
          throw new Error("Email already exists");
        }

        const newDocRef = doc(collection(db, 'users'));
        await setDoc(newDocRef, {
          email: newEmail,
          password: hashPassword(password),
          role: userRole,
          preferredLocations,
          assignedApps,
          createdAt: new Date().toISOString()
        });
        toast({ title: 'User created successfully' });
      }
      setIsModalOpen(false);
      loadUsers();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error saving user', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, userEmail: string) => {
    if (user?.email === userEmail) {
      toast({ variant: 'destructive', title: 'Cannot delete yourself' });
      return;
    }
    if (confirm(`Are you sure you want to delete ${userEmail}?`)) {
      try {
        await deleteDoc(doc(db, 'users', id));
        toast({ title: 'User deleted' });
        loadUsers();
      } catch (err: any) {
        toast({ variant: 'destructive', title: 'Error deleting user', description: err.message });
      }
    }
  };

  if (loading || role !== 'admin') {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-[#3b2fc9]" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-[#3b2fc9]" />
            User Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage system users, roles, and access.</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="bg-[#3b2fc9] hover:bg-[#2d23a0]">
          <Plus className="h-4 w-4 mr-2" /> Add User
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Assigned Apps</TableHead>
              <TableHead>Preferred Locations</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-gray-500">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-gray-500">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.email}</TableCell>
                  <TableCell>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                      u.role === 'manager' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {u.role.toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell>
                    {u.role === 'admin' ? (
                      <span className="text-xs text-gray-500 font-medium">All Access</span>
                    ) : u.assignedApps && u.assignedApps.length > 0 ? (
                      <span className="text-xs font-medium text-gray-600">{u.assignedApps.length} Apps</span>
                    ) : (
                      <span className="text-xs text-red-500 italic">No Access</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.preferredLocations && u.preferredLocations.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {u.preferredLocations.map(loc => (
                          <span key={loc} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 capitalize border border-blue-100">
                            {loc}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs italic">None</span>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenModal(u)}>
                      <Edit2 className="h-4 w-4 text-gray-500 hover:text-[#3b2fc9]" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(u.id, u.email)} disabled={u.email === user?.email}>
                      <Trash2 className={`h-4 w-4 ${u.email === user?.email ? 'text-gray-300' : 'text-gray-500 hover:text-red-600'}`} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveUser} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={!!editingUser}
                className={editingUser ? "bg-gray-100" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label>Password {editingUser && <span className="text-xs text-gray-400 font-normal">(Leave blank to keep unchanged)</span>}</Label>
              <Input
                type="password"
                required={!editingUser}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={userRole} onValueChange={(v) => setUserRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-3 pt-2">
              <Label>Preferred Locations</Label>
              <div className="flex items-center gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="loc-hyd" 
                    checked={preferredLocations.includes('hyderabad')}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setPreferredLocations(prev => [...prev, 'hyderabad']);
                      } else {
                        setPreferredLocations(prev => prev.filter(l => l !== 'hyderabad'));
                      }
                    }}
                  />
                  <label htmlFor="loc-hyd" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Hyderabad
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="loc-blr" 
                    checked={preferredLocations.includes('bangalore')}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setPreferredLocations(prev => [...prev, 'bangalore']);
                      } else {
                        setPreferredLocations(prev => prev.filter(l => l !== 'bangalore'));
                      }
                    }}
                  />
                  <label htmlFor="loc-blr" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Bangalore
                  </label>
                </div>
              </div>
            </div>

            {userRole !== 'admin' && (
              <div className="space-y-3 pt-2">
                <Label>Assigned Apps (Endpoints)</Label>
                <div className="grid grid-cols-2 gap-3">
                  {ALL_APPS.map(app => (
                    <div key={app.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`app-${app.id}`}
                        checked={assignedApps.includes(app.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setAssignedApps(prev => [...prev, app.id]);
                          } else {
                            setAssignedApps(prev => prev.filter(a => a !== app.id));
                          }
                        }}
                      />
                      <label htmlFor={`app-${app.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        {app.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-[#3b2fc9] hover:bg-[#2d23a0]" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingUser ? 'Save Changes' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
