
'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { getClients, saveClient, updateClient, deleteClient, Client } from "@/services/clientService";
import { getColumns } from "./columns";
import { DataTable } from "./data-table";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader, PlusCircle } from "lucide-react";
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
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
        <main className="min-h-screen bg-background flex flex-col items-center p-4 sm:p-8">
            <div className="w-full max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between mb-8 gap-4">
                    <div>
                        <Button variant="outline" asChild>
                            <Link href="/">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Create
                            </Link>
                        </Button>
                        <h1 className="text-3xl sm:text-4xl font-headline font-bold text-primary mt-4">
                            Client Database
                        </h1>
                        <p className="text-muted-foreground text-sm sm:text-base">
                            Manage your clients for quick invoice generation.
                        </p>
                    </div>
                    <Button onClick={handleAddClick}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Client
                    </Button>
                </div>

                <div className="bg-card rounded-lg border shadow-sm p-4">
                    <DataTable
                        columns={columns}
                        data={clients}
                        searchPlaceholder="Search clients..."
                        noResultsMessage="No clients found in your registry."
                        exportFileName="clients-export.csv"
                    />
                </div>
            </div>

            {/* Add/Edit Dialog */}
            <Dialog open={isAddEditDialogOpen} onOpenChange={setIsAddEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingClient?.id ? 'Edit Client' : 'Add New Client'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2 col-span-2">
                                <Label htmlFor="name">Client/Company Name</Label>
                                <Input
                                    id="name"
                                    value={editingClient?.name}
                                    onChange={e => setEditingClient(prev => ({ ...prev!, name: e.target.value }))}
                                    placeholder="e.g. Acme Corp"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="type">Type</Label>
                                <Select
                                    value={editingClient?.type}
                                    onValueChange={val => setEditingClient(prev => ({ ...prev!, type: val as any }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="business">Business</SelectItem>
                                        <SelectItem value="individual">Individual</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="gst">GSTIN (Optional)</Label>
                                <Input
                                    id="gst"
                                    value={editingClient?.gst}
                                    onChange={e => setEditingClient(prev => ({ ...prev!, gst: e.target.value }))}
                                    placeholder="GST Number"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="address">Address</Label>
                            <Textarea
                                id="address"
                                value={editingClient?.address}
                                onChange={e => setEditingClient(prev => ({ ...prev!, address: e.target.value }))}
                                placeholder="Full billing address"
                                rows={3}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email (Optional)</Label>
                                <Input
                                    id="email"
                                    value={editingClient?.email}
                                    onChange={e => setEditingClient(prev => ({ ...prev!, email: e.target.value }))}
                                    placeholder="client@example.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone (Optional)</Label>
                                <Input
                                    id="phone"
                                    value={editingClient?.phone}
                                    onChange={e => setEditingClient(prev => ({ ...prev!, phone: e.target.value }))}
                                    placeholder="+91..."
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleSaveClient} disabled={isSaving}>
                            {isSaving && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                            Save Client
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Alert */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove <strong>{clientToDelete?.name}</strong> from your database.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </main>
    );
}

