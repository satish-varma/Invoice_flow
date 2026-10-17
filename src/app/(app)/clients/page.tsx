
'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { getClients, saveClient, updateClient, deleteClient, Client } from "@/services/clientService";
import { getColumns } from "./columns";
import { DataTable } from "./data-table";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader, PlusCircle, Sparkles, Building2, User } from "lucide-react";
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { AppShell } from "@/components/app-shell";
import { triggerHaptic } from "@/lib/haptics";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ClientsPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Partial<Client> | null>(null);
    const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

    const { toast } = useToast();

    const loadClients = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getClients();
            setClients(data);
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to load clients.',
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadClients();
    }, [loadClients]);

    const handleAddClick = () => {
        setEditingClient({
            name: '',
            address: '',
            gst: '',
            type: 'business'
        });
        setIsAddEditDialogOpen(true);
    };

    const handleEditClick = (client: Client) => {
        setEditingClient({ ...client });
        setIsAddEditDialogOpen(true);
    };

    const handleDeleteClick = (client: Client) => {
        setClientToDelete(client);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!clientToDelete?.id) return;
        try {
            await deleteClient(clientToDelete.id);
            toast({ title: "Client Deleted" });
            loadClients();
        } catch (error) {
            toast({ variant: "destructive", title: "Error deleting client" });
        } finally {
            setIsDeleteDialogOpen(false);
            setClientToDelete(null);
        }
    };

    const handleSaveClient = async () => {
        if (!editingClient?.name || !editingClient?.address) {
            toast({ variant: "destructive", title: "Missing fields" });
            return;
        }

        setIsSaving(true);
        try {
            if (editingClient.id) {
                await updateClient(editingClient.id, editingClient);
                toast({ title: "Client updated" });
            } else {
                await saveClient(editingClient as Omit<Client, 'id'>);
                toast({ title: "Client saved" });
            }
            setIsAddEditDialogOpen(false);
            loadClients();
        } catch (error) {
            toast({ variant: "destructive", title: "Error saving client" });
        } finally {
            setIsSaving(false);
        }
    };

    const columns = React.useMemo(() => getColumns(handleEditClick, handleDeleteClick), []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <AppShell>
            <main className="min-h-screen bg-slate-50/60 dark:bg-slate-950 flex flex-col items-center p-3 sm:p-8">
            <div className="w-full max-w-7xl mx-auto space-y-5 sm:space-y-6">
                {/* Mobile-First Large Title Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic('light');
                                    window.history.back();
                                }}
                                className="sm:hidden p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-300 active:scale-95 transition-all"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] sm:text-xs font-black tracking-widest uppercase shadow-xs">
                                <Sparkles className="h-3 w-3 animate-pulse" />
                                CLIENTS & DIRECTORY
                            </div>
                        </div>

                        <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                            Client Database
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium">
                            Manage customer profiles, GSTINs, and billing addresses
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            asChild
                            className="hidden sm:inline-flex rounded-2xl h-10 border-slate-200 dark:border-slate-800 text-xs font-bold"
                        >
                            <Link href="/">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back
                            </Link>
                        </Button>
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic('light');
                                handleAddClick();
                            }}
                            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 h-11 sm:h-10 px-5 rounded-2xl bg-gradient-to-r from-[#181156] to-[#241775] text-white font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all"
                        >
                            <PlusCircle className="h-4 w-4" />
                            <span>Add Client</span>
                        </button>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] p-3 sm:p-6">
                    <DataTable
                        columns={columns}
                        data={clients}
                        searchPlaceholder="Search clients..."
                        noResultsMessage="No clients found in your registry."
                        exportFileName="clients-export.csv"
                    />
                </div>
            </div>

            {/* Add/Edit Bottom Sheet Dialog */}
            <Dialog open={isAddEditDialogOpen} onOpenChange={setIsAddEditDialogOpen}>
                <DialogContent className="w-full sm:max-w-[600px] rounded-t-3xl sm:rounded-3xl bottom-0 top-auto sm:top-[50%] sm:bottom-auto translate-y-0 sm:translate-y-[-50%] p-0 border-0 overflow-hidden bg-white dark:bg-slate-900 shadow-2xl flex flex-col max-h-[90vh]">
                    {/* Native Drag Handle */}
                    <div className="sm:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

                    <div className="px-5 sm:px-6 pt-3 sm:pt-6 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                                {editingClient?.id ? 'Edit Client' : 'Add New Client'}
                            </DialogTitle>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {editingClient?.id ? 'Update billing details and tax info' : 'Add customer details for invoicing'}
                            </p>
                        </div>
                    </div>

                    <div className="px-5 sm:px-6 py-4 space-y-4 overflow-y-auto">
                        <div className="space-y-1.5">
                            <Label htmlFor="name" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                Client / Company Name <span className="text-rose-500">*</span>
                            </Label>
                            <Input
                                id="name"
                                value={editingClient?.name || ''}
                                onChange={e => setEditingClient(prev => ({ ...prev!, name: e.target.value }))}
                                placeholder="e.g. Acme Technologies Pvt Ltd"
                                className="h-11 rounded-2xl text-sm"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="type" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Entity Type
                                </Label>
                                <Select
                                    value={editingClient?.type || 'business'}
                                    onValueChange={val => setEditingClient(prev => ({ ...prev!, type: val as any }))}
                                >
                                    <SelectTrigger className="h-11 rounded-2xl text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl">
                                        <SelectItem value="business">Business / Corporate</SelectItem>
                                        <SelectItem value="individual">Individual</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="gst" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    GSTIN (Optional)
                                </Label>
                                <Input
                                    id="gst"
                                    value={editingClient?.gst || ''}
                                    onChange={e => setEditingClient(prev => ({ ...prev!, gst: e.target.value }))}
                                    placeholder="22AAAAA0000A1Z5"
                                    className="h-11 rounded-2xl text-sm font-mono uppercase"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="address" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                Billing Address <span className="text-rose-500">*</span>
                            </Label>
                            <Textarea
                                id="address"
                                value={editingClient?.address || ''}
                                onChange={e => setEditingClient(prev => ({ ...prev!, address: e.target.value }))}
                                placeholder="Full registered street address, city, state & pin"
                                rows={3}
                                className="rounded-2xl text-sm resize-none"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="email" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Email (Optional)
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={editingClient?.email || ''}
                                    onChange={e => setEditingClient(prev => ({ ...prev!, email: e.target.value }))}
                                    placeholder="billing@example.com"
                                    className="h-11 rounded-2xl text-sm"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="phone" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Phone (Optional)
                                </Label>
                                <Input
                                    id="phone"
                                    value={editingClient?.phone || ''}
                                    onChange={e => setEditingClient(prev => ({ ...prev!, phone: e.target.value }))}
                                    placeholder="+91 98765 43210"
                                    className="h-11 rounded-2xl text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-4 sm:p-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
                        <DialogClose asChild>
                            <Button
                                variant="outline"
                                onClick={() => triggerHaptic('light')}
                                className="h-11 rounded-2xl font-bold text-xs px-5 border-slate-200 dark:border-slate-800"
                            >
                                Cancel
                            </Button>
                        </DialogClose>
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic('light');
                                handleSaveClient();
                            }}
                            disabled={isSaving}
                            className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-2xl bg-gradient-to-r from-[#181156] to-[#241775] text-white font-bold text-xs shadow-md active:scale-95 disabled:opacity-50 transition-all"
                        >
                            {isSaving && <Loader className="h-4 w-4 animate-spin" />}
                            <span>Save Client</span>
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Alert */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-black text-slate-900 dark:text-white">
                            Delete Client?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-slate-600 dark:text-slate-400">
                            This will permanently remove <strong className="text-slate-900 dark:text-white">{clientToDelete?.name}</strong> from your database.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4 gap-2">
                        <AlertDialogCancel
                            onClick={() => triggerHaptic('light')}
                            className="h-11 rounded-2xl font-bold text-xs"
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                triggerHaptic('light');
                                confirmDelete();
                            }}
                            className="h-11 rounded-2xl font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white shadow-md"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            </main>
        </AppShell>
    );
}

