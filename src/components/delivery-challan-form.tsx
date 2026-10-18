"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar as CalendarIcon, PlusCircle, Trash2, Loader, Save, FilePlus, ListOrdered, Settings as SettingsIcon, Truck, FileText, Sheet, Calculator, DollarSign, TrendingUp, Percent, Sparkles, Eye, EyeOff, X, FileCheck, Receipt, Paperclip, Download, MapPin, Plus, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast"
import { Textarea } from './ui/textarea';
import { Challan, saveChallan, ChallanLineItem } from '@/services/challanService';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getSettings, Settings, CompanyProfile, BillToContact, ShipToContact } from '@/services/settingsService';
import { getClients, saveClient, Client } from '@/services/clientService';
import { Checkbox } from './ui/checkbox';
import { getProducts, Product } from '@/services/productService';
import * as XLSX from 'xlsx';
import { triggerHaptic } from '@/lib/haptics';
import { useAuth } from '@/contexts/AuthContext';
import { ChallanCalculator } from '@/components/challan-calculator';
import { DeliveryChallanAttachmentModal } from './delivery-challan-attachment-modal';

const defaultGutGuruProfile: CompanyProfile = {
    id: 'default-gut-guru',
    profileName: 'The Gut Guru',
    companyName: 'THE GUT GURU',
    companyAddress: 'H NO.6-46/3/A, VENKATESWARA NAGAR, Chanda Nagar, Hyderabad, Telangana, 500050',
    companyGstin: '36DDTPJ6536D1Z8',
    companyPan: 'DDTPJ6536D',
    companyPhone: '+91 7700832898',
    companyEmail: 'thegutguru.in@gmail.com',
    invoicePrefix: 'TGG',
    bankBeneficiary: 'THE GUT GURU',
    bankName: 'HDFC BANK',
    bankAccount: '',
    bankIfsc: '',
    bankBranch: 'CHANDA NAGAR',
    stampLogoUrl: '/sigwithsign_small.png',
    logoUrl: '/logo.svg',
};

const defaultHungerBoxBillTo = {
    name: 'EatGood Technologies Pvt. Ltd. (HungerBox)',
    address: 'Outer Ring Road, Kadubeesanahalli, Bengaluru, Karnataka 560103',
};

interface DeliveryChallanFormProps {
    initialData?: Challan | null;
    onChallanSave: (savedChallan?: Challan) => void;
    onAddNew: () => void;
}

export function DeliveryChallanForm({ initialData, onChallanSave, onAddNew }: DeliveryChallanFormProps) {
    const [dcNumber, setDcNumber] = useState('');
    const [dcDate, setDcDate] = useState<Date | undefined>(undefined);

    const [billToName, setBillToName] = useState(defaultHungerBoxBillTo.name);
    const [billToAddress, setBillToAddress] = useState(defaultHungerBoxBillTo.address);

    const [shipToName, setShipToName] = useState('');
    const [shipToAddress, setShipToAddress] = useState('');

    const [lineItems, setLineItems] = useState<ChallanLineItem[]>([
        { id: 1, name: '', hsnCode: '', unit: '', quantity: 0, unitPrice: 0, total: 0, procurementCost: 0 },
    ]);
    const [showExtraColumns, setShowExtraColumns] = useState(false);
    const [note, setNote] = useState('The above goods sent on non returnable basis');
    const [clients, setClients] = useState<Client[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [saveAsClient, setSaveAsClient] = useState(false);

    // Client-facing taxes & charges (Hidden by default for standard delivery challans)
    const [showClientCharges, setShowClientCharges] = useState(false);
    const [gstRate, setGstRate] = useState(0);
    const [shipping, setShipping] = useState(0);
    const [other, setOther] = useState(0);

    // Internal Expenses (Private - not sent to client, for profit calculation)
    const [transportationExpense, setTransportationExpense] = useState<number>(0);
    const [otherExpense, setOtherExpense] = useState<number>(0);

    // Modern Financials (like NewRelic)
    const [commissionRate, setCommissionRate] = useState<number>(5.5);
    const [showFinancials, setShowFinancials] = useState<boolean>(true);

    // Attachments
    const [signedCopyUrls, setSignedCopyUrls] = useState<string[]>(initialData?.signedCopyUrls || []);
    const [goodsReceivedInvoiceUrls, setGoodsReceivedInvoiceUrls] = useState<string[]>(initialData?.goodsReceivedInvoiceUrls || []);
    const [activeAttachmentModal, setActiveAttachmentModal] = useState<'signed_copy' | 'invoice' | null>(null);
    const [isDockMinimized, setIsDockMinimized] = useState(false);

    const [isImportingExcel, setIsImportingExcel] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const excelInputRef = useRef<HTMLInputElement>(null);
    const pathname = usePathname();
    const router = useRouter();

    const [settings, setSettings] = useState<Settings>({ companyProfiles: [], billToContacts: [], shipToContacts: [] });
    const [activeCompanyProfile, setActiveCompanyProfile] = useState<CompanyProfile | null>(null);

    const { toast } = useToast();
    const { user, role, isReadOnly } = useAuth();
    const isAdmin = role === 'admin' || role === 'superadmin';
    const canSeeFinancials = isAdmin && showFinancials;

    const subtotal = useMemo(() => {
        return lineItems.reduce((acc, item) => acc + item.total, 0);
    }, [lineItems]);

    const totalProcurementCost = useMemo(() => {
        return lineItems.reduce((acc, item) => acc + ((Number(item.procurementCost) || 0) * (Number(item.quantity) || 0)), 0);
    }, [lineItems]);

    const commissionAmount = useMemo(() => {
        return (subtotal * (Number(commissionRate) || 0)) / 100;
    }, [subtotal, commissionRate]);

    const revenue = useMemo(() => {
        return subtotal - commissionAmount;
    }, [subtotal, commissionAmount]);

    const totalInternalExpenses = useMemo(() => {
        return totalProcurementCost + (Number(transportationExpense) || 0) + (Number(otherExpense) || 0);
    }, [totalProcurementCost, transportationExpense, otherExpense]);

    const grossProfit = useMemo(() => {
        return revenue - totalInternalExpenses;
    }, [revenue, totalInternalExpenses]);

    const marginPercent = useMemo(() => {
        return subtotal > 0 ? (grossProfit / subtotal) * 100 : 0;
    }, [grossProfit, subtotal]);

    const gstAmount = useMemo(() => {
        return (subtotal * (Number(gstRate) || 0)) / 100;
    }, [subtotal, gstRate]);

    const total = useMemo(() => {
        return subtotal + gstAmount + Number(shipping) + Number(other);
    }, [subtotal, gstAmount, shipping, other]);

    useEffect(() => {
        if (!initialData) {
            setDcDate(new Date());
        }
    }, [initialData]);

    useEffect(() => {
        async function loadSettingsAndApplyDefaults() {
            const loadedSettings = await getSettings();
            setSettings(loadedSettings);

            let profileToApply: CompanyProfile | undefined = loadedSettings.companyProfiles?.find(p =>
                (initialData?.companyProfileId && p.id === initialData.companyProfileId) ||
                p.companyName?.toLowerCase().includes('gut guru') ||
                p.invoicePrefix === 'TGG'
            );
            if (!profileToApply && loadedSettings.companyProfiles && loadedSettings.companyProfiles.length > 0) {
                profileToApply = loadedSettings.companyProfiles[0];
            }
            if (!profileToApply) {
                profileToApply = defaultGutGuruProfile;
            }
            setActiveCompanyProfile(profileToApply);

            const loadedClients = await getClients();
            setClients(loadedClients);

            const loadedProducts = await getProducts();
            setProducts(loadedProducts);

            const hungerBoxContact = loadedSettings.billToContacts?.find(c =>
                c.name?.toLowerCase().includes('hungerbox') || c.name?.toLowerCase().includes('eatgood')
            );
            const defaultBillName = hungerBoxContact?.name || defaultHungerBoxBillTo.name;
            const defaultBillAddr = hungerBoxContact?.address || defaultHungerBoxBillTo.address;

            if (!initialData) {
                setBillToName(defaultBillName);
                setBillToAddress(defaultBillAddr);
                if (loadedSettings.defaultShipToContact && loadedSettings.shipToContacts) {
                    const defaultContact = loadedSettings.shipToContacts.find(c => c.id === loadedSettings.defaultShipToContact);
                    if (defaultContact) {
                        setShipToName(defaultContact.name);
                        setShipToAddress(defaultContact.address);
                    }
                }
            } else {
                setBillToName(initialData.billToName || defaultBillName);
                setBillToAddress(initialData.billToAddress || defaultBillAddr);
            }
        }
        loadSettingsAndApplyDefaults();
    }, [initialData]);

    useEffect(() => {
        if (initialData) {
            setDcNumber(initialData.dcNumber);
            setDcDate(new Date(initialData.dcDate));
            setBillToName(initialData.billToName || defaultHungerBoxBillTo.name);
            setBillToAddress(initialData.billToAddress || defaultHungerBoxBillTo.address);
            setShipToName(initialData.shipToName || '');
            setShipToAddress(initialData.shipToAddress || '');
            const parsedItems = (initialData.lineItems || []).map((item, index) => ({
                id: item.id || Date.now() + index,
                name: item.name || '',
                hsnCode: item.hsnCode || '',
                unit: item.unit || '',
                quantity: item.quantity || 0,
                unitPrice: item.unitPrice || 0,
                procurementCost: item.procurementCost || 0,
                total: item.total || 0,
                mrp: item.mrp || item.unitPrice || 0,
                marginPercent: item.marginPercent || 0,
            }));
            setLineItems(parsedItems);
            setShowExtraColumns(parsedItems.some(i => i.hsnCode || i.unit));
            const calculatedGstRate = initialData.subtotal > 0 && initialData.gstAmount ? (initialData.gstAmount / initialData.subtotal) * 100 : 0;
            const initShipping = Number(initialData.shipping) || 0;
            const initOther = Number(initialData.other) || 0;
            setGstRate(calculatedGstRate);
            setShipping(initShipping);
            setOther(initOther);
            setShowClientCharges(calculatedGstRate > 0 || initShipping > 0 || initOther > 0);

            const initTransport = Number(initialData.transportationExpense ?? initialData.transportCost) || 0;
            const initOtherExp = Number(initialData.otherExpense) || 0;
            setTransportationExpense(initTransport);
            setOtherExpense(initOtherExp);

            if (initialData.commissionRate !== undefined && initialData.commissionRate !== null) {
                setCommissionRate(initialData.commissionRate);
            }
            setNote(initialData.note || 'The above goods sent on non returnable basis');
            setSignedCopyUrls(initialData.signedCopyUrls || []);
            setGoodsReceivedInvoiceUrls(initialData.goodsReceivedInvoiceUrls || []);
        } else {
            handleClearForm(false);
        }
    }, [initialData]);

    useEffect(() => {
        setLineItems(items => items.map(item => ({
            ...item,
            total: (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
        })));
    }, [lineItems.map(i => `${i.quantity}-${i.unitPrice}`).join(',')]);

    const handleAddItem = () => {
        triggerHaptic('light');
        setLineItems([...lineItems, { id: Date.now(), name: '', hsnCode: '', unit: '', quantity: 0, unitPrice: 0, procurementCost: 0, total: 0 }]);
    };

    const handleRemoveItem = (id: number) => {
        triggerHaptic('light');
        setLineItems(lineItems.filter(item => item.id !== id));
    };

    const handleItemChange = (id: number, field: keyof Omit<ChallanLineItem, 'id' | 'total'>, value: string | number) => {
        setLineItems(lineItems.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const handleProductSelect = (id: number, productId: string) => {
        const product = products.find(p => p.id === productId);
        if (product) {
            setLineItems(lineItems.map(item =>
                item.id === id ? {
                    ...item,
                    name: product.name,
                    unit: product.unit || '',
                    unitPrice: product.unitPrice,
                    hsnCode: product.hsnCode || ''
                } : item
            ));

            if (product.taxCategory) {
                const match = product.taxCategory.match(/\d+/);
                if (match) {
                    setGstRate(parseInt(match[0]));
                    setShowClientCharges(true);
                }
            }
        }
    };

    const handleClearForm = (shouldCallback = true) => {
        setDcNumber('');
        setDcDate(new Date());
        setBillToName(defaultHungerBoxBillTo.name);
        setBillToAddress(defaultHungerBoxBillTo.address);
        setShipToName('');
        setShipToAddress('');
        setLineItems([{ id: Date.now(), name: '', hsnCode: '', unit: '', quantity: 0, unitPrice: 0, procurementCost: 0, total: 0 }]);
        setShowExtraColumns(false);
        setGstRate(0);
        setShipping(0);
        setOther(0);
        setShowClientCharges(false);
        setTransportationExpense(0);
        setOtherExpense(0);
        setCommissionRate(5.5);
        setNote('The above goods sent on non returnable basis');
        setSignedCopyUrls([]);
        setGoodsReceivedInvoiceUrls([]);
        setActiveAttachmentModal(null);
        if (shouldCallback) {
            onAddNew();
        }
    };

    const handleCancelEdit = () => {
        triggerHaptic('light');
        handleClearForm(true);
        toast({
            title: 'Edit Cancelled',
            description: 'Cleared editor and returned to blank delivery challan.',
        });
    };

    const handleOpenAttachmentModal = (type: 'signed_copy' | 'invoice') => {
        triggerHaptic('light');
        if (!initialData?.id) {
            toast({
                title: "Save Challan First",
                description: "Please click 'Save Only' or 'Save & Download PDF' below to save first, then upload attachments.",
            });
            return;
        }
        setActiveAttachmentModal(type);
    };

    const handleAttachmentUpdate = (updatedUrls?: string[]) => {
        if (activeAttachmentModal === 'signed_copy') {
            const urls = updatedUrls || initialData?.signedCopyUrls || [];
            setSignedCopyUrls([...urls]);
            if (initialData) initialData.signedCopyUrls = [...urls];
        } else if (activeAttachmentModal === 'invoice') {
            const urls = updatedUrls || initialData?.goodsReceivedInvoiceUrls || [];
            setGoodsReceivedInvoiceUrls([...urls]);
            if (initialData) initialData.goodsReceivedInvoiceUrls = [...urls];
        }
        if (initialData) {
            onChallanSave(initialData);
        }
    };

    const handleSaveChallan = async (andDownload = false) => {
        if (isReadOnly || role === 'guest') {
            toast({
                variant: 'destructive',
                title: 'Guest Account (Read-Only)',
                description: 'Modifications are disabled for guest users. Delivery Challans cannot be saved or updated.',
            });
            return;
        }
        const finalBillToName = billToName || defaultHungerBoxBillTo.name;
        const finalBillToAddress = billToAddress || defaultHungerBoxBillTo.address;
        const profile = activeCompanyProfile || defaultGutGuruProfile;

        setIsSaving(true);
        try {
            const creatorDisplayName = (user as any)?.name || (user?.email ? user.email.split('@')[0] : 'Satya');
            const creatorEmail = user?.email || 'satya@tgg.in';

            const challanData: Omit<Challan, 'dcNumber' | 'createdAt'> & { id?: string } = {
                dcDate: dcDate?.toISOString() || new Date().toISOString(),
                companyProfileId: profile.id,
                billToName: finalBillToName,
                billToAddress: finalBillToAddress,
                shipToName: shipToName || finalBillToName,
                shipToAddress: shipToAddress || finalBillToAddress,
                lineItems: lineItems.map((item) => {
                    const uPrice = Number(item.unitPrice) || 0;
                    const pCost = Number(item.procurementCost) || 0;
                    const margin = uPrice > 0 ? ((uPrice - pCost) / uPrice) * 100 : 0;
                    return {
                        ...item,
                        quantity: Number(item.quantity) || 0,
                        unitPrice: uPrice,
                        procurementCost: pCost,
                        total: (Number(item.quantity) || 0) * uPrice,
                        mrp: Number(item.mrp) || uPrice,
                        marginPercent: margin,
                    };
                }),
                subtotal,
                gstAmount,
                shipping: Number(shipping) || 0,
                other: Number(other) || 0,
                total,
                note,
                procurementCost: totalProcurementCost,
                commissionRate: Number(commissionRate) || 5.5,
                commissionAmount,
                transportCost: Number(transportationExpense) || 0,
                transportationExpense: Number(transportationExpense) || 0,
                otherExpense: Number(otherExpense) || 0,
                revenue,
                grossProfit,
                marginPercent,
                createdBy: initialData?.createdBy || creatorDisplayName,
                creatorEmail: initialData?.creatorEmail || creatorEmail,
                creatorName: initialData?.creatorName || creatorDisplayName,
                updatedBy: creatorDisplayName,
                signedCopyUrls: signedCopyUrls.length > 0 ? signedCopyUrls : (initialData?.signedCopyUrls || []),
                goodsReceivedInvoiceUrls: goodsReceivedInvoiceUrls.length > 0 ? goodsReceivedInvoiceUrls : (initialData?.goodsReceivedInvoiceUrls || []),
            };

            if (initialData?.id) {
                challanData.id = initialData.id;
            }

            const savedChallan = await saveChallan(challanData);

            if (saveAsClient && finalBillToName) {
                const existingClient = clients.find(c => c.name.toLowerCase() === finalBillToName.toLowerCase());
                if (!existingClient) {
                    await saveClient({
                        name: finalBillToName,
                        address: finalBillToAddress,
                        type: 'business'
                    });
                    const updatedClients = await getClients();
                    setClients(updatedClients);
                }
            }
            toast({
                title: initialData ? "Challan Updated" : "Challan Saved",
                description: `Challan ${savedChallan.dcNumber} saved by ${creatorDisplayName}.`,
            });

            if (andDownload) {
                onChallanSave(savedChallan);
            } else {
                onChallanSave();
            }

        } catch (error) {
            console.error("Failed to save challan:", error);
            const errorMessage = error instanceof Error ? error.message : "Could not save the challan. Please try again.";
            toast({ variant: "destructive", title: "Save Failed", description: errorMessage });
        } finally {
            setIsSaving(false);
        }
    };

    const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsImportingExcel(true);
        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

            if (!rows || rows.length === 0) {
                toast({ variant: 'destructive', title: 'Empty Sheet', description: 'The Excel file has no data rows.' });
                return;
            }

            const normalise = (s: unknown) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

            const findKey = (row: Record<string, unknown>, ...aliases: string[]) => {
                const keys = Object.keys(row);
                for (const alias of aliases) {
                    const found = keys.find(k => normalise(k) === normalise(alias));
                    if (found !== undefined) return found;
                }
                return null;
            };

            const firstRow = rows[0];
            const keyItemName  = findKey(firstRow, 'itemname', 'item', 'name', 'description', 'product', 'itemdescription');
            const keyHsn       = findKey(firstRow, 'hsncode', 'hsn', 'sac', 'hsnno');
            const keyUnit      = findKey(firstRow, 'unit', 'uom', 'units');
            const keyQty       = findKey(firstRow, 'qty', 'quantity', 'nos', 'count');
            const keyUnitPrice = findKey(firstRow, 'unitprice', 'rate', 'price', 'unitrate', 'mrp');
            const keyPCost     = findKey(firstRow, 'procurementcost', 'pcost', 'purchasecost', 'cost', 'buyrate', 'buyingprice');

            if (!keyItemName || !keyQty || !keyUnitPrice) {
                toast({
                    variant: 'destructive',
                    title: 'Column Not Found',
                    description: 'Could not find required columns. Ensure your sheet has: Item Name, Qty, Unit Price.',
                });
                return;
            }

            const importedItems: ChallanLineItem[] = rows
                .filter(row => row[keyItemName!] !== '')
                .map((row, index) => {
                    const qty   = parseFloat(String(row[keyQty!])) || 0;
                    const price = parseFloat(String(row[keyUnitPrice!])) || 0;
                    const pCost = keyPCost ? (parseFloat(String(row[keyPCost])) || 0) : 0;
                    return {
                        id: Date.now() + index,
                        name:            String(row[keyItemName!] || ''),
                        hsnCode:         keyHsn  ? String(row[keyHsn]  || '') : '',
                        unit:            keyUnit ? String(row[keyUnit] || '') : '',
                        quantity:        qty,
                        unitPrice:       price,
                        procurementCost: pCost,
                        total:           qty * price,
                        marginPercent:   price > 0 ? ((price - pCost) / price) * 100 : 0,
                    };
                });

            if (importedItems.length === 0) {
                toast({ variant: 'destructive', title: 'No Items', description: 'No valid product rows were found in the sheet.' });
                return;
            }

            setLineItems(importedItems);
            toast({
                title: 'Excel Imported',
                description: `${importedItems.length} item(s) loaded with pricing and costs.`,
            });
        } catch (error) {
            console.error('Excel import error:', error);
            toast({
                variant: 'destructive',
                title: 'Import Failed',
                description: 'Could not read the Excel file. Please check format.',
            });
        } finally {
            setIsImportingExcel(false);
            if (excelInputRef.current) excelInputRef.current.value = '';
        }
    };

    const allSavedClients = useMemo(() => {
        const billTo = (settings.billToContacts || []).map(c => ({ ...c, type: 'billTo' as const }));
        const shipTo = (settings.shipToContacts || []).map(c => ({ ...c, type: 'shipTo' as const }));
        const dbClients = clients.map(c => ({ id: c.id!, displayName: c.name, name: c.name, address: c.address, type: 'client' as const }));
        return [...billTo, ...shipTo, ...dbClients];
    }, [settings.billToContacts, settings.shipToContacts, clients]);

    const handleContactSelect = (value: string, section: 'billTo' | 'shipTo') => {
        const [id, type] = value.split('|');
        const contact = allSavedClients.find(c => c.id === id && c.type === type);

        if (contact) {
            if (section === 'billTo') {
                setBillToName(contact.name);
                setBillToAddress(contact.address);
            } else {
                setShipToName(contact.name);
                setShipToAddress(contact.address);
            }
        }
    };

    const handleCompanyProfileSelect = (id: string) => {
        const profile = settings.companyProfiles?.find(p => p.id === id);
        if (profile) {
            setActiveCompanyProfile(profile);
        }
    };

    const handleNewClick = () => {
        if (pathname !== '/delivery-challan') {
            router.push('/delivery-challan');
        }
        onAddNew();
    };

    return (
        <>
            <input
                type="file"
                ref={excelInputRef}
                onChange={handleExcelImport}
                className="hidden"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                disabled={isImportingExcel}
            />

            <Card className="w-full rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden bg-white mb-6">
                <CardHeader className="bg-gray-50/70 p-4 sm:p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <CardTitle className="text-lg sm:text-2xl font-black text-gray-900 tracking-tight">
                            {initialData ? 'Edit Delivery Challan' : 'Create Delivery Challan'}
                        </CardTitle>
                        {initialData?.dcNumber && (
                            <span className="font-mono text-xs sm:text-sm px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/70">
                                {initialData.dcNumber}
                            </span>
                        )}

                        {/* Financials & MRP Calculator for Admins */}
                        {isAdmin && (
                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic('light');
                                    setShowFinancials(!showFinancials);
                                }}
                                className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all border ${
                                    showFinancials
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs'
                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                }`}
                                title="Toggle Procurement Cost & Margin breakdown"
                            >
                                {showFinancials ? <Eye className="w-3.5 h-3.5 text-emerald-600" /> : <EyeOff className="w-3.5 h-3.5 text-gray-400" />}
                                <span>Financials: {showFinancials ? 'ON' : 'OFF'}</span>
                            </button>
                        )}

                        {isAdmin && (
                            <ChallanCalculator
                                triggerButton={
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-2.5 rounded-xl border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-bold flex items-center gap-1.5"
                                    >
                                        <Calculator className="w-3.5 h-3.5" />
                                        <span>MRP Calc</span>
                                    </Button>
                                }
                            />
                        )}

                        <Button
                            variant="outline"
                            size="sm"
                            className="hidden sm:inline-flex h-8 text-xs font-semibold rounded-xl border-gray-200 text-gray-700 hover:bg-gray-100"
                            onClick={() => excelInputRef.current?.click()}
                            disabled={isImportingExcel}
                        >
                            {isImportingExcel ? (
                                <><Loader className="animate-spin w-3.5 h-3.5 mr-1" /> Importing...</>
                            ) : (
                                <><Sheet className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Import Excel</>
                            )}
                        </Button>
                    </div>

                    {/* DC Number & DC Date in Card in SAME LINE with Create Delivery Challan */}
                    <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-2xs">
                            <span className="text-xs font-bold text-gray-600 uppercase tracking-wider shrink-0">DC No:</span>
                            <Input
                                value={dcNumber}
                                onChange={(e) => setDcNumber(e.target.value)}
                                placeholder="Auto on save"
                                disabled={!initialData}
                                className="h-8 w-28 sm:w-36 text-sm font-mono font-bold text-indigo-700 border-0 p-0 focus-visible:ring-0 bg-transparent"
                            />
                        </div>

                        <div className="relative flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 shadow-2xs cursor-pointer">
                            <CalendarIcon className="h-4 w-4 text-indigo-600 shrink-0" />
                            <span className="text-xs font-bold text-gray-600 uppercase tracking-wider shrink-0">Date:</span>
                            <span className="text-sm font-bold text-gray-800">{dcDate ? format(dcDate, "dd MMM yyyy") : 'Select date'}</span>
                            <Input
                                type="date"
                                className="absolute opacity-0 inset-0 w-full h-full cursor-pointer"
                                value={dcDate ? format(dcDate, 'yyyy-MM-dd') : ''}
                                onChange={(e) => {
                                    if (e.target.value) {
                                        setDcDate(new Date(e.target.value + 'T00:00:00'));
                                    }
                                }}
                            />
                        </div>
                    </div>
                </CardHeader>

                {(isReadOnly || role === 'guest') && (
                    <div className="mx-4 sm:mx-6 mt-4 flex items-center gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 text-xs sm:text-sm font-medium">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                        <div>
                            <span className="font-bold">Guest Mode (Read-Only):</span> You can view and inspect this Delivery Challan, but saving or updating records is disabled.
                        </div>
                    </div>
                )}

                <CardContent className="p-4 sm:p-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 items-start">
                        <div className="space-y-1.5">
                            <Label className="text-xs sm:text-sm font-bold text-gray-700">Select Saved Consignee</Label>
                            <Select onValueChange={(value) => handleContactSelect(value, 'shipTo')}>
                                <SelectTrigger className="h-11 rounded-xl text-sm bg-white border-gray-300 shadow-2xs">
                                    <SelectValue placeholder="Quick fill consignee..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {allSavedClients.map((c) =>
                                        <SelectItem key={`${c.id}-${c.type}-ship`} value={`${c.id}|${c.type}`} className="text-sm py-2">
                                            {c.displayName} ({c.type === 'client' ? 'Client' : c.type === 'billTo' ? 'Bill' : 'Ship'})
                                        </SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                            {shipToName && (
                                <div className="p-2.5 bg-indigo-50/80 border border-indigo-200/80 rounded-xl text-xs sm:text-sm flex items-center gap-2 text-indigo-900 font-semibold shadow-2xs">
                                    <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
                                    <span className="font-bold truncate">{shipToName}</span>
                                </div>
                            )}
                        </div>

                        <div className="md:col-span-2 space-y-1.5">
                            <Label htmlFor="shipToAddress" className="text-xs sm:text-sm font-bold text-gray-700">Delivery / Site Address *</Label>
                            <Textarea
                                id="shipToAddress"
                                placeholder="Detailed Delivery / Site Address (Street, Plot, Mandal, PIN, State)"
                                value={shipToAddress}
                                onChange={e => setShipToAddress(e.target.value)}
                                className="rounded-xl text-sm min-h-[84px] bg-white border-gray-300 shadow-2xs resize-none p-3"
                                rows={2}
                            />
                        </div>
                    </div>
                </CardContent>

                {/* ── Line Items Section with P.Cost & Margin ── */}
                <CardContent className="p-4 sm:p-6 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
                        <div>
                            <h3 className="font-bold text-sm sm:text-base text-gray-900 tracking-tight flex items-center gap-2">
                                <span>Dispatched Line Items ({lineItems.length})</span>
                                {canSeeFinancials && totalProcurementCost > 0 && (
                                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Total P.Cost: ₹{totalProcurementCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </span>
                                )}
                            </h3>
                            <p className="text-xs sm:text-sm text-gray-500">Quantities, unit rates, purchase costs &amp; margin calculations</p>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    triggerHaptic('light');
                                    setShowExtraColumns(!showExtraColumns);
                                }}
                                className="h-9 px-3 rounded-xl border-gray-200 text-gray-700 hover:bg-gray-50 text-xs font-semibold"
                            >
                                {showExtraColumns ? '− Hide HSN & Unit' : '+ Add HSN / Unit'}
                            </Button>

                            <Button
                                onClick={handleAddItem}
                                variant="outline"
                                size="sm"
                                className="h-9 px-3 rounded-xl border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-bold active:scale-95 shadow-2xs"
                            >
                                <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Add Item
                            </Button>
                        </div>
                    </div>

                    {/* Mobile Line Items View */}
                    <div className="md:hidden space-y-4">
                        {lineItems.map((item, index) => {
                            const uPrice = Number(item.unitPrice) || 0;
                            const pCost = Number(item.procurementCost) || 0;
                            const profit = uPrice - pCost;
                            const margin = uPrice > 0 ? (profit / uPrice) * 100 : 0;

                            return (
                                <div key={item.id} className="border border-gray-200 rounded-2xl p-4 bg-white space-y-3.5 shadow-sm overflow-hidden">
                                    <div className="flex justify-between items-center pb-2.5 border-b border-gray-100">
                                        <span className="text-xs font-black text-indigo-700 uppercase tracking-wider bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg">
                                            Item #{index + 1}
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <ChallanCalculator
                                                currentUnitPrice={uPrice}
                                                currentPCost={pCost}
                                                onApplyPrice={(newPrice, newCost) => {
                                                    handleItemChange(item.id, 'unitPrice', newPrice);
                                                    if (newCost !== undefined) handleItemChange(item.id, 'procurementCost', newCost);
                                                }}
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleRemoveItem(item.id)}
                                                className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl"
                                                title="Delete item"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {showExtraColumns && (
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-bold text-gray-700">Select Catalog Product</Label>
                                            <Select onValueChange={(val) => handleProductSelect(item.id, val)}>
                                                <SelectTrigger className="h-11 rounded-xl text-sm bg-white border-gray-300 shadow-2xs">
                                                    <SelectValue placeholder="Quick fill product..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {products.map(p => (
                                                        <SelectItem key={p.id} value={p.id!} className="text-sm py-2">{p.name}</SelectItem>
                                                    ))}
                                                    <SelectItem value="none" className='text-gray-400 italic font-normal text-sm py-2'>Manual entry...</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-bold text-gray-700">Item Description *</Label>
                                        <Input
                                            className="h-11 text-sm rounded-xl bg-white border-gray-300 shadow-2xs focus:border-indigo-500"
                                            placeholder="Item name / brand / pack size"
                                            value={item.name || ''}
                                            onChange={e => handleItemChange(item.id, 'name', e.target.value)}
                                        />
                                    </div>

                                    {showExtraColumns && (
                                        <div className="grid grid-cols-2 gap-2.5">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-bold text-gray-700">HSN Code</Label>
                                                <Input
                                                    className="h-11 text-sm rounded-xl bg-white border-gray-300 shadow-2xs"
                                                    placeholder="HSN"
                                                    value={item.hsnCode || ''}
                                                    onChange={e => handleItemChange(item.id, 'hsnCode', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-bold text-gray-700">Unit</Label>
                                                <Input
                                                    className="h-11 text-sm rounded-xl bg-white border-gray-300 shadow-2xs"
                                                    placeholder="Nos, Pcs, Box"
                                                    value={item.unit || ''}
                                                    onChange={e => handleItemChange(item.id, 'unit', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className={`grid ${canSeeFinancials ? 'grid-cols-3' : 'grid-cols-2'} gap-2.5`}>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-bold text-gray-700">Qty</Label>
                                            <Input
                                                className="h-11 text-sm text-center font-bold rounded-xl bg-white border-gray-300 shadow-2xs"
                                                type="number"
                                                value={item.quantity || ''}
                                                onChange={e => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                min="0"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-bold text-gray-700">Unit Price (₹)</Label>
                                            <Input
                                                className="h-11 text-sm text-right font-bold text-gray-900 rounded-xl bg-white border-gray-300 shadow-2xs"
                                                type="number"
                                                value={item.unitPrice || ''}
                                                onChange={e => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                min="0"
                                                step="0.01"
                                            />
                                        </div>
                                        {canSeeFinancials && (
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-bold text-emerald-800">P.Cost (₹)</Label>
                                                <Input
                                                    className="h-11 text-sm text-right font-bold text-emerald-900 rounded-xl bg-emerald-50/70 border-emerald-300 shadow-2xs"
                                                    type="number"
                                                    placeholder="Buy cost"
                                                    value={item.procurementCost || ''}
                                                    onChange={e => handleItemChange(item.id, 'procurementCost', parseFloat(e.target.value) || 0)}
                                                    min="0"
                                                    step="0.01"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Mobile Item Margin & Total Bar */}
                                    <div className="flex items-center justify-between pt-2.5 border-t border-gray-100 bg-gray-50/80 -mx-4 -mb-4 p-3 rounded-b-2xl">
                                        {canSeeFinancials && pCost > 0 ? (
                                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                                                margin >= 20 ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : margin >= 10 ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-red-100 text-red-800 border border-red-200'
                                            }`}>
                                                Margin: {margin.toFixed(1)}% (₹{profit.toFixed(1)}/u)
                                            </span>
                                        ) : (
                                            <span className="text-xs font-semibold text-gray-500">Line Total:</span>
                                        )}
                                        <div className="text-right">
                                            <span className="font-mono font-black text-base text-gray-900">
                                                ₹{(Number(item.total) || 0).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        <Button
                            type="button"
                            onClick={handleAddItem}
                            variant="outline"
                            className="w-full h-11 rounded-xl border-dashed border-2 border-indigo-200 text-indigo-700 bg-indigo-50/30 hover:bg-indigo-50 font-bold text-sm flex items-center justify-center gap-2 active:scale-98 transition-all"
                        >
                            <PlusCircle className="h-4 w-4" /> Add Another Item
                        </Button>
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50/80 border-b border-gray-200 text-xs">
                                    {showExtraColumns && <TableHead className="w-[140px]">Product</TableHead>}
                                    <TableHead className={showExtraColumns ? "w-1/3" : ""}>Item Description</TableHead>
                                    {showExtraColumns && <TableHead className="w-[90px]">HSN</TableHead>}
                                    {showExtraColumns && <TableHead className="w-[70px]">Unit</TableHead>}
                                    <TableHead className="w-[75px] text-right">Qty</TableHead>
                                    <TableHead className="w-[110px] text-right">Unit Price (₹)</TableHead>
                                    {canSeeFinancials && (
                                        <TableHead className="w-[110px] text-right text-emerald-700">P.Cost (₹)</TableHead>
                                    )}
                                    <TableHead className="w-[110px] text-right">Total (₹)</TableHead>
                                    <TableHead className="text-right w-[80px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {lineItems.map((item) => {
                                    const uPrice = Number(item.unitPrice) || 0;
                                    const pCost = Number(item.procurementCost) || 0;
                                    const margin = uPrice > 0 ? ((uPrice - pCost) / uPrice) * 100 : 0;

                                    return (
                                        <TableRow key={item.id} className="hover:bg-slate-50/80 border-b border-gray-100 text-xs">
                                            {showExtraColumns && (
                                                <TableCell className="p-2">
                                                    <Select onValueChange={(val) => handleProductSelect(item.id, val)}>
                                                        <SelectTrigger className="h-8 rounded-lg text-xs bg-white">
                                                            <SelectValue placeholder="Product..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {products.map(p => (
                                                                <SelectItem key={p.id} value={p.id!} className="text-xs">{p.name}</SelectItem>
                                                            ))}
                                                            <SelectItem value="none" className='text-gray-400 italic font-normal text-xs'>Manual entry...</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                            )}
                                            <TableCell className="p-2">
                                                <Input
                                                    className="h-8 text-xs rounded-lg bg-white"
                                                    placeholder="Item description"
                                                    value={item.name || ''}
                                                    onChange={e => handleItemChange(item.id, 'name', e.target.value)}
                                                />
                                            </TableCell>
                                            {showExtraColumns && (
                                                <TableCell className="p-2">
                                                    <Input
                                                        className="h-8 text-xs rounded-lg bg-white"
                                                        placeholder="HSN"
                                                        value={item.hsnCode || ''}
                                                        onChange={e => handleItemChange(item.id, 'hsnCode', e.target.value)}
                                                    />
                                                </TableCell>
                                            )}
                                            {showExtraColumns && (
                                                <TableCell className="p-2">
                                                    <Input
                                                        className="h-8 text-xs rounded-lg bg-white"
                                                        placeholder="Unit"
                                                        value={item.unit || ''}
                                                        onChange={e => handleItemChange(item.id, 'unit', e.target.value)}
                                                    />
                                                </TableCell>
                                            )}
                                            <TableCell className="p-2">
                                                <Input
                                                    className="h-8 text-xs text-right font-bold rounded-lg bg-white"
                                                    type="number"
                                                    value={item.quantity || ''}
                                                    onChange={e => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                    min="0"
                                                />
                                            </TableCell>
                                            <TableCell className="p-2">
                                                <Input
                                                    className="h-8 text-xs text-right font-bold text-gray-900 rounded-lg bg-white"
                                                    type="number"
                                                    value={item.unitPrice || ''}
                                                    onChange={e => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                    min="0"
                                                    step="0.01"
                                                />
                                            </TableCell>

                                            {canSeeFinancials && (
                                                <TableCell className="p-2">
                                                    <div className="space-y-0.5">
                                                        <Input
                                                            className="h-8 text-xs text-right font-bold text-emerald-800 rounded-lg bg-emerald-50/50 border-emerald-200"
                                                            type="number"
                                                            placeholder="0.00"
                                                            value={item.procurementCost || ''}
                                                            onChange={e => handleItemChange(item.id, 'procurementCost', parseFloat(e.target.value) || 0)}
                                                            min="0"
                                                            step="0.01"
                                                        />
                                                        {pCost > 0 && (
                                                            <div className="text-[10px] text-right font-mono font-bold text-emerald-600">
                                                                {margin.toFixed(0)}% mgn
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            )}

                                            <TableCell className="p-2 font-mono font-black text-right text-gray-900">
                                                ₹{(Number(item.total) || 0).toFixed(2)}
                                            </TableCell>

                                            <TableCell className="p-2 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <ChallanCalculator
                                                        currentUnitPrice={uPrice}
                                                        currentPCost={pCost}
                                                        onApplyPrice={(newPrice, newCost) => {
                                                            handleItemChange(item.id, 'unitPrice', newPrice);
                                                            if (newCost !== undefined) handleItemChange(item.id, 'procurementCost', newCost);
                                                        }}
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleRemoveItem(item.id)}
                                                        className="h-7 w-7 text-gray-400 hover:text-red-600 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>

                {/* ── Card Footer: Notes, Clean Summary & Actions ── */}
                <CardFooter className="bg-gray-50/80 p-4 sm:p-6 border-t border-gray-100 flex flex-col gap-5">
                    {/* Desktop View (>= lg) */}
                    <div className="hidden lg:flex flex-col w-full gap-5">
                        <div className="flex w-full justify-between items-start gap-6">
                            <div className="w-5/12 space-y-2">
                                <Label className="text-xs font-semibold text-gray-600">Dispatch Terms &amp; Returnable Note</Label>
                                <Textarea
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                    placeholder="Dispatch terms (e.g. non returnable basis)"
                                    className="rounded-xl text-xs bg-white min-h-[120px] border-gray-200"
                                />
                                <p className="text-[11px] text-gray-400">
                                    Printed on the bottom-left of the delivery challan PDF.
                                </p>
                            </div>

                            <div className="w-7/12 max-w-md bg-white p-5 rounded-2xl border border-gray-200/90 shadow-2xs space-y-3.5">
                                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                                    <div>
                                        <span className="text-xs font-bold text-gray-800 uppercase tracking-wider block">Challan Summary</span>
                                        <span className="text-[11px] text-gray-400 font-medium">Standard Delivery Challan</span>
                                    </div>
                                    <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                                        {lineItems.length} {lineItems.length === 1 ? 'item' : 'items'}
                                    </span>
                                </div>

                                {/* Total Challan Value (Grand Total) - Always Visible */}
                                <div className="p-3.5 bg-gradient-to-r from-indigo-50/90 via-blue-50/90 to-indigo-50/90 rounded-xl border border-indigo-100 flex items-center justify-between">
                                    <div>
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 block">Total Challan Value</span>
                                        <span className="text-[10px] text-indigo-500 font-medium">
                                            {showClientCharges ? 'Includes extra taxes & client charges' : 'Standard Challan (Total Goods Value)'}
                                        </span>
                                    </div>
                                    <span className="font-mono text-xl font-black text-indigo-950">₹{total.toFixed(2)}</span>
                                </div>

                                {/* Optional Client Taxes & Charges (Subtotal, GST, Shipping, Other Charges) */}
                                {!showClientCharges ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            triggerHaptic('light');
                                            setShowClientCharges(true);
                                        }}
                                        className="w-full py-2 px-3 rounded-xl border border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/40 text-gray-600 hover:text-indigo-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Add Subtotal, GST &amp; Client Charges (Optional)</span>
                                    </button>
                                ) : (
                                    <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/70 space-y-2 text-xs">
                                        <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600">Client Charges &amp; Taxes</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    triggerHaptic('light');
                                                    setGstRate(0);
                                                    setShipping(0);
                                                    setOther(0);
                                                    setShowClientCharges(false);
                                                }}
                                                className="text-[10px] font-bold text-red-500 hover:text-red-700 hover:underline"
                                            >
                                                Hide / Reset
                                            </button>
                                        </div>

                                        <div className="flex justify-between items-center">
                                            <span className="font-semibold text-gray-600">Subtotal</span>
                                            <span className="font-mono font-bold text-gray-900">₹{subtotal.toFixed(2)}</span>
                                        </div>

                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-semibold text-gray-600">GST @</span>
                                                <div className="inline-flex items-center bg-white rounded-lg px-2 py-0.5 border border-gray-200">
                                                    <input
                                                        type="number"
                                                        value={gstRate || ''}
                                                        onChange={e => setGstRate(parseFloat(e.target.value) || 0)}
                                                        className="w-10 bg-transparent text-right text-xs font-bold text-gray-900 focus:outline-hidden"
                                                        placeholder="0"
                                                        min="0"
                                                        step="0.5"
                                                    />
                                                    <span className="text-[10px] text-gray-500 font-bold ml-1">%</span>
                                                </div>
                                            </div>
                                            <span className="font-mono font-bold text-gray-900">₹{gstAmount.toFixed(2)}</span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/40">
                                            <div>
                                                <span className="text-[10px] font-semibold text-gray-500 block mb-0.5">Shipping (Client)</span>
                                                <div className="flex items-center gap-1 bg-white rounded-lg px-2 py-1 border border-gray-200 focus-within:border-indigo-400">
                                                    <span className="text-xs text-gray-400 font-semibold">₹</span>
                                                    <input
                                                        type="number"
                                                        value={shipping || ''}
                                                        onChange={e => setShipping(parseFloat(e.target.value) || 0)}
                                                        className="w-full bg-transparent text-right text-xs font-bold text-gray-900 focus:outline-hidden"
                                                        placeholder="0"
                                                        min="0"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-semibold text-gray-500 block mb-0.5">Other Charges (Client)</span>
                                                <div className="flex items-center gap-1 bg-white rounded-lg px-2 py-1 border border-gray-200 focus-within:border-indigo-400">
                                                    <span className="text-xs text-gray-400 font-semibold">₹</span>
                                                    <input
                                                        type="number"
                                                        value={other || ''}
                                                        onChange={e => setOther(parseFloat(e.target.value) || 0)}
                                                        className="w-full bg-transparent text-right text-xs font-bold text-gray-900 focus:outline-hidden"
                                                        placeholder="0"
                                                        min="0"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Internal Expenses (Transportation & Other Expenses - Not sent to client) */}
                                <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200/80 space-y-2">
                                    <div className="flex items-center justify-between pb-1 border-b border-amber-200/60">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">Our Expenses</span>
                                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                                Private • Not on DC
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-amber-700/80 font-medium">Used for profit calculation</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <Label className="text-[11px] font-bold text-gray-700 block">Transportation (₹)</Label>
                                            <div className="flex items-center gap-1 bg-white rounded-lg px-2 py-1 border border-amber-300/80 focus-within:border-amber-500 shadow-2xs">
                                                <span className="text-xs text-gray-400 font-semibold">₹</span>
                                                <input
                                                    type="number"
                                                    value={transportationExpense || ''}
                                                    onChange={e => setTransportationExpense(parseFloat(e.target.value) || 0)}
                                                    className="w-full bg-transparent text-right text-xs font-bold text-gray-900 focus:outline-hidden"
                                                    placeholder="0"
                                                    min="0"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-[11px] font-bold text-gray-700 block">Other Expenses (₹)</Label>
                                            <div className="flex items-center gap-1 bg-white rounded-lg px-2 py-1 border border-amber-300/80 focus-within:border-amber-500 shadow-2xs">
                                                <span className="text-xs text-gray-400 font-semibold">₹</span>
                                                <input
                                                    type="number"
                                                    value={otherExpense || ''}
                                                    onChange={e => setOtherExpense(parseFloat(e.target.value) || 0)}
                                                    className="w-full bg-transparent text-right text-xs font-bold text-gray-900 focus:outline-hidden"
                                                    placeholder="0"
                                                    min="0"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Financial Summary & Live Profit */}
                                    <div className="pt-2 border-t border-amber-200/60 space-y-1 text-xs">
                                        <div className="flex justify-between items-center text-gray-600">
                                            <span className="text-[11px]">Revenue (after 5.5% comm)</span>
                                            <span className="font-mono font-bold text-gray-800">₹{revenue.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-gray-600">
                                            <span className="text-[11px]">Total Expenses (P.Cost + Trans + Other)</span>
                                            <span className="font-mono font-bold text-amber-900">
                                                -₹{totalInternalExpenses.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className={`mt-1 p-2 rounded-lg border flex items-center justify-between ${
                                            grossProfit >= 0
                                                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                                : 'bg-red-50 text-red-900 border-red-200'
                                        }`}>
                                            <div>
                                                <span className="text-[10px] font-bold uppercase tracking-wider block">Estimated Profit</span>
                                                <span className="text-[9px] font-medium opacity-80">Margin: {marginPercent.toFixed(1)}%</span>
                                            </div>
                                            <span className="font-mono font-black text-sm">
                                                ₹{grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Save & Action Buttons Below Dispatch Terms & Summary */}
                        <div className="pt-4 border-t border-gray-200 flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                                {Boolean(initialData?.id) && (
                                    <>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleOpenAttachmentModal('signed_copy')}
                                            className={`h-10 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs ${
                                                signedCopyUrls.length > 0
                                                    ? 'bg-blue-50 text-[#3b2fc9] border-blue-300 hover:bg-blue-100'
                                                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                            }`}
                                        >
                                            <Paperclip className="w-3.5 h-3.5 text-[#3b2fc9]" />
                                            <span>Signed DC</span>
                                            {signedCopyUrls.length > 0 && (
                                                <span className="px-1.5 py-0.2 rounded-full bg-[#3b2fc9] text-white text-[10px] font-black">
                                                    {signedCopyUrls.length}
                                                </span>
                                            )}
                                        </Button>

                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleOpenAttachmentModal('invoice')}
                                            className={`h-10 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs ${
                                                goodsReceivedInvoiceUrls.length > 0
                                                    ? 'bg-blue-50 text-[#3b2fc9] border-blue-300 hover:bg-blue-100'
                                                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                            }`}
                                        >
                                            <FileText className="w-3.5 h-3.5 text-[#3b2fc9]" />
                                            <span>Goods Invoice</span>
                                            {goodsReceivedInvoiceUrls.length > 0 && (
                                                <span className="px-1.5 py-0.2 rounded-full bg-[#3b2fc9] text-white text-[10px] font-black">
                                                    {goodsReceivedInvoiceUrls.length}
                                                </span>
                                            )}
                                        </Button>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center gap-2.5">
                                {initialData && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCancelEdit}
                                        className="h-10 px-4 rounded-xl border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold shadow-2xs"
                                    >
                                        <X className="w-3.5 h-3.5 mr-1 text-red-500" /> Cancel
                                    </Button>
                                )}

                                <Button
                                    type="button"
                                    onClick={() => handleSaveChallan(false)}
                                    disabled={isSaving || isReadOnly || role === 'guest'}
                                    size="sm"
                                    className="h-10 px-5 text-xs sm:text-sm font-bold rounded-xl bg-gray-900 hover:bg-gray-800 text-white shadow-xs active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={isReadOnly || role === 'guest' ? 'Saving is disabled in guest mode' : undefined}
                                >
                                    {isSaving ? <Loader className="animate-spin w-4 h-4 mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
                                    {isReadOnly || role === 'guest' ? 'Read-Only' : (initialData ? 'Update Only' : 'Save Only')}
                                </Button>

                                <Button
                                    type="button"
                                    onClick={() => handleSaveChallan(true)}
                                    disabled={isSaving || isReadOnly || role === 'guest'}
                                    size="sm"
                                    className="h-10 px-5 text-xs sm:text-sm font-black rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={isReadOnly || role === 'guest' ? 'Saving is disabled in guest mode' : undefined}
                                >
                                    {isSaving ? <Loader className="animate-spin w-4 h-4 mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
                                    {isReadOnly || role === 'guest' ? 'Read-Only Mode' : (initialData ? 'Update & Download PDF' : 'Save & Download PDF')}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Mobile View (< lg): Spacious, Touch-Friendly Summary Card & Save Actions */}
                    <div className="lg:hidden w-full bg-white p-4 rounded-2xl border border-gray-200/90 shadow-xs space-y-3.5">
                        {/* Header + Total Value in Highlight Banner */}
                        <div className="p-3.5 bg-gradient-to-r from-indigo-50/80 via-blue-50/80 to-indigo-50/80 rounded-xl border border-indigo-100 flex items-center justify-between">
                            <div>
                                <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 block">Total Challan Value</span>
                                <span className="text-[11px] text-indigo-600 font-medium">
                                    {showClientCharges ? 'Includes extra taxes & client charges' : 'Standard Challan (Total Goods Value)'}
                                </span>
                            </div>
                            <span className="font-mono text-xl font-black text-indigo-950">₹{total.toFixed(2)}</span>
                        </div>

                        {/* Optional Client Taxes & Charges (Subtotal, GST, Shipping, Other Charges) */}
                        {!showClientCharges ? (
                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic('light');
                                    setShowClientCharges(true);
                                }}
                                className="w-full py-2 px-3 rounded-xl border border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/40 text-gray-600 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Subtotal, GST &amp; Client Charges (Optional)</span>
                            </button>
                        ) : (
                            <div className="p-3 bg-gray-50/90 rounded-xl border border-gray-200/80 space-y-2.5">
                                <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
                                    <span className="text-xs font-bold uppercase tracking-wider text-gray-700">Client Taxes &amp; Charges</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            triggerHaptic('light');
                                            setGstRate(0);
                                            setShipping(0);
                                            setOther(0);
                                            setShowClientCharges(false);
                                        }}
                                        className="text-xs font-bold text-red-500 hover:text-red-700 hover:underline"
                                    >
                                        Hide / Reset
                                    </button>
                                </div>

                                <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">
                                    <span className="text-xs font-bold text-gray-700">Subtotal</span>
                                    <span className="font-mono font-bold text-sm text-gray-900">₹{subtotal.toFixed(2)}</span>
                                </div>

                                <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-gray-700">GST Rate</span>
                                        <div className="flex items-center bg-gray-50 border border-gray-300 rounded-lg px-2 py-0.5">
                                            <input
                                                type="number"
                                                value={gstRate || ''}
                                                onChange={e => setGstRate(parseFloat(e.target.value) || 0)}
                                                className="w-12 text-center text-xs font-bold text-gray-900 focus:outline-hidden"
                                                placeholder="0"
                                                min="0"
                                                step="0.5"
                                            />
                                            <span className="text-xs text-gray-500 font-bold ml-1">%</span>
                                        </div>
                                    </div>
                                    <span className="font-mono font-bold text-sm text-gray-900">₹{gstAmount.toFixed(2)}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-2xs space-y-1">
                                        <span className="text-[11px] font-bold text-gray-700 block">Shipping (Client)</span>
                                        <div className="flex items-center">
                                            <span className="text-xs text-gray-400 font-semibold mr-1">₹</span>
                                            <input
                                                type="number"
                                                value={shipping || ''}
                                                onChange={e => setShipping(parseFloat(e.target.value) || 0)}
                                                className="w-full text-right text-xs font-bold text-gray-900 focus:outline-hidden"
                                                placeholder="0"
                                                min="0"
                                            />
                                        </div>
                                    </div>
                                    <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-2xs space-y-1">
                                        <span className="text-[11px] font-bold text-gray-700 block">Other (Client)</span>
                                        <div className="flex items-center">
                                            <span className="text-xs text-gray-400 font-semibold mr-1">₹</span>
                                            <input
                                                type="number"
                                                value={other || ''}
                                                onChange={e => setOther(parseFloat(e.target.value) || 0)}
                                                className="w-full text-right text-xs font-bold text-gray-900 focus:outline-hidden"
                                                placeholder="0"
                                                min="0"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Internal Expenses (Transportation & Other Expenses - Not sent to client) */}
                        <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200/80 space-y-2.5">
                            <div className="flex items-center justify-between pb-1 border-b border-amber-200/60">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold uppercase tracking-wider text-amber-900">Our Expenses</span>
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                        Private • Not on DC
                                    </span>
                                </div>
                                <span className="text-[10px] text-amber-700 font-medium">Profit Calc</span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-gray-700 block">Transportation (₹)</Label>
                                    <div className="flex items-center bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 shadow-2xs">
                                        <span className="text-xs text-gray-400 font-semibold mr-1">₹</span>
                                        <input
                                            type="number"
                                            value={transportationExpense || ''}
                                            onChange={e => setTransportationExpense(parseFloat(e.target.value) || 0)}
                                            className="w-full text-right text-xs font-bold text-gray-900 focus:outline-hidden"
                                            placeholder="0"
                                            min="0"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-gray-700 block">Other Expenses (₹)</Label>
                                    <div className="flex items-center bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 shadow-2xs">
                                        <span className="text-xs text-gray-400 font-semibold mr-1">₹</span>
                                        <input
                                            type="number"
                                            value={otherExpense || ''}
                                            onChange={e => setOtherExpense(parseFloat(e.target.value) || 0)}
                                            className="w-full text-right text-xs font-bold text-gray-900 focus:outline-hidden"
                                            placeholder="0"
                                            min="0"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Profit breakdown for mobile */}
                            <div className="pt-2 border-t border-amber-200/60 space-y-1 text-xs">
                                <div className="flex justify-between items-center text-gray-600">
                                    <span className="text-[11px]">Revenue (after 5.5% comm)</span>
                                    <span className="font-mono font-bold text-gray-800">₹{revenue.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-gray-600">
                                    <span className="text-[11px]">Expenses (P.Cost + Trans + Other)</span>
                                    <span className="font-mono font-bold text-amber-900">-₹{totalInternalExpenses.toFixed(2)}</span>
                                </div>
                                <div className={`mt-1.5 p-2 rounded-xl border flex items-center justify-between ${
                                    grossProfit >= 0
                                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                        : 'bg-red-50 text-red-900 border-red-200'
                                }`}>
                                    <div>
                                        <span className="text-[11px] font-bold uppercase tracking-wider block">Estimated Profit</span>
                                        <span className="text-[10px] font-medium opacity-80">Margin: {marginPercent.toFixed(1)}%</span>
                                    </div>
                                    <span className="font-mono font-black text-base">
                                        ₹{grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Dispatch Note Input */}
                        <div className="pt-2 border-t border-gray-100 space-y-1.5">
                            <Label className="text-xs font-bold text-gray-700 block">Dispatch Terms &amp; Note</Label>
                            <Input
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                placeholder="Dispatch terms (e.g. non-returnable basis)"
                                className="h-10 text-xs sm:text-sm bg-white border-gray-300 rounded-xl text-gray-800 px-3 w-full shadow-2xs"
                            />
                        </div>

                        {/* Save & Action Buttons DIRECTLY BELOW dispatch terms and note */}
                        <div className="pt-3 border-t border-gray-100 space-y-2.5">
                            {initialData && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleCancelEdit}
                                    className="h-11 w-full rounded-xl border-red-200 text-red-600 hover:bg-red-50 text-sm font-bold shadow-2xs active:scale-98"
                                >
                                    <X className="w-4 h-4 mr-1.5 text-red-500" /> Cancel Edit
                                </Button>
                            )}

                            <div className="grid grid-cols-2 gap-2.5">
                                <Button
                                    type="button"
                                    onClick={() => handleSaveChallan(false)}
                                    disabled={isSaving || isReadOnly || role === 'guest'}
                                    className="h-12 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs sm:text-sm shadow-xs active:scale-98 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={isReadOnly || role === 'guest' ? 'Saving is disabled in guest mode' : undefined}
                                >
                                    {isSaving ? <Loader className="animate-spin w-4 h-4 mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
                                    {isReadOnly || role === 'guest' ? 'Read-Only' : (initialData ? 'Update Only' : 'Save Only')}
                                </Button>

                                <Button
                                    type="button"
                                    onClick={() => handleSaveChallan(true)}
                                    disabled={isSaving || isReadOnly || role === 'guest'}
                                    className="h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs sm:text-sm shadow-sm active:scale-98 flex items-center justify-center text-center disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={isReadOnly || role === 'guest' ? 'Saving is disabled in guest mode' : undefined}
                                >
                                    {isSaving ? <Loader className="animate-spin w-4 h-4 mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
                                    {isReadOnly || role === 'guest' ? 'Read-Only Mode' : (initialData ? 'Update & PDF' : 'Save & Download')}
                                </Button>
                            </div>

                            {Boolean(initialData?.id) && (
                                <div className="grid grid-cols-2 gap-2 pt-1">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => handleOpenAttachmentModal('signed_copy')}
                                        className={`h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs ${
                                            signedCopyUrls.length > 0
                                                ? 'bg-blue-50 text-[#3b2fc9] border-blue-300'
                                                : 'bg-white border-gray-300 text-gray-700'
                                        }`}
                                    >
                                        <Paperclip className="w-3.5 h-3.5 text-[#3b2fc9]" />
                                        <span>Signed DC</span>
                                        {signedCopyUrls.length > 0 && (
                                            <span className="px-1.5 py-0.2 rounded-full bg-[#3b2fc9] text-white text-[10px] font-black">
                                                {signedCopyUrls.length}
                                            </span>
                                        )}
                                    </Button>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => handleOpenAttachmentModal('invoice')}
                                        className={`h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs ${
                                            goodsReceivedInvoiceUrls.length > 0
                                                ? 'bg-blue-50 text-[#3b2fc9] border-blue-300'
                                                : 'bg-white border-gray-300 text-gray-700'
                                        }`}
                                    >
                                        <FileText className="w-3.5 h-3.5 text-[#3b2fc9]" />
                                        <span>Goods Invoice</span>
                                        {goodsReceivedInvoiceUrls.length > 0 && (
                                            <span className="px-1.5 py-0.2 rounded-full bg-[#3b2fc9] text-white text-[10px] font-black">
                                                {goodsReceivedInvoiceUrls.length}
                                            </span>
                                        )}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </CardFooter>
            </Card>

            {/* ── Mobile Floating Quick Action Dock ── */}
            <div className="sm:hidden fixed bottom-[80px] left-3 right-3 z-30 max-w-lg mx-auto">
                {isDockMinimized ? (
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic('light');
                                setIsDockMinimized(false);
                            }}
                            className="bg-gradient-to-r from-slate-950 via-[#181156] to-[#251b85] text-white shadow-[0_12px_36px_rgba(24,17,86,0.55)] backdrop-blur-xl px-5 py-3 rounded-full flex items-center gap-3 text-sm font-bold active:scale-95 transition-all border-2 border-indigo-400/40"
                        >
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </span>
                            <span>{lineItems.length} {lineItems.length === 1 ? 'Item' : 'Items'}</span>
                            <span className="text-emerald-300 font-extrabold pl-2 border-l border-white/20">
                                ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </span>
                            <ChevronUp className="w-4 h-4 text-indigo-200 ml-1" />
                        </button>
                    </div>
                ) : (
                    <div className="bg-gradient-to-r from-slate-950 via-[#181156] to-[#251b85] text-white backdrop-blur-2xl border-2 border-indigo-400/40 rounded-2xl p-3 shadow-[0_16px_45px_rgba(15,23,42,0.65)] space-y-2.5 transition-all">
                        {/* Top Tier: Clean Stats & Dismiss Controls */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#3b2fc9] to-[#6366f1] text-white flex items-center justify-center font-black text-sm shrink-0 shadow-md shadow-indigo-900/50 border border-white/20">
                                    {lineItems.length}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-base font-black text-emerald-400 truncate leading-tight tracking-tight">
                                            ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                        </p>
                                        <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-white/10 text-indigo-200 border border-white/10">
                                            {lineItems.length} {lineItems.length === 1 ? 'Item' : 'Items'}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-indigo-200 truncate font-medium pt-0.5">
                                        {initialData ? `Editing DC ${dcNumber || ''}` : 'New Delivery Challan'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                                {initialData && (
                                    <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        disabled={isSaving}
                                        className="h-8 px-2.5 rounded-lg text-xs font-semibold text-rose-300 hover:text-white hover:bg-white/10 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic('light');
                                        setIsDockMinimized(true);
                                    }}
                                    className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 text-indigo-200 hover:text-white flex items-center justify-center shrink-0 transition-colors border border-white/10"
                                    title="Minimize toolbar"
                                >
                                    <ChevronDown className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Bottom Tier: Full-Width Prominent Touch Action Buttons */}
                        <div className="flex items-center gap-2 pt-0.5">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={isSaving || isReadOnly || role === 'guest'}
                                onClick={() => handleSaveChallan(false)}
                                className="flex-1 h-11 rounded-xl bg-white/10 hover:bg-white/20 border-white/25 text-white hover:text-white font-bold text-xs gap-2 active:scale-95 transition-transform shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                title={isReadOnly || role === 'guest' ? 'Saving is disabled in guest mode' : 'Save without downloading'}
                            >
                                <Save className="h-4 w-4 text-amber-300 shrink-0" />
                                <span>{isReadOnly || role === 'guest' ? 'Read-Only' : (initialData ? 'Update Only' : 'Save Only')}</span>
                            </Button>

                            <Button
                                type="button"
                                disabled={isSaving || isReadOnly || role === 'guest'}
                                onClick={() => handleSaveChallan(true)}
                                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs gap-2 shadow-lg shadow-emerald-500/35 border border-emerald-400/30 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                                title={isReadOnly || role === 'guest' ? 'Saving is disabled in guest mode' : undefined}
                            >
                                {isSaving ? (
                                    <Loader className="h-4 w-4 animate-spin shrink-0" />
                                ) : (
                                    <Save className="h-4 w-4 shrink-0" />
                                )}
                                <span>{isReadOnly || role === 'guest' ? 'Read-Only Mode' : (initialData ? 'Update & PDF' : 'Save & Download')}</span>
                            </Button>
                        </div>
                    </div>
                )}
            </div>
            {/* Attachment Modal for Form */}
            {activeAttachmentModal && initialData && (
                <DeliveryChallanAttachmentModal
                    isOpen={!!activeAttachmentModal}
                    onClose={() => setActiveAttachmentModal(null)}
                    challan={initialData}
                    type={activeAttachmentModal}
                    onUpdate={handleAttachmentUpdate}
                />
            )}
        </>
    );
}
