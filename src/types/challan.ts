import { z } from 'zod';

export type NewRelicLocation = 'hyderabad' | 'bangalore';

export const lineItemSchema = z.object({
  id: z.any(),  // useFieldArray injects its own string id — accept any type
  brandName: z.string().optional().default(''),
  itemName: z.string().optional().default(''),
  quantity: z.coerce.number().min(1, 'Quantity must be ≥ 1'),
  expiry: z.string().optional().default(''),
  mrp: z.coerce.number().optional(),
  procurementCost: z.coerce.number().optional(),
}).passthrough();  // allow extra fields from Firestore data (orderType, caseSize, etc.)

export const challanSchema = z.object({
  dcNumber: z.string().min(1, 'DC Number is required'),
  location: z.enum(['hyderabad', 'bangalore']),
  dcDate: z.date(),
  lineItems: z.array(lineItemSchema),
  note: z.string().optional(),
  transportCost: z.coerce.number().optional(),
  otherCharges: z.coerce.number().optional(),
  procurementCost: z.coerce.number().optional(),
});

export type ChallanFormValues = z.infer<typeof challanSchema>;

export interface NewRelicChallanItem {
  id: number;
  brandName: string;
  itemName: string;
  quantity: number;
  expiry?: string;
  mrp?: number;
  procurementCost?: number;
}

export interface NewRelicChallan {
  id?: string;
  dcNumber: string;
  dcDate: string;
  location: NewRelicLocation;
  lineItems: NewRelicChallanItem[];
  note?: string;
  transportCost?: number;
  otherCharges?: number;
  procurementCost?: number;
  createdAt?: any;
  createdBy?: string | null;
  updatedAt?: any;
  updatedBy?: string | null;
  deletedBy?: string | null;
  isDeleted?: boolean;
  deletedAt?: any;
  signedCopyUrls?: string[];
  goodsReceivedInvoiceUrls?: string[];
}

export interface NewRelicChallanHistory {
  id: string;
  editedAt: any;
  action?: 'CREATED' | 'UPDATED' | 'DELETED' | 'RESTORED';
  editedBy?: string | null;
  previousData: NewRelicChallan;
}

export interface CatalogItem {
  id?: string;
  brandName: string;
  itemName: string;
  defaultQuantity: number;
  caseSize?: number;
  mrp?: number;
}

export interface PricingItem {
  id?: string;
  brandName: string;
  itemName: string;
  location: NewRelicLocation;
  mrp: number;
  discountPercent: number;
  purchaseCost: number;
  updatedAt?: any;
}
