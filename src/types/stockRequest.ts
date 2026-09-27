import { z } from 'zod';
import { NewRelicLocation } from './challan';

export const stockRequestItemSchema = z.object({
  id: z.string().optional(),
  brandName: z.string().min(1, 'Brand is required'),
  itemName: z.string().min(1, 'Item is required'),
  orderType: z.enum(['cases', 'units']),
  caseSize: z.coerce.number().min(1).default(1),
  quantity: z.coerce.number().min(1, 'Quantity must be ≥ 1'),
  totalUnits: z.coerce.number().min(1),
  mrp: z.coerce.number().optional(),
  pCost: z.coerce.number().optional(),
  fulfilledQuantity: z.coerce.number().optional(),
  fulfilledTotalUnits: z.coerce.number().optional(),
});

export const stockRequestSchema = z.object({
  id: z.string().optional(),
  location: z.enum(['hyderabad', 'bangalore']),
  requestDate: z.date(),
  status: z.enum(['PENDING', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELLED']),
  lineItems: z.array(stockRequestItemSchema).min(1, 'Add at least one item'),
  notes: z.string().optional(),
});

export type StockRequestFormValues = z.infer<typeof stockRequestSchema>;
export type StockRequestItemValues = z.infer<typeof stockRequestItemSchema>;

export interface StockRequestItem {
  id?: string;
  brandName: string;
  itemName: string;
  orderType: 'cases' | 'units';
  caseSize: number;
  quantity: number;
  totalUnits: number;
  mrp?: number;
  pCost?: number;
  fulfilledQuantity?: number;
  fulfilledTotalUnits?: number;
}

export interface StockRequest {
  id?: string;
  location: NewRelicLocation;
  requestDate: string; // ISO string
  status: 'PENDING' | 'PARTIALLY_FULFILLED' | 'FULFILLED' | 'CANCELLED';
  lineItems: StockRequestItem[];
  notes?: string;
  createdBy?: string | null;
  createdAt?: any;
  updatedAt?: any;
  updatedBy?: string | null;
}
