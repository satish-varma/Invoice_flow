"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar as CalendarIcon, PlusCircle, Trash2, Loader, Save, FilePlus, ListOrdered, Settings as SettingsIcon, Truck, FileText, Sheet, Calculator, DollarSign, TrendingUp, Percent, Sparkles, Eye, EyeOff, X, FileCheck, Receipt, Paperclip, Download, MapPin } from 'lucide-react';
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
    const { user, role } = useAuth();
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
        setBillToName(defaultHungerBoxBillTo.name);
        setBillToAddress(defaultHungerBoxBillTo.address);
        setShipToName('');
        setShipToAddress('');
        setLineItems([{ id: Date.now(), name: '', hsnCode: '', unit: '', quantity: 0, unitPrice: 0, procurementCost: 0, total: 0 }]);
        setShowExtraColumns(false);
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
                        {isAdmin && (
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
                        )}

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
                <CardHeader className="bg-gray-50/70 p-4 sm:p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-base sm:text-lg font-bold text-gray-900">Consignee &amp; Delivery Destination</CardTitle>
                            {user?.email && (
                                <span className="text-xs text-gray-600 font-medium bg-white px-2.5 py-1 rounded-full border border-gray-200 shadow-2xs">
                                    Creator: <strong className="text-indigo-700">{(user as any)?.name || user.email.split('@')[0]}</strong>
                                </span>
                            )}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-500 mt-1">Quick fill consignee location and site delivery address</p>
                    </div>

                    {/* DC Number & DC Date in Header */}
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

                    {/* ── Action & Attachment Bar Directly Below Line Items ── */}
                    <div className="pt-3 border-t border-gray-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-50 via-indigo-50/20 to-slate-50 p-3 sm:p-4 rounded-2xl border border-gray-200 shadow-2xs">
                        {/* Left: Add Line Item & Upload Attachments */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <Button
                                type="button"
                                onClick={handleAddItem}
                                variant="outline"
                                size="sm"
                                className="h-10 sm:h-9 px-3.5 sm:px-3 rounded-xl border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs sm:text-sm font-bold active:scale-95 shadow-2xs flex-1 sm:flex-initial"
                            >
                                <PlusCircle className="mr-1.5 h-4 w-4" /> Add Item
                            </Button>

                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    triggerHaptic('light');
                                    setShowExtraColumns(!showExtraColumns);
                                }}
                                className="h-10 sm:h-9 px-3 rounded-xl border-gray-200 text-gray-700 hover:bg-white text-xs font-semibold shadow-2xs flex-1 sm:flex-initial"
                            >
                                {showExtraColumns ? '− Hide HSN / Unit' : '+ Add HSN / Unit'}
                            </Button>

                            {/* Upload Signed DC Copy & Goods Invoice - Only available when editing an existing challan */}
                            {Boolean(initialData?.id) && (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleOpenAttachmentModal('signed_copy')}
                                        className={`h-10 sm:h-9 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs flex-1 sm:flex-initial ${
                                            signedCopyUrls.length > 0
                                                ? 'bg-blue-50 text-[#3b2fc9] border-blue-300 hover:bg-blue-100 ring-1 ring-blue-300'
                                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-[#3b2fc9]'
                                        }`}
                                        title="Manage Signed Copies"
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

                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleOpenAttachmentModal('invoice')}
                                        className={`h-10 sm:h-9 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs flex-1 sm:flex-initial ${
                                            goodsReceivedInvoiceUrls.length > 0
                                                ? 'bg-blue-50 text-[#3b2fc9] border-blue-300 hover:bg-blue-100 ring-1 ring-blue-300'
                                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-[#3b2fc9]'
                                        }`}
                                        title="Goods Received Invoice"
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
                                </>
                            )}
                        </div>

                        {/* Right: Update Only, Update & Download, Cancel Edit */}
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                            {initialData && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCancelEdit}
                                    className="h-10 sm:h-9 px-3 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 text-xs font-bold active:scale-95 shadow-2xs flex-1 sm:flex-initial"
                                >
                                    <X className="w-3.5 h-3.5 mr-1 text-red-500" /> Cancel
                                </Button>
                            )}

                            <Button
                                type="button"
                                onClick={() => handleSaveChallan(false)}
                                disabled={isSaving}
                                size="sm"
                                className="h-11 sm:h-9 px-4 text-xs sm:text-sm font-bold rounded-xl bg-gray-900 hover:bg-gray-800 text-white shadow-xs active:scale-95 flex-1 sm:flex-initial"
                            >
                                {isSaving ? <Loader className="animate-spin w-4 h-4 mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
                                {initialData ? 'Update Only' : 'Save Only'}
                            </Button>

                            <Button
                                type="button"
                                onClick={() => handleSaveChallan(true)}
                                disabled={isSaving}
                                size="sm"
                                className="h-11 sm:h-9 px-4 text-xs sm:text-sm font-black rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm active:scale-95 w-full sm:w-auto"
                            >
                                {isSaving ? <Loader className="animate-spin w-4 h-4 mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
                                {initialData ? 'Update & Download PDF' : 'Save & Download PDF'}
                            </Button>
                        </div>
                    </div>
                </CardContent>

                {/* ── Card Footer: Notes & Clean Summary ── */}
                <CardFooter className="bg-gray-50/80 p-3 sm:p-6 border-t border-gray-100">
                    {/* Desktop View (>= lg) */}
                    <div className="hidden lg:flex w-full justify-between items-start gap-6">
                        <div className="w-6/12 space-y-2">
                            <Label className="text-xs font-semibold text-gray-600">Dispatch Terms &amp; Returnable Note</Label>
                            <Textarea
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                className="rounded-xl text-xs bg-white min-h-[90px] border-gray-200"
                            />
                            <p className="text-[11px] text-gray-400">
                                Printed on the bottom-left of the delivery challan PDF.
                            </p>
                        </div>

                        <div className="w-5/12 max-w-sm bg-white p-5 rounded-2xl border border-gray-200/90 shadow-2xs space-y-3 self-end">
                            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Challan Summary</span>
                                <span className="text-[11px] text-gray-400 font-medium">Amounts in INR (₹)</span>
                            </div>

                            {/* Subtotal */}
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-gray-600">Subtotal</span>
                                <span className="font-mono font-bold text-sm text-gray-900">₹{subtotal.toFixed(2)}</span>
                            </div>

                            {/* GST @ % */}
                            <div className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-gray-600">GST @</span>
                                    <div className="inline-flex items-center bg-gray-100 rounded-lg px-2 py-0.5 border border-gray-200">
                                        <input
                                            type="number"
                                            value={gstRate || ''}
                                            onChange={e => setGstRate(parseFloat(e.target.value) || 0)}
                                            className="w-10 bg-transparent text-right text-xs font-bold text-gray-900 focus:outline-hidden"
                                            placeholder="5"
                                            min="0"
                                            step="0.5"
                                        />
                                        <span className="text-[10px] text-gray-500 font-bold ml-1">%</span>
                                    </div>
                                </div>
                                <span className="font-mono font-bold text-sm text-gray-900">₹{gstAmount.toFixed(2)}</span>
                            </div>

                            {/* Shipping */}
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-gray-600">Shipping / Transport</span>
                                <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1 border border-gray-200 focus-within:border-indigo-400 focus-within:bg-white transition-all">
                                    <span className="text-xs text-gray-400 font-semibold">₹</span>
                                    <input
                                        type="number"
                                        value={shipping || ''}
                                        onChange={e => setShipping(parseFloat(e.target.value) || 0)}
                                        className="w-20 bg-transparent text-right text-xs font-bold text-gray-900 focus:outline-hidden"
                                        placeholder="0"
                                        min="0"
                                    />
                                </div>
                            </div>

                            {/* Other Charges */}
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-gray-600">Other Charges</span>
                                <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1 border border-gray-200 focus-within:border-indigo-400 focus-within:bg-white transition-all">
                                    <span className="text-xs text-gray-400 font-semibold">₹</span>
                                    <input
                                        type="number"
                                        value={other || ''}
                                        onChange={e => setOther(parseFloat(e.target.value) || 0)}
                                        className="w-20 bg-transparent text-right text-xs font-bold text-gray-900 focus:outline-hidden"
                                        placeholder="0"
                                        min="0"
                                    />
                                </div>
                            </div>

                            {/* Total Challan Value */}
                            <div className="mt-2 p-3.5 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 flex items-center justify-between">
                                <div>
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 block">Total Challan Value</span>
                                    <span className="text-[10px] text-indigo-500 font-medium">Grand Total</span>
                                </div>
                                <span className="font-mono text-xl font-black text-indigo-950">₹{total.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Mobile View (< lg): Spacious, Touch-Friendly Summary Card */}
                    <div className="lg:hidden w-full bg-white p-4 rounded-2xl border border-gray-200/90 shadow-xs space-y-3">
                        {/* Header + Total Value in Highlight Banner */}
                        <div className="p-3.5 bg-gradient-to-r from-indigo-50/80 via-blue-50/80 to-indigo-50/80 rounded-xl border border-indigo-100 flex items-center justify-between">
                            <div>
                                <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 block">Total Challan Value</span>
                                <span className="text-[11px] text-indigo-600 font-medium">All taxes &amp; charges included</span>
                            </div>
                            <span className="font-mono text-xl font-black text-indigo-950">₹{total.toFixed(2)}</span>
                        </div>

                        {/* Subtotal & GST Rows */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                                <span className="text-xs font-bold text-gray-700">Subtotal</span>
                                <span className="font-mono font-bold text-sm text-gray-900">₹{subtotal.toFixed(2)}</span>
                            </div>

                            <div className="flex items-center justify-between bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-700">GST Rate</span>
                                    <div className="flex items-center bg-white border border-gray-300 rounded-lg px-2 py-1 shadow-2xs">
                                        <input
                                            type="number"
                                            value={gstRate || ''}
                                            onChange={e => setGstRate(parseFloat(e.target.value) || 0)}
                                            className="w-12 text-center text-xs font-bold text-gray-900 focus:outline-hidden"
                                            placeholder="5"
                                            min="0"
                                            step="0.5"
                                        />
                                        <span className="text-xs text-gray-500 font-bold ml-1">%</span>
                                    </div>
                                </div>
                                <span className="font-mono font-bold text-sm text-gray-900">₹{gstAmount.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* 2-Column Grid (Shipping & Other Charges) */}
                        <div className="grid grid-cols-2 gap-2.5">
                            <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 space-y-1">
                                <span className="text-xs font-bold text-gray-700 block">Shipping</span>
                                <div className="flex items-center bg-white border border-gray-300 rounded-lg px-2 py-1 shadow-2xs">
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
                            <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 space-y-1">
                                <span className="text-xs font-bold text-gray-700 block">Other Charges</span>
                                <div className="flex items-center bg-white border border-gray-300 rounded-lg px-2 py-1 shadow-2xs">
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
                    </div>
                </CardFooter>
            </Card>

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
