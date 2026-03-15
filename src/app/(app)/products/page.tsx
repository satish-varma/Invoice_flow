
'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { getProducts, saveProduct, updateProduct, deleteProduct, Product } from "@/services/productService";
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

export default function ProductsPage() {
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
        setEditingProduct({ ...product });
        setIsAddEditDialogOpen(true);
    };

    const handleDeleteClick = (product: Product) => {
        setProductToDelete(product);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
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
                            Products & Services
                        </h1>
                        <p className="text-muted-foreground text-sm sm:text-base">
                            Manage your library of goods and services for faster billing.
                        </p>
                    </div>
                    <Button onClick={handleAddClick}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Product/Service
                    </Button>
                </div>

                <div className="bg-card rounded-lg border shadow-sm p-4">
                    <DataTable
                        columns={columns}
                        data={products}
                        searchPlaceholder="Search products or services..."
                        noResultsMessage="No products or services found in your library."
                        exportFileName="products-export.csv"
                    />
                </div>
            </div>

            {/* Add/Edit Dialog */}
            <Dialog open={isAddEditDialogOpen} onOpenChange={setIsAddEditDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>{editingProduct?.id ? 'Edit Product/Service' : 'Add New Product/Service'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Item Name</Label>
                                <Input
                                    id="name"
                                    value={editingProduct?.name}
                                    onChange={e => setEditingProduct(prev => ({ ...prev!, name: e.target.value }))}
                                    placeholder="e.g. Software Development"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description (Optional)</Label>
                                <Textarea
                                    id="description"
                                    value={editingProduct?.description}
                                    onChange={e => setEditingProduct(prev => ({ ...prev!, description: e.target.value }))}
                                    placeholder="Brief details about the product or service"
                                    rows={2}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="hsnCode">HSN / SAC Code</Label>
                                <Input
                                    id="hsnCode"
                                    value={editingProduct?.hsnCode}
                                    onChange={e => setEditingProduct(prev => ({ ...prev!, hsnCode: e.target.value }))}
                                    placeholder="e.g. 9983"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="taxCategory">Tax Category</Label>
                                <Select
                                    value={editingProduct?.taxCategory}
                                    onValueChange={val => setEditingProduct(prev => ({ ...prev!, taxCategory: val }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select tax" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="GST 18%">GST 18%</SelectItem>
                                        <SelectItem value="GST 12%">GST 12%</SelectItem>
                                        <SelectItem value="GST 5%">GST 5%</SelectItem>
                                        <SelectItem value="GST 28%">GST 28%</SelectItem>
                                        <SelectItem value="Exempt">Exempt / Nil Rated</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="unitPrice">Base Unit Price (₹)</Label>
                                <Input
                                    id="unitPrice"
                                    type="number"
                                    value={editingProduct?.unitPrice}
                                    onChange={e => setEditingProduct(prev => ({ ...prev!, unitPrice: Number(e.target.value) }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="unit">Unit</Label>
                                <Select
                                    value={editingProduct?.unit}
                                    onValueChange={val => setEditingProduct(prev => ({ ...prev!, unit: val }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Unit" />
                                    </SelectTrigger>
                                    <SelectContent>
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
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleSaveProduct} disabled={isSaving}>
                            {isSaving && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                            Save Product/Service
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
                            This will remove <strong>{productToDelete?.name}</strong> from your library.
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
