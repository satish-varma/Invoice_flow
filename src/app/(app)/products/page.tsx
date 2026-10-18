
'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { getProducts, saveProduct, updateProduct, deleteProduct, Product } from "@/services/productService";
import { getColumns } from "./columns";
import { DataTable } from "./data-table";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader, PlusCircle, Sparkles, Package } from "lucide-react";
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { AppShell } from "@/components/app-shell";
import { triggerHaptic } from "@/lib/haptics";
import { useAuth } from "@/contexts/AuthContext";
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

export default function ProductsPage() {
    const { role, isReadOnly } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
    const [productToDelete, setProductToDelete] = useState<Product | null>(null);

    const { toast } = useToast();

    const loadProducts = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getProducts();
            setProducts(data);
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Failed to load products.',
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    const handleAddClick = () => {
        if (isReadOnly || role === 'guest') {
            toast({ variant: 'destructive', title: 'Read-Only Mode', description: 'Guest account cannot create products.' });
            return;
        }
        setEditingProduct({
            name: '',
            description: '',
            hsnCode: '',
            unitPrice: 0,
            unit: 'Nos',
            taxCategory: 'GST 18%'
        });
        setIsAddEditDialogOpen(true);
    };

    const handleEditClick = (product: Product) => {
        if (isReadOnly || role === 'guest') {
            toast({ variant: 'destructive', title: 'Read-Only Mode', description: 'Guest account cannot edit products.' });
            return;
        }
        setEditingProduct({ ...product });
        setIsAddEditDialogOpen(true);
    };

    const handleDeleteClick = (product: Product) => {
        if (isReadOnly || role === 'guest') {
            toast({ variant: 'destructive', title: 'Read-Only Mode', description: 'Guest account cannot delete products.' });
            return;
        }
        setProductToDelete(product);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (isReadOnly || role === 'guest') {
            toast({ variant: 'destructive', title: 'Read-Only Mode', description: 'Guest account cannot delete products.' });
            return;
        }
        if (!productToDelete?.id) return;
        try {
            await deleteProduct(productToDelete.id);
            toast({ title: "Product Deleted" });
            loadProducts();
        } catch (error) {
            toast({ variant: "destructive", title: "Error deleting product" });
        } finally {
            setIsDeleteDialogOpen(false);
            setProductToDelete(null);
        }
    };

    const handleSaveProduct = async () => {
        if (isReadOnly || role === 'guest') {
            toast({ variant: 'destructive', title: 'Read-Only Mode', description: 'Guest account cannot save products.' });
            return;
        }
        if (!editingProduct?.name) {
            toast({ variant: "destructive", title: "Product name is required" });
            return;
        }

        setIsSaving(true);
        try {
            const productData = {
                name: editingProduct.name!,
                description: editingProduct.description || '',
                hsnCode: editingProduct.hsnCode || '',
                unitPrice: Number(editingProduct.unitPrice) || 0,
                unit: editingProduct.unit || 'Nos',
                taxCategory: editingProduct.taxCategory || 'GST 18%'
            };

            if (editingProduct.id) {
                await updateProduct(editingProduct.id, productData);
                toast({ title: "Product updated" });
            } else {
                await saveProduct(productData);
                toast({ title: "Product saved" });
            }
            setIsAddEditDialogOpen(false);
            loadProducts();
        } catch (error) {
            toast({ variant: "destructive", title: "Error saving product" });
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
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] sm:text-xs font-black tracking-widest uppercase shadow-xs">
                                <Sparkles className="h-3 w-3 animate-pulse" />
                                PRODUCTS & SERVICES
                            </div>
                        </div>

                        <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                            Products Library
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium">
                            Manage inventory, pricing, and HSN codes for instant billing
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
                            <span>Add Product</span>
                        </button>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] p-3 sm:p-6">
                    <DataTable
                        columns={columns}
                        data={products}
                        searchPlaceholder="Search products or services..."
                        noResultsMessage="No products or services found in your library."
                        exportFileName="products-export.csv"
                    />
                </div>
            </div>

            {/* Add/Edit Bottom Sheet Dialog */}
            <Dialog open={isAddEditDialogOpen} onOpenChange={setIsAddEditDialogOpen}>
                <DialogContent className="w-full sm:max-w-[600px] rounded-t-3xl sm:rounded-3xl bottom-0 top-auto sm:top-[50%] sm:bottom-auto translate-y-0 sm:translate-y-[-50%] p-0 border-0 overflow-hidden bg-white dark:bg-slate-900 shadow-2xl flex flex-col max-h-[90vh]">
                    {/* Native Drag Handle */}
                    <div className="sm:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

                    <div className="px-5 sm:px-6 pt-3 sm:pt-6 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <Package className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                                {editingProduct?.id ? 'Edit Product' : 'Add New Product'}
                            </DialogTitle>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {editingProduct?.id ? 'Update item details and tax slabs' : 'Enter details to catalog this product'}
                            </p>
                        </div>
                    </div>

                    <div className="px-5 sm:px-6 py-4 space-y-4 overflow-y-auto">
                        <div className="space-y-1.5">
                            <Label htmlFor="name" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                Item Name <span className="text-rose-500">*</span>
                            </Label>
                            <Input
                                id="name"
                                value={editingProduct?.name || ''}
                                onChange={e => setEditingProduct(prev => ({ ...prev!, name: e.target.value }))}
                                placeholder="e.g. Software Development / Cold Coffee"
                                className="h-11 rounded-2xl text-sm"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="description" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                Description (Optional)
                            </Label>
                            <Textarea
                                id="description"
                                value={editingProduct?.description || ''}
                                onChange={e => setEditingProduct(prev => ({ ...prev!, description: e.target.value }))}
                                placeholder="Brief details about the product or service"
                                rows={2}
                                className="rounded-2xl text-sm resize-none"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="hsnCode" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    HSN / SAC Code
                                </Label>
                                <Input
                                    id="hsnCode"
                                    value={editingProduct?.hsnCode || ''}
                                    onChange={e => setEditingProduct(prev => ({ ...prev!, hsnCode: e.target.value }))}
                                    placeholder="e.g. 9983"
                                    className="h-11 rounded-2xl text-sm font-mono"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="taxCategory" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Tax Category
                                </Label>
                                <Select
                                    value={editingProduct?.taxCategory}
                                    onValueChange={val => setEditingProduct(prev => ({ ...prev!, taxCategory: val }))}
                                >
                                    <SelectTrigger className="h-11 rounded-2xl text-sm">
                                        <SelectValue placeholder="Select tax" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl">
                                        <SelectItem value="GST 18%">GST 18%</SelectItem>
                                        <SelectItem value="GST 12%">GST 12%</SelectItem>
                                        <SelectItem value="GST 5%">GST 5%</SelectItem>
                                        <SelectItem value="GST 28%">GST 28%</SelectItem>
                                        <SelectItem value="Exempt">Exempt / Nil Rated</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="unitPrice" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Base Price (₹)
                                </Label>
                                <Input
                                    id="unitPrice"
                                    type="number"
                                    value={editingProduct?.unitPrice ?? 0}
                                    onChange={e => setEditingProduct(prev => ({ ...prev!, unitPrice: Number(e.target.value) }))}
                                    className="h-11 rounded-2xl text-sm font-mono font-bold"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="unit" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    Unit
                                </Label>
                                <Select
                                    value={editingProduct?.unit || 'Nos'}
                                    onValueChange={val => setEditingProduct(prev => ({ ...prev!, unit: val }))}
                                >
                                    <SelectTrigger className="h-11 rounded-2xl text-sm">
                                        <SelectValue placeholder="Unit" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl">
                                        <SelectItem value="Nos">Numbers (Nos)</SelectItem>
                                        <SelectItem value="Sq Ft">Sq Ft</SelectItem>
                                        <SelectItem value="Hour">Hour</SelectItem>
                                        <SelectItem value="Day">Day</SelectItem>
                                        <SelectItem value="Service">Service</SelectItem>
                                        <SelectItem value="Kg">Kg</SelectItem>
                                        <SelectItem value="Lot">Lot</SelectItem>
                                    </SelectContent>
                                </Select>
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
                                handleSaveProduct();
                            }}
                            disabled={isSaving}
                            className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-2xl bg-gradient-to-r from-[#181156] to-[#241775] text-white font-bold text-xs shadow-md active:scale-95 disabled:opacity-50 transition-all"
                        >
                            {isSaving && <Loader className="h-4 w-4 animate-spin" />}
                            <span>Save Product</span>
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Alert */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-black text-slate-900 dark:text-white">
                            Delete Product?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-slate-600 dark:text-slate-400">
                            This will permanently remove <strong className="text-slate-900 dark:text-white">{productToDelete?.name}</strong> from your library.
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
