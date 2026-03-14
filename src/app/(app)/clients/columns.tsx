
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Client } from "@/services/clientService"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2, User } from "lucide-react"

export const getColumns = (
    onEdit: (client: Client) => void,
    onDelete: (client: Client) => void
): ColumnDef<Client>[] => [
        {
            accessorKey: "name",
            header: "Name",
            cell: ({ row }) => {
                const client = row.original;
                return (
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <User className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="font-bold">{client.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{client.type}</p>
                        </div>
                    </div>
                )
            }
        },
        {
            accessorKey: "gst",
            header: "GSTIN",
        },
        {
            accessorKey: "address",
            header: "Address",
            cell: ({ row }) => <div className="max-w-[300px] truncate" title={row.getValue("address")}>{row.getValue("address")}</div>
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const client = row.original

                return (
                    <div className="text-right flex justify-end gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEdit(client)}
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDelete(client)}
                        >
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                )
            },
        },
    ]
