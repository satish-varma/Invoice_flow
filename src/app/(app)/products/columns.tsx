
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Product } from "@/services/productService"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2, Box } from "lucide-react"

export const getColumns = (
    onEdit: (product: Product) => void,
    onDelete: (product: Product) => void
): ColumnDef<Product>[] => [
        {
            accessorKey: "name",
            header: "Product/Service",
            cell: ({ row }) => {
                const product = row.original;
                return (
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <Box className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="font-bold">{product.name}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">{product.description}</p>
                        </div>
                    </div>
                )
            }
        },
        {
            accessorKey: "hsnCode",
            header: "HSN Code",
        },
        {
            accessorKey: "unitPrice",
            header: "Unit Price",
            cell: ({ row }) => {
                const price = parseFloat(row.getValue("unitPrice"))
                const unit = row.original.unit
                return (
                    <div className="font-medium">
                        ₹ {price.toFixed(2)} / {unit}
                    </div>
                )
            }
        },
        {
            accessorKey: "taxCategory",
            header: "Tax Category",
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const product = row.original

                return (
                    <div className="text-right flex justify-end gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(product)}
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDelete(product)}
                        >
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                )
            },
        },
    ]
