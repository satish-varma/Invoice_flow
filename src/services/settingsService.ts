
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

export interface BillToContact {
    id: string;
    displayName: string;
    name: string;
    address: string;
    gst: string;
}

export interface ShipToContact {
    id: string;
    displayName: string;
    name: string;
    address: string;
    gst: string;
    taxes?: string[]; // Array of tax IDs like 'SGST9', 'CGST9'
}

export interface CompanyProfile {
    id: string;
    profileName: string; // e.g., "Main Company", "Side Business"
    companyName: string;
    companyAddress: string;
    companyGstin: string;
    companyPan: string;
    companyPhone: string;
    companyEmail: string;
    invoicePrefix: string;
    bankBeneficiary: string;
    bankName: string;
    bankAccount: string;
    bankIfsc: string;
    bankBranch: string;
    stampLogoUrl: string;
    logoUrl: string;
}


export interface Settings {
    companyProfiles?: CompanyProfile[];
    defaultCompanyProfile?: string; // ID of the default profile
    billToContacts?: BillToContact[];
    shipToContacts?: ShipToContact[];
    defaultBillToContact?: string; // Storing ID of the default contact
    defaultShipToContact?: string; // Storing ID of the default contact
    currency?: string; // e.g., "INR", "USD"
    currencySymbol?: string; // e.g., "₹", "$"
    pdfTemplate?: string; // e.g., "classic", "modern", "minimal"
    primaryColor?: string; // Hex color
}

const SETTINGS_COLLECTION = 'settings';
const SINGLETON_DOC_ID = 'invoiceDefaults';

export async function getSettings(): Promise<Settings> {
    try {
        console.log("Fetching settings from Firestore...");
        const docRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        const docSnap = await getDoc(docRef);

        const defaultSettings: Settings = {
            companyProfiles: [],
            billToContacts: [],
            shipToContacts: [],
        };

        let result: Settings;

        if (docSnap.exists()) {
            const data = docSnap.data();
            // Ensure arrays exist to prevent downstream errors and explicitly pick fields
            result = {
                companyProfiles: (data.companyProfiles || []).map((p: any) => ({
                    id: p.id || "",
                    profileName: p.profileName || "",
                    companyName: p.companyName || "",
                    companyAddress: p.companyAddress || "",
                    companyGstin: p.companyGstin || "",
                    companyPan: p.companyPan || "",
                    companyPhone: p.companyPhone || "",
                    companyEmail: p.companyEmail || "",
                    invoicePrefix: p.invoicePrefix || "",
                    bankBeneficiary: p.bankBeneficiary || "",
                    bankName: p.bankName || "",
                    bankAccount: p.bankAccount || "",
                    bankIfsc: p.bankIfsc || "",
                    bankBranch: p.bankBranch || "",
                    stampLogoUrl: p.stampLogoUrl || "",
                    logoUrl: p.logoUrl || "",
                })),
                defaultCompanyProfile: data.defaultCompanyProfile || "",
                billToContacts: (data.billToContacts || []).map((c: any) => ({
                    id: c.id || "",
                    displayName: c.displayName || "",
                    name: c.name || "",
                    address: c.address || "",
                    gst: c.gst || "",
                })),
                shipToContacts: (data.shipToContacts || []).map((c: any) => ({
                    id: c.id || "",
                    displayName: c.displayName || "",
                    name: c.name || "",
                    address: c.address || "",
                    gst: c.gst || "",
                    taxes: c.taxes || [],
                })),
                defaultBillToContact: data.defaultBillToContact || "",
                defaultShipToContact: data.defaultShipToContact || "",
                currency: data.currency || "INR",
                currencySymbol: data.currencySymbol || "₹",
                pdfTemplate: data.pdfTemplate || "classic",
                primaryColor: data.primaryColor || "#3b82f6", // Default blue-500
            };
        } else {
            // The document doesn't exist. Instead of writing here, we return a default object.
            // The component that calls this function will handle the creation if necessary.
            console.log("Settings document not found, returning default settings.");
            result = defaultSettings;
        }

        // Ensure deep serialization to avoid any hidden non-serializable objects
        return JSON.parse(JSON.stringify(result));

    } catch (error) {
        console.error("Error fetching settings: ", error);
        // Return a safe default object in case of any error instead of throwing
        // This ensures the client always gets a valid response structure
        return {
            companyProfiles: [],
            billToContacts: [],
            shipToContacts: []
        };
    }
}

export async function saveCompanyProfile(profile: Omit<CompanyProfile, 'id'>): Promise<string> {
    const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
    const settings = await getSettings();
    const profiles = settings.companyProfiles || [];

    if (profiles.some(p => p.profileName === profile.profileName)) {
        throw new Error("A company profile with this name already exists.");
    }

    const newProfile: CompanyProfile = {
        ...profile,
        id: `${Date.now()}-${Math.random()}`,
    };

    const updatedProfiles = [...profiles, newProfile];
    await setDoc(settingsRef, { companyProfiles: updatedProfiles }, { merge: true });

    // If this is the first profile, make it the default
    if (updatedProfiles.length === 1) {
        await setDefaultCompanyProfile(newProfile.id);
    }

    return newProfile.id;
}


export async function updateCompanyProfile(profile: CompanyProfile): Promise<void> {
    const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
    const settings = await getSettings();
    const profiles = settings.companyProfiles || [];

    const otherProfiles = profiles.filter(p => p.id !== profile.id);
    if (otherProfiles.some(p => p.profileName === profile.profileName)) {
        throw new Error("A company profile with this name already exists.");
    }

    const updatedProfiles = profiles.map(p => p.id === profile.id ? profile : p);
    await updateDoc(settingsRef, { companyProfiles: updatedProfiles });
}

export async function deleteCompanyProfile(id: string): Promise<void> {
    const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
    const settings = await getSettings();
    const profiles = settings.companyProfiles || [];

    const updatedProfiles = profiles.filter(p => p.id !== id);

    const updatePayload: { companyProfiles: CompanyProfile[]; defaultCompanyProfile?: string } = {
        companyProfiles: updatedProfiles
    };

    // If the deleted profile was the default, unset it
    if (settings.defaultCompanyProfile === id) {
        updatePayload.defaultCompanyProfile = updatedProfiles.length > 0 ? updatedProfiles[0].id : '';
    }

    await updateDoc(settingsRef, updatePayload);
}

export async function setDefaultCompanyProfile(id: string): Promise<void> {
    const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
    await updateDoc(settingsRef, { defaultCompanyProfile: id });
}


// CONTACT MANAGEMENT
function contactExists(contacts: any[] | undefined, displayName: string): Promise<boolean> {
    if (!contacts) return Promise.resolve(false);
    return Promise.resolve(contacts.some(contact => contact.displayName === displayName));
}

export async function saveBillToContact(contact: Omit<BillToContact, 'id'>): Promise<void> {
    try {
        const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        const settings = await getSettings();

        if (await contactExists(settings.billToContacts, contact.displayName)) {
            throw new Error("A Bill To contact with this Display Name already exists.");
        }

        const newContact: BillToContact = {
            ...contact,
            id: `${Date.now()}-${Math.random()}`, // Assign a more unique ID
        };

        const updatedContacts = [...(settings.billToContacts || []), newContact];
        await setDoc(settingsRef, { ...settings, billToContacts: updatedContacts }, { merge: true });

    } catch (error) {
        console.error("Error saving Bill To contact: ", error);
        if (error instanceof Error && error.message.includes("already exists")) {
            throw error;
        }
        throw new Error("Failed to save Bill To contact.");
    }
}

export async function saveShipToContact(contact: Omit<ShipToContact, 'id'>): Promise<void> {
    try {
        const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        const settings = await getSettings();

        if (await contactExists(settings.shipToContacts, contact.displayName)) {
            throw new Error("A Ship To contact with this Display Name already exists.");
        }

        const newContact: ShipToContact = {
            ...contact,
            id: `${Date.now()}-${Math.random()}`, // Assign a more unique ID
        };

        const updatedContacts = [...(settings.shipToContacts || []), newContact];
        await setDoc(settingsRef, { ...settings, shipToContacts: updatedContacts }, { merge: true });

    } catch (error) {
        console.error("Error saving Ship To contact: ", error);
        if (error instanceof Error && error.message.includes("already exists")) {
            throw error;
        }
        throw new Error("Failed to save Ship To contact.");
    }
}


export async function deleteBillToContact(id: string): Promise<void> {
    try {
        const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        const settings = await getSettings();
        if (!settings || !settings.billToContacts) {
            throw new Error("Settings or contacts not found");
        }

        const updatedContacts = settings.billToContacts.filter(c => c.id !== id);

        await updateDoc(settingsRef, { billToContacts: updatedContacts });

    } catch (error) {
        console.error("Error deleting Bill To contact: ", error);
        throw new Error("Failed to delete Bill To contact.");
    }
}

export async function deleteShipToContact(id: string): Promise<void> {
    try {
        const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        const settings = await getSettings();
        if (!settings || !settings.shipToContacts) {
            throw new Error("Settings or contacts not found");
        }

        const updatedContacts = settings.shipToContacts.filter(c => c.id !== id);

        await updateDoc(settingsRef, { shipToContacts: updatedContacts });

    } catch (error) {
        console.error("Error deleting Ship To contact: ", error);
        throw new Error("Failed to delete Ship To contact.");
    }
}

export async function updateBillToContact(contact: BillToContact): Promise<void> {
    try {
        const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        const settings = await getSettings();
        if (!settings || !settings.billToContacts) {
            throw new Error("Settings or contacts not found");
        }

        // Check for duplicate display name, excluding the current contact being edited
        const otherContacts = settings.billToContacts.filter(c => c.id !== contact.id);
        if (await contactExists(otherContacts, contact.displayName)) {
            throw new Error("A Bill To contact with this Display Name already exists.");
        }

        const updatedContacts = settings.billToContacts.map(c =>
            c.id === contact.id ? contact : c
        );
        await updateDoc(settingsRef, { billToContacts: updatedContacts });
    } catch (error) {
        console.error("Error updating Bill To contact: ", error);
        if (error instanceof Error && error.message.includes("already exists")) {
            throw error;
        }
        throw new Error("Failed to update Bill To contact.");
    }
}

export async function updateShipToContact(contact: ShipToContact): Promise<void> {
    try {
        const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        const settings = await getSettings();
        if (!settings || !settings.shipToContacts) {
            throw new Error("Settings or contacts not found");
        }

        const otherContacts = settings.shipToContacts.filter(c => c.id !== contact.id);
        if (await contactExists(otherContacts, contact.displayName)) {
            throw new Error("A Ship To contact with this Display Name already exists.");
        }

        const updatedContacts = settings.shipToContacts.map(c =>
            c.id === contact.id ? contact : c
        );
        await updateDoc(settingsRef, { shipToContacts: updatedContacts });
    } catch (error) {
        console.error("Error updating Ship To contact: ", error);
        if (error instanceof Error && error.message.includes("already exists")) {
            throw error;
        }
        throw new Error("Failed to update Ship To contact.");
    }
}

export async function setDefaultBillToContact(id: string): Promise<void> {
    if (!id) {
        throw new Error("Cannot set default with an empty ID.");
    }
    try {
        const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        await setDoc(settingsRef, { defaultBillToContact: id }, { merge: true });
    } catch (error) {
        console.error("Error setting default Bill To contact: ", error);
        throw new Error(`Failed to set default Bill To contact: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function setDefaultShipToContact(id: string): Promise<void> {
    if (!id) {
        throw new Error("Cannot set default with an empty ID.");
    }
    try {
        const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        await setDoc(settingsRef, { defaultShipToContact: id }, { merge: true });
    } catch (error) {
        console.error("Error setting default Ship To contact: ", error);
        throw new Error(`Failed to set default Ship To contact: ${error instanceof Error ? error.message : String(error)}`);
    }
}




export async function saveGeneralSettings(updates: Partial<Settings>): Promise<void> {
    try {
        const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        await setDoc(settingsRef, updates, { merge: true });
    } catch (error) {
        console.error("Error saving general settings: ", error);
        throw new Error("Failed to save settings.");
    }
}
