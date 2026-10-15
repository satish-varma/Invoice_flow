"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar as CalendarIcon, PlusCircle, Trash2, Loader, Save, FilePlus, ListOrdered, Settings as SettingsIcon, Truck, FileText, Sheet, Calculator, DollarSign, TrendingUp, Percent, Sparkles, Eye, EyeOff, X, FileCheck, Receipt, Paperclip, Download } from 'lucide-react';
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

interface DeliveryChallanFormProps {
    initialData?: Challan | null;
    onChallanSave: (savedChallan?: Challan) => void;
    onAddNew: () => void;
}

export function DeliveryChallanForm({ initialData, onChallanSave, onAddNew }: DeliveryChallanFormProps) {
    const [dcNumber, setDcNumber] = useState('');
    const [dcDate, setDcDate] = useState<Date | undefined>(undefined);

    const [billToName, setBillToName] = useState('');
    const [billToAddress, setBillToAddress] = useState('');

    const [shipToName, setShipToName] = useState('');
    const [shipToAddress, setShipToAddress] = useState('');

    const [lineItems, setLineItems] = useState<ChallanLineItem[]>([
        { id: 1, name: '', hsnCode: '', unit: '', quantity: 0, unitPrice: 0, total: 0, procurementCost: 0 },
    ]);
    const [note, setNote] = useState('The above goods sent on non returnable basis');
    const [clients, setClients] = useState<Client[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [saveAsClient, setSaveAsClient] = useState(false);

    const [gstRate, setGstRate] = useState(5);
    const [shipping, setShipping] = useState(0);
    const [other, setOther] = useState(0);

    // Modern Financials (like NewRelic)
    const [commissionRate, setCommissionRate] = useState<number>(5.5);
    const [showFinancials, setShowFinancials] = useState<boolean>(true);

    // Attachments
    const [signedCopyUrls, setSignedCopyUrls] = useState<string[]>(initialData?.signedCopyUrls || []);
    const [goodsReceivedInvoiceUrls, setGoodsReceivedInvoiceUrls] = useState<string[]>(initialData?.goodsReceivedInvoiceUrls || []);
    const [activeAttachmentModal, setActiveAttachmentModal] = useState<'signed_copy' | 'invoice' | null>(null);

    const [isImportingExcel, setIsImportingExcel] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const excelInputRef = useRef<HTMLInputElement>(null);
    const pathname = usePathname();
    const router = useRouter();

    const [settings, setSettings] = useState<Settings>({ companyProfiles: [], billToContacts: [], shipToContacts: [] });
    const [activeCompanyProfile, setActiveCompanyProfile] = useState<CompanyProfile | null>(null);

    const { toast } = useToast();
    const { user } = useAuth();

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

    const grossProfit = useMemo(() => {
        return revenue - totalProcurementCost - Number(shipping) - Number(other);
    }, [revenue, totalProcurementCost, shipping, other]);

    const marginPercent = useMemo(() => {
        return subtotal > 0 ? (grossProfit / subtotal) * 100 : 0;
    }, [grossProfit, subtotal]);

    const gstAmount = useMemo(() => {
        return (subtotal * gstRate) / 100;
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

            let profileToApply: CompanyProfile | undefined;
            if (initialData?.companyProfileId) {
                profileToApply = loadedSettings.companyProfiles?.find(p => p.id === initialData.companyProfileId);
            } else if (loadedSettings.defaultCompanyProfile) {
                profileToApply = loadedSettings.companyProfiles?.find(p => p.id === loadedSettings.defaultCompanyProfile);
            } else if (loadedSettings.companyProfiles && loadedSettings.companyProfiles.length > 0) {
                profileToApply = loadedSettings.companyProfiles[0];
            }

            if (profileToApply) {
                setActiveCompanyProfile(profileToApply);
            }

            const loadedClients = await getClients();
            setClients(loadedClients);

            const loadedProducts = await getProducts();
            setProducts(loadedProducts);

            if (!initialData) {
                if (loadedSettings.defaultBillToContact && loadedSettings.billToContacts) {
                    const defaultContact = loadedSettings.billToContacts.find(c => c.id === loadedSettings.defaultBillToContact);
                    if (defaultContact) {
                        setBillToName(defaultContact.name);
                        setBillToAddress(defaultContact.address);
                    }
                }
                if (loadedSettings.defaultShipToContact && loadedSettings.shipToContacts) {
                    const defaultContact = loadedSettings.shipToContacts.find(c => c.id === loadedSettings.defaultShipToContact);
                    if (defaultContact) {
                        setShipToName(defaultContact.name);
                        setShipToAddress(defaultContact.address);
                    }
                }
            }
        }
        loadSettingsAndApplyDefaults();
    }, [initialData]);

    useEffect(() => {
        if (initialData) {
            setDcNumber(initialData.dcNumber);
            setDcDate(new Date(initialData.dcDate));
            setBillToName(initialData.billToName || '');
            setBillToAddress(initialData.billToAddress || '');
            setShipToName(initialData.shipToName || '');
            setShipToAddress(initialData.shipToAddress || '');
            setLineItems((initialData.lineItems || []).map((item, index) => ({
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
            })));
            const calculatedGstRate = initialData.subtotal > 0 ? (initialData.gstAmount / initialData.subtotal) * 100 : 5;
            setGstRate(calculatedGstRate);
            setShipping(initialData.shipping || 0);
            setOther(initialData.other || 0);
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
                }
            }
        }
    };

    const handleClearForm = (shouldCallback = true) => {
        setDcNumber('');
        setDcDate(new Date());
        setBillToName('');
        setBillToAddress('');
        setShipToName('');
        setShipToAddress('');
        setLineItems([{ id: Date.now(), name: '', hsnCode: '', unit: '', quantity: 0, unitPrice: 0, procurementCost: 0, total: 0 }]);
        setGstRate(5);
        setShipping(0);
        setOther(0);
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
        if (!billToName) {
            toast({ variant: "destructive", title: "Bill To Name is required" });
            return;
        }
        if (!activeCompanyProfile) {
            toast({ variant: "destructive", title: "Company Profile is required", description: "Please select a company profile or add one in settings." });
            return;
        }

        setIsSaving(true);
        try {
            const creatorDisplayName = (user as any)?.name || (user?.email ? user.email.split('@')[0] : 'Satya');
            const creatorEmail = user?.email || 'satya@tgg.in';

            const challanData: Omit<Challan, 'dcNumber' | 'createdAt'> & { id?: string } = {
                dcDate: dcDate?.toISOString() || new Date().toISOString(),
                companyProfileId: activeCompanyProfile.id,
                billToName,
                billToAddress,
                shipToName: shipToName || billToName,
                shipToAddress: shipToAddress || billToAddress,
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
                shipping: Number(shipping),
                other: Number(other),
                total,
                note,
                procurementCost: totalProcurementCost,
                commissionRate: Number(commissionRate) || 5.5,
                commissionAmount,
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

            if (saveAsClient && billToName) {
                const existingClient = clients.find(c => c.name.toLowerCase() === billToName.toLowerCase());
                if (!existingClient) {
                    await saveClient({
                        name: billToName,
                        address: billToAddress,
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
            <div className="mb-4 sm:mb-6">
                <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-4 mb-3 sm:mb-4'>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl sm:text-3xl font-black text-gray-900 tracking-tight">
                                {initialData ? `Edit Delivery Challan` : 'Create Delivery Challan'}
                            </h1>
                            {initialData?.dcNumber && (
                                <span className="font-mono text-xs sm:text-sm px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/70">
                                    {initialData.dcNumber}
                                </span>
                            )}
                        </div>
                        <p className="hidden sm:block text-gray-500 text-xs sm:text-sm mt-0.5">
                            Dispatched goods details, consignee destination, procurement cost &amp; margin calculations
                        </p>
                    </div>

                    {/* Financials & Quick Tool Bar */}
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic('light');
                                setShowFinancials(!showFinancials);
                            }}
                            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                showFinancials
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs'
                                    : 'bg-gray-100 text-gray-600 border-gray-200'
                            }`}
                            title="Toggle Procurement Cost & Margin breakdown"
                        >
                            {showFinancials ? <Eye className="w-3.5 h-3.5 text-emerald-600" /> : <EyeOff className="w-3.5 h-3.5 text-gray-400" />}
                            <span>Financials: {showFinancials ? 'ON' : 'OFF'}</span>
                        </button>

                        <ChallanCalculator
                            triggerButton={
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 sm:h-8 px-2.5 rounded-xl border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-bold flex items-center gap-1.5"
                                >
                                    <Calculator className="w-3.5 h-3.5" />
                                    <span>MRP Calc</span>
                                </Button>
                            }
                        />
                    </div>
                </div>

                <div className='hidden sm:flex bg-white p-2.5 rounded-2xl border border-gray-200/80 shadow-xs w-full flex-col sm:flex-row items-center justify-between gap-2 flex-wrap'>
                    <nav className="flex items-center gap-1 flex-wrap">
                        <Button asChild variant="ghost" size="sm" className="h-8 text-xs font-semibold rounded-xl">
                            <Link href="/"><FilePlus className="w-3.5 h-3.5 mr-1" /> New Invoice</Link>
                        </Button>
                        <Button asChild variant="ghost" size="sm" className="h-8 text-xs font-semibold rounded-xl">
                            <Link href="/quotation"><FileText className="w-3.5 h-3.5 mr-1" /> Quotation</Link>
                        </Button>
                        <Button variant="secondary" size="sm" onClick={handleNewClick} className="h-8 text-xs font-bold rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
                            <Truck className="w-3.5 h-3.5 mr-1" /> New Challan
                        </Button>
                        <Button asChild variant="ghost" size="sm" className="h-8 text-xs font-semibold rounded-xl">
                            <Link href="/settings"><SettingsIcon className="w-3.5 h-3.5 mr-1" /> Settings</Link>
                        </Button>
                    </nav>

                    {/* Desktop action buttons */}
                    <div className="hidden sm:flex items-center gap-2 flex-wrap">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-semibold rounded-xl border-gray-200 text-gray-700"
                            onClick={() => excelInputRef.current?.click()}
                            disabled={isImportingExcel}
                        >
                            {isImportingExcel ? (
                                <><Loader className="animate-spin w-3.5 h-3.5 mr-1" /> Importing...</>
                            ) : (
                                <><Sheet className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Import Excel</>
                            )}
                        </Button>
                        {initialData && (
                            <>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenAttachmentModal('signed_copy')}
                                    className={`h-8 text-xs font-bold rounded-xl ${
                                        signedCopyUrls.length > 0
                                            ? 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'
                                            : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                                    }`}
                                    title="Manage Signed Copies"
                                >
                                    <Paperclip className="w-3.5 h-3.5 mr-1 text-[#3b2fc9]" />
                                    Signed Copies
                                    {signedCopyUrls.length > 0 && ` (${signedCopyUrls.length})`}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenAttachmentModal('invoice')}
                                    className={`h-8 text-xs font-bold rounded-xl ${
                                        goodsReceivedInvoiceUrls.length > 0
                                            ? 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'
                                            : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                                    }`}
                                    title="Goods Received Invoice"
                                >
                                    <FileText className="w-3.5 h-3.5 mr-1 text-[#3b2fc9]" />
                                    Goods Invoice
                                    {goodsReceivedInvoiceUrls.length > 0 && ` (${goodsReceivedInvoiceUrls.length})`}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCancelEdit}
                                    className="h-8 text-xs font-bold rounded-xl border-gray-300 text-gray-600 hover:bg-gray-100"
                                >
                                    <X className="w-3.5 h-3.5 mr-1" /> Cancel
                                </Button>
                            </>
                        )}
                        <Button
                            type="button"
                            onClick={() => handleSaveChallan(false)}
                            disabled={isSaving}
                            size="sm"
                            className="h-8 text-xs font-bold rounded-xl bg-gray-900 hover:bg-gray-800 text-white shadow-xs"
                        >
                            {isSaving ? <Loader className="animate-spin w-3.5 h-3.5 mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                            {initialData ? 'Update Only' : 'Save Only'}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => handleSaveChallan(true)}
                            disabled={isSaving}
                            size="sm"
                            className="h-8 text-xs font-black rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm"
                        >
                            {isSaving ? <Loader className="animate-spin w-3.5 h-3.5 mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                            {initialData ? 'Update & Download PDF' : 'Save & Download PDF'}
                        </Button>
                    </div>
                </div>
            </div>

            <input
                type="file"
                ref={excelInputRef}
                onChange={handleExcelImport}
                className="hidden"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                disabled={isImportingExcel}
            />

            <Card className="w-full rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden bg-white">
                <CardHeader className="bg-gray-50/70 p-4 sm:p-5 border-b border-gray-100 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-base font-bold text-gray-900">Dispatch &amp; Address Details</CardTitle>
                        <p className="text-xs text-gray-500 mt-0.5">Originating branch, consignment party &amp; ship-to destination</p>
                    </div>
                    {user?.email && (
                        <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 font-medium bg-white px-2.5 py-1 rounded-full border border-gray-200">
                            <span>Creator:</span>
                            <span className="font-bold text-indigo-700">{(user as any)?.name || user.email.split('@')[0]}</span>
                        </div>
                    )}
                </CardHeader>

                <CardContent className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column: From & DC Info */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-sm text-gray-900 uppercase tracking-wider">From (Sender)</h3>
                        </div>

                        {settings.companyProfiles && settings.companyProfiles.length > 0 && (
                            <div>
                                <Label className="text-xs font-semibold text-gray-600">Company Profile</Label>
                                <Select onValueChange={handleCompanyProfileSelect} value={activeCompanyProfile?.id}>
                                    <SelectTrigger className="h-9 mt-1 rounded-xl text-xs">
                                        <SelectValue placeholder="Select Profile" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {settings.companyProfiles.map((p) =>
                                            <SelectItem key={p.id} value={p.id} className="text-xs">
                                                {p.companyName}
                                            </SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {activeCompanyProfile && (
                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-600 space-y-1">
                                <p className="font-bold text-gray-900">{activeCompanyProfile.companyName}</p>
                                <p className="text-gray-500 whitespace-pre-wrap">{activeCompanyProfile.companyAddress}</p>
                                {activeCompanyProfile.companyGstin && (
                                    <p className="text-[11px] font-mono"><span className="font-bold">GSTIN:</span> {activeCompanyProfile.companyGstin}</p>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <div>
                                <Label className="text-xs font-semibold text-gray-600">DC Number</Label>
                                <Input
                                    value={dcNumber}
                                    onChange={(e) => setDcNumber(e.target.value)}
                                    placeholder="Auto-generated on save"
                                    disabled={!initialData}
                                    className="h-9 mt-1 rounded-xl text-xs font-mono font-bold text-indigo-700 bg-gray-50"
                                />
                            </div>
                            <div>
                                <Label className="text-xs font-semibold text-gray-600">DC Date</Label>
                                <div className="relative mt-1">
                                    <div className="h-9 px-3 rounded-xl border border-gray-200 bg-white flex items-center justify-between text-xs cursor-pointer">
                                        <div className="flex items-center gap-1.5 text-gray-700">
                                            <CalendarIcon className="h-3.5 w-3.5 text-gray-400" />
                                            <span>{dcDate ? format(dcDate, "dd MMM yyyy") : 'Select date'}</span>
                                        </div>
                                    </div>
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
                        </div>

                        {/* Bill To */}
                        <div className="space-y-2 pt-2 border-t border-gray-100">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-sm text-gray-900 uppercase tracking-wider">Bill To (Client)</h3>
                                <div className="flex items-center gap-1.5">
                                    <Checkbox
                                        id="saveAsClient"
                                        checked={saveAsClient}
                                        onCheckedChange={(checked) => setSaveAsClient(!!checked)}
                                    />
                                    <label htmlFor="saveAsClient" className="text-[11px] text-gray-500 font-medium cursor-pointer">
                                        Save client
                                    </label>
                                </div>
                            </div>

                            <div>
                                <Select onValueChange={(value) => handleContactSelect(value, 'billTo')}>
                                    <SelectTrigger className="h-9 rounded-xl text-xs">
                                        <SelectValue placeholder="Quick fill from saved contacts..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {allSavedClients.map((c) =>
                                            <SelectItem key={`${c.id}-${c.type}-bill`} value={`${c.id}|${c.type}`} className="text-xs">
                                                {c.displayName} ({c.type === 'client' ? 'Client' : c.type === 'billTo' ? 'Bill' : 'Ship'})
                                            </SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <Input
                                placeholder="Billing Client / Company Name *"
                                value={billToName}
                                onChange={e => setBillToName(e.target.value)}
                                className="h-9 rounded-xl text-xs font-semibold"
                            />
                            <Textarea
                                placeholder="Billing Address"
                                value={billToAddress}
                                onChange={e => setBillToAddress(e.target.value)}
                                className="rounded-xl text-xs min-h-[65px]"
                            />
                        </div>
                    </div>

                    {/* Right Column: Ship To (Consignee) */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-sm text-indigo-700 uppercase tracking-wider">
                                Ship To (Consignee Destination)
                            </h3>
                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic('light');
                                    setShipToName(billToName);
                                    setShipToAddress(billToAddress);
                                }}
                                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
                            >
                                Same as Bill To
                            </button>
                        </div>

                        <div>
                            <Label className="text-xs font-semibold text-gray-600">Select Saved Consignee</Label>
                            <Select onValueChange={(value) => handleContactSelect(value, 'shipTo')}>
                                <SelectTrigger className="h-9 mt-1 rounded-xl text-xs">
                                    <SelectValue placeholder="Quick fill ship-to contact..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {allSavedClients.map((c) =>
                                        <SelectItem key={`${c.id}-${c.type}-ship`} value={`${c.id}|${c.type}`} className="text-xs">
                                            {c.displayName} ({c.type === 'client' ? 'Client' : c.type === 'billTo' ? 'Bill' : 'Ship'})
                                        </SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor='shipToName' className="text-xs font-semibold text-gray-600">Consignee Name</Label>
                            <Input
                                id="shipToName"
                                placeholder="Shipping / Warehouse / Site Name"
                                value={shipToName}
                                onChange={e => setShipToName(e.target.value)}
                                className="h-9 mt-1 rounded-xl text-xs font-semibold text-gray-900"
                            />
                        </div>

                        <div>
                            <Label htmlFor='shipToAddress' className="text-xs font-semibold text-gray-600">Consignee Shipping Address</Label>
                            <Textarea
                                id="shipToAddress"
                                placeholder="Detailed Delivery / Site Address (Street, Plot, Mandal, PIN, State)"
                                value={shipToAddress}
                                onChange={e => setShipToAddress(e.target.value)}
                                className="rounded-xl text-xs min-h-[95px] mt-1"
                            />
                        </div>

                        <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-[11px] text-indigo-900 space-y-1">
                            <span className="font-bold flex items-center gap-1 text-indigo-700">
                                <Truck className="w-3.5 h-3.5" /> Destination Note:
                            </span>
                            <p className="text-indigo-800/80">
                                This address appears as the primary delivery recipient on printed challans and mobile dispatch view.
                            </p>
                        </div>
                    </div>
                </CardContent>

                {/* ── Line Items Section with P.Cost & Margin ── */}
                <CardContent className="p-4 sm:p-6 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <div>
                            <h3 className="font-bold text-sm text-gray-900 tracking-tight flex items-center gap-2">
                                <span>Dispatched Line Items ({lineItems.length})</span>
                                {showFinancials && totalProcurementCost > 0 && (
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Total P.Cost: ₹{totalProcurementCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </span>
                                )}
                            </h3>
                            <p className="text-xs text-gray-500">Quantities, unit rates, purchase costs &amp; margin calculations</p>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                onClick={handleAddItem}
                                variant="outline"
                                size="sm"
                                className="h-8 px-2.5 rounded-xl border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-bold active:scale-95"
                            >
                                <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Add Item
                            </Button>
                        </div>
                    </div>

                    {/* Mobile Line Items View */}
                    <div className="md:hidden space-y-3">
                        {lineItems.map((item, index) => {
                            const uPrice = Number(item.unitPrice) || 0;
                            const pCost = Number(item.procurementCost) || 0;
                            const profit = uPrice - pCost;
                            const margin = uPrice > 0 ? (profit / uPrice) * 100 : 0;

                            return (
                                <div key={item.id} className="border border-gray-200 rounded-2xl p-3.5 bg-gray-50/60 space-y-2.5 shadow-2xs">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[11px] font-black text-indigo-700 uppercase tracking-wider">
                                            #{index + 1}
                                        </span>
                                        <div className="flex items-center gap-1">
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
                                                className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div>
                                        <Label className="text-[11px] text-gray-500 font-semibold">Select Catalog Product</Label>
                                        <Select onValueChange={(val) => handleProductSelect(item.id, val)}>
                                            <SelectTrigger className="h-8 mt-0.5 rounded-xl text-xs bg-white">
                                                <SelectValue placeholder="Quick fill product..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {products.map(p => (
                                                    <SelectItem key={p.id} value={p.id!} className="text-xs">{p.name}</SelectItem>
                                                ))}
                                                <SelectItem value="none" className='text-gray-400 italic font-normal text-xs'>Manual entry...</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label className="text-[11px] text-gray-500 font-semibold">Item Description *</Label>
                                        <Input
                                            className="mt-0.5 h-8 text-xs rounded-xl bg-white"
                                            placeholder="Item name / brand / pack size"
                                            value={item.name || ''}
                                            onChange={e => handleItemChange(item.id, 'name', e.target.value)}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <Label className="text-[11px] text-gray-500 font-semibold">HSN Code</Label>
                                            <Input
                                                className="mt-0.5 h-8 text-xs rounded-xl bg-white"
                                                placeholder="HSN"
                                                value={item.hsnCode || ''}
                                                onChange={e => handleItemChange(item.id, 'hsnCode', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[11px] text-gray-500 font-semibold">Unit</Label>
                                            <Input
                                                className="mt-0.5 h-8 text-xs rounded-xl bg-white"
                                                placeholder="Nos, Pcs, Box"
                                                value={item.unit || ''}
                                                onChange={e => handleItemChange(item.id, 'unit', e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className={`grid ${showFinancials ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                                        <div>
                                            <Label className="text-[11px] text-gray-500 font-semibold">Qty</Label>
                                            <Input
                                                className="mt-0.5 h-8 text-xs text-right rounded-xl font-bold bg-white"
                                                type="number"
                                                value={item.quantity || ''}
                                                onChange={e => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                min="0"
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-[11px] text-gray-500 font-semibold">Unit Price (₹)</Label>
                                            <Input
                                                className="mt-0.5 h-8 text-xs text-right rounded-xl font-bold text-gray-900 bg-white"
                                                type="number"
                                                value={item.unitPrice || ''}
                                                onChange={e => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                min="0"
                                                step="0.01"
                                            />
                                        </div>
                                        {showFinancials && (
                                            <div>
                                                <Label className="text-[11px] text-emerald-700 font-semibold">P.Cost (₹)</Label>
                                                <Input
                                                    className="mt-0.5 h-8 text-xs text-right rounded-xl font-bold text-emerald-800 bg-emerald-50/50 border-emerald-200"
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
                                    <div className="flex items-center justify-between pt-2 border-t border-gray-200/60 text-xs">
                                        {showFinancials && pCost > 0 ? (
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                margin >= 20 ? 'bg-emerald-100 text-emerald-800' : margin >= 10 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                                Margin: {margin.toFixed(1)}% (₹{profit.toFixed(1)}/u)
                                            </span>
                                        ) : (
                                            <span className="text-[11px] text-gray-400">Line Total:</span>
                                        )}
                                        <div className="text-right">
                                            <span className="font-mono font-black text-sm text-gray-900">
                                                ₹{(Number(item.total) || 0).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50/80 border-b border-gray-200 text-xs">
                                    <TableHead className="w-[140px]">Product</TableHead>
                                    <TableHead className="w-1/3">Item Description</TableHead>
                                    <TableHead className="w-[90px]">HSN</TableHead>
                                    <TableHead className="w-[70px]">Unit</TableHead>
                                    <TableHead className="w-[75px] text-right">Qty</TableHead>
                                    <TableHead className="w-[110px] text-right">Unit Price (₹)</TableHead>
                                    {showFinancials && (
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
                                            <TableCell className="p-2">
                                                <Input
                                                    className="h-8 text-xs rounded-lg bg-white"
                                                    placeholder="Item description"
                                                    value={item.name || ''}
                                                    onChange={e => handleItemChange(item.id, 'name', e.target.value)}
                                                />
                                            </TableCell>
                                            <TableCell className="p-2">
                                                <Input
                                                    className="h-8 text-xs rounded-lg bg-white"
                                                    placeholder="HSN"
                                                    value={item.hsnCode || ''}
                                                    onChange={e => handleItemChange(item.id, 'hsnCode', e.target.value)}
                                                />
                                            </TableCell>
                                            <TableCell className="p-2">
                                                <Input
                                                    className="h-8 text-xs rounded-lg bg-white"
                                                    placeholder="Unit"
                                                    value={item.unit || ''}
                                                    onChange={e => handleItemChange(item.id, 'unit', e.target.value)}
                                                />
                                            </TableCell>
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

                                            {showFinancials && (
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

                    {/* ── Action & Attachment Bar Directly Below Line Items ── */}
                    <div className="pt-3 border-t border-gray-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-gradient-to-r from-slate-50 via-indigo-50/20 to-slate-50 p-2.5 sm:p-4 rounded-2xl border border-gray-200 shadow-2xs">
                        {/* Left: Add Line Item & Upload Attachments */}
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <Button
                                type="button"
                                onClick={handleAddItem}
                                variant="outline"
                                size="sm"
                                className="h-8 sm:h-9 px-3 rounded-xl border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-bold active:scale-95 shadow-2xs flex-1 sm:flex-initial"
                            >
                                <PlusCircle className="mr-1.5 h-3.5 sm:h-4 w-3.5 sm:w-4" /> Add Item
                            </Button>

                            {/* Upload Signed DC Copy Button */}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenAttachmentModal('signed_copy')}
                                className={`h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs flex-1 sm:flex-initial ${
                                    signedCopyUrls.length > 0
                                        ? 'bg-blue-50 text-[#3b2fc9] border-blue-300 hover:bg-blue-100 ring-1 ring-blue-300'
                                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-[#3b2fc9]'
                                }`}
                                title={initialData ? "Manage Signed Copies" : "Save challan first to upload signed copy"}
                            >
                                <Paperclip className="w-3.5 h-3.5 text-[#3b2fc9]" />
                                <span>Signed DC</span>
                                {signedCopyUrls.length > 0 ? (
                                    <span className="px-1.5 py-0.2 rounded-full bg-[#3b2fc9] text-white text-[10px] font-black">
                                        {signedCopyUrls.length}
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-gray-400 font-normal">+Upload</span>
                                )}
                            </Button>

                            {/* Goods Received Invoice Button */}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenAttachmentModal('invoice')}
                                className={`h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs flex-1 sm:flex-initial ${
                                    goodsReceivedInvoiceUrls.length > 0
                                        ? 'bg-blue-50 text-[#3b2fc9] border-blue-300 hover:bg-blue-100 ring-1 ring-blue-300'
                                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-[#3b2fc9]'
                                }`}
                                title={initialData ? "Goods Received Invoice" : "Save challan first to upload invoice"}
                            >
                                <FileText className="w-3.5 h-3.5 text-[#3b2fc9]" />
                                <span>Goods Invoice</span>
                                {goodsReceivedInvoiceUrls.length > 0 ? (
                                    <span className="px-1.5 py-0.2 rounded-full bg-[#3b2fc9] text-white text-[10px] font-black">
                                        {goodsReceivedInvoiceUrls.length}
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-gray-400 font-normal">+Upload</span>
                                )}
                            </Button>
                        </div>

                        {/* Right: Update Only, Update & Download, Cancel Edit */}
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
                            {initialData && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCancelEdit}
                                    className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 text-xs font-bold active:scale-95 shadow-2xs flex-1 sm:flex-initial"
                                >
                                    <X className="w-3.5 h-3.5 mr-1 text-red-500" /> Cancel
                                </Button>
                            )}

                            <Button
                                type="button"
                                onClick={() => handleSaveChallan(false)}
                                disabled={isSaving}
                                size="sm"
                                className="h-8 sm:h-9 px-3 sm:px-4 text-xs font-bold rounded-xl bg-gray-900 hover:bg-gray-800 text-white shadow-xs active:scale-95 flex-1 sm:flex-initial"
                            >
                                {isSaving ? <Loader className="animate-spin w-3.5 h-3.5 mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                                {initialData ? 'Update Only' : 'Save Only'}
                            </Button>

                            <Button
                                type="button"
                                onClick={() => handleSaveChallan(true)}
                                disabled={isSaving}
                                size="sm"
                                className="h-8 sm:h-9 px-3 sm:px-4 text-xs font-black rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm active:scale-95 w-full sm:w-auto"
                            >
                                {isSaving ? <Loader className="animate-spin w-3.5 h-3.5 mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                                {initialData ? 'Update & Download PDF' : 'Save & Download PDF'}
                            </Button>
                        </div>
                    </div>
                </CardContent>

                {/* ── Card Footer: Notes & Modern Financials Breakdown ── */}
                <CardFooter className="bg-gray-50/80 p-4 sm:p-6 flex flex-col lg:flex-row justify-between items-start gap-6 border-t border-gray-100">
                    {/* Left: Notes & Financials Card */}
                    <div className="w-full lg:w-7/12 space-y-4">
                        <div>
                            <Label className="text-xs font-semibold text-gray-600">Dispatch Terms &amp; Returnable Note</Label>
                            <Textarea
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                className="rounded-xl text-xs mt-1 bg-white min-h-[60px]"
                            />
                        </div>

                        {/* Modern Financials Card (like NewRelic) */}
                        {showFinancials && (
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white shadow-md border border-indigo-800/60 space-y-3">
                                <div className="flex items-center justify-between border-b border-indigo-800/80 pb-2">
                                    <div className="flex items-center gap-2">
                                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                                        <span className="font-bold text-xs uppercase tracking-wider text-indigo-200">
                                            Financial Margin &amp; Commission Analysis
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                                        {marginPercent.toFixed(1)}% Est. Margin
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                    <div>
                                        <span className="text-[10px] text-indigo-300 block">Total MRP / Value</span>
                                        <span className="font-mono font-bold text-white text-sm">
                                            ₹{subtotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-indigo-300 block">Total P.Cost</span>
                                        <span className="font-mono font-bold text-amber-300 text-sm">
                                            ₹{totalProcurementCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                        </span>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1 text-[10px] text-indigo-300">
                                            <span>Commission @</span>
                                            <input
                                                type="number"
                                                value={commissionRate}
                                                onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
                                                className="w-10 bg-indigo-900/80 border border-indigo-700 text-white rounded text-[10px] text-center font-bold px-0.5 py-0.2"
                                            />
                                            <span>%</span>
                                        </div>
                                        <span className="font-mono font-bold text-red-300 text-sm">
                                            -₹{commissionAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-emerald-300 block font-bold">Estimated Profit</span>
                                        <span className="font-mono font-black text-emerald-400 text-base">
                                            ₹{grossProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Standard Total Breakdown */}
                    <div className="w-full lg:w-5/12 max-w-sm space-y-2 text-xs bg-white p-4 rounded-2xl border border-gray-200/80 shadow-2xs self-end">
                        <div className="flex justify-between text-gray-600">
                            <span>Subtotal</span>
                            <span className='font-mono font-bold text-gray-900'>₹{subtotal.toFixed(2)}</span>
                        </div>

                        <div className="flex justify-between items-center text-gray-600">
                            <div className="flex items-center gap-1">
                                <span>GST @</span>
                                <Input
                                    type="number"
                                    value={gstRate || ''}
                                    onChange={e => setGstRate(parseFloat(e.target.value) || 0)}
                                    className="h-7 text-right w-14 rounded-lg text-xs"
                                    placeholder="5"
                                />
                                <span>%</span>
                            </div>
                            <span className='font-mono font-bold text-gray-900'>₹{gstAmount.toFixed(2)}</span>
                        </div>

                        <div className="flex justify-between items-center text-gray-600">
                            <span>Shipping / Transport</span>
                            <Input
                                type="number"
                                value={shipping || ''}
                                onChange={e => setShipping(parseFloat(e.target.value) || 0)}
                                className="h-7 text-right w-24 rounded-lg text-xs"
                                placeholder="0"
                            />
                        </div>

                        <div className="flex justify-between items-center text-gray-600">
                            <span>Other Charges</span>
                            <Input
                                type="number"
                                value={other || ''}
                                onChange={e => setOther(parseFloat(e.target.value) || 0)}
                                className="h-7 text-right w-24 rounded-lg text-xs"
                                placeholder="0"
                            />
                        </div>

                        <div className="flex justify-between items-baseline font-black text-base border-t border-gray-200 pt-2.5 mt-2 text-gray-900">
                            <span>Total Challan Value</span>
                            <span className="font-mono text-lg text-indigo-700">₹{total.toFixed(2)}</span>
                        </div>
                    </div>
                </CardFooter>
            </Card>

            {/* Signed Copies & Invoice Management (only when editing) */}
            {initialData?.id && (
                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:flex-1 h-11 sm:h-10 gap-2 border-gray-300 text-gray-700 bg-white hover:bg-gray-50 shadow-xs font-semibold"
                        onClick={() => handleOpenAttachmentModal('signed_copy')}
                    >
                        <Paperclip className="h-4 w-4 text-[#3b2fc9]" />
                        Manage Signed Copies {(signedCopyUrls || []).length > 0 && `(${signedCopyUrls.length})`}
                    </Button>
                    
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:flex-1 h-11 sm:h-10 gap-2 border-gray-300 text-gray-700 bg-white hover:bg-gray-50 shadow-xs font-semibold"
                        onClick={() => handleOpenAttachmentModal('invoice')}
                    >
                        <FileText className="h-4 w-4 text-[#3b2fc9]" />
                        Goods Received Invoice {(goodsReceivedInvoiceUrls || []).length > 0 && `(${goodsReceivedInvoiceUrls.length})`}
                    </Button>
                </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 pt-2">
                {initialData && (
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:flex-1 h-11 sm:h-10 text-gray-500 border-gray-300 hover:bg-gray-100 font-medium"
                        disabled={isSaving}
                        onClick={handleCancelEdit}
                    >
                        Cancel
                    </Button>
                )}
                <Button
                    type="button"
                    className="w-full sm:flex-1 h-11 sm:h-10 bg-[#3b2fc9] hover:bg-[#2d23a0] text-white gap-2 font-bold shadow-sm"
                    disabled={isSaving}
                    onClick={() => handleSaveChallan(true)}
                >
                    {isSaving ? (
                        <Loader className="h-4 w-4 animate-spin" />
                    ) : (
                        <Download className="h-4 w-4" />
                    )}
                    {initialData ? 'Update & Download' : 'Save & Download PDF'}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:flex-1 h-11 sm:h-10 gap-2 border-gray-300 text-gray-800 hover:bg-gray-50 font-bold shadow-xs"
                    disabled={isSaving}
                    onClick={() => handleSaveChallan(false)}
                >
                    <Save className="h-4 w-4 text-gray-600" />
                    {initialData ? 'Update Only' : 'Save Only'}
                </Button>
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
