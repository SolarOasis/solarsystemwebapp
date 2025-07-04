
import { AnyComponent, Supplier, Project, ProjectComponent, ComponentType, ComponentTypes } from '../types';

const getApiUrl = (): string | null => {
    // Use the Vite environment variable prefix.
    const url = (import.meta as any).env.VITE_GOOGLE_APPS_SCRIPT_URL;
    if (url && url.startsWith('https://script.google.com/macros/s/')) {
        return url;
    }
    return null;
};

// A single function to perform a POST request to the Google Apps Script.
const postAction = async (action: string, payload: any): Promise<any> => {
    const url = getApiUrl();
    if (!url) {
        throw new Error("Application is not configured by the administrator.");
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            mode: 'cors',
            redirect: 'follow', // Important for Google Scripts
            body: JSON.stringify({ action, payload }),
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
        });

        if (!response.ok) {
            throw new Error(`Network response was not ok, status: ${response.status}`);
        }

        const result = await response.json();
        if (result.error) {
            throw new Error(`Google Script Error: ${result.error}`);
        }
        return result;
    } catch (error) {
        console.error('Error in postAction:', error);
        throw error; // Re-throw the error to be caught by the calling function in AppContext
    }
};

// Helper to flatten a project object for sending to the API.
const flattenProjectForApi = (project: Project | Omit<Project, 'id'>): any => {
    const flatProject: any = { ...project };

    // Flatten client
    if (flatProject.client) {
        flatProject.clientName = flatProject.client.name;
        flatProject.clientContact = flatProject.client.contact;
        flatProject.clientAddress = flatProject.client.address;
        delete flatProject.client;
    }

    // Flatten timeline
    if (flatProject.timeline) {
        flatProject.timelineStartDate = flatProject.timeline.startDate;
        flatProject.timelineEndDate = flatProject.timeline.endDate;
        delete flatProject.timeline;
    }

    // Flatten costAnalysis
    if (flatProject.costAnalysis) {
        const costAnalysisCopy = { ...flatProject.costAnalysis };
        // Stringify nested arrays inside costAnalysis to store them in a single cell
        if (Array.isArray(costAnalysisCopy.componentCosts)) {
            costAnalysisCopy.componentCosts = JSON.stringify(costAnalysisCopy.componentCosts);
        }

        for (const [key, value] of Object.entries(costAnalysisCopy)) {
            flatProject[`costAnalysis_${key}`] = value;
        }
        delete flatProject.costAnalysis;
    }
    
    // Stringify components array
    if (Array.isArray(flatProject.components)) {
        flatProject.components = JSON.stringify(flatProject.components);
    }

    return flatProject;
};

// --- Robust parsing helpers for un-flattening and cleaning data ---

const parseRequiredNumber = (val: any): number => {
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
};

const parseOptionalNumber = (val: any): number | undefined => {
    if (val === null || val === undefined || val === '') return undefined;
    const num = parseFloat(val);
    return isNaN(num) ? undefined : num;
};

const parseJsonField = <T>(val: any, defaultVal: T): T => {
    if (typeof val !== 'string' || !val) return defaultVal;
    try {
        return JSON.parse(val);
    } catch (e) {
        console.error('Failed to parse JSON field:', val, e);
        return defaultVal;
    }
};

// --- Resilient, Type-safe Parsers for Data from Google Sheets ---

const parseComponentFromApi = (c: any): AnyComponent | null => {
    if (!c || !c.id || !c.type || !Object.values(ComponentTypes).includes(c.type as any)) {
        console.warn('Skipping component with invalid/missing id or type:', c);
        return null;
    }

    const base = {
        id: String(c.id),
        type: c.type as ComponentType,
        manufacturer: String(c.manufacturer || 'N/A'),
        model: String(c.model || 'N/A'),
        supplierId: String(c.supplierId || ''),
        cost: parseOptionalNumber(c.cost),
    };

    switch (base.type) {
        case ComponentTypes.SolarPanel:
            return { ...base, wattage: parseOptionalNumber(c.wattage), efficiency: parseOptionalNumber(c.efficiency), warranty: parseOptionalNumber(c.warranty), technology: c.technology || undefined };
        case ComponentTypes.Inverter:
            return { ...base, capacity: parseOptionalNumber(c.capacity), inverterType: c.inverterType || undefined, efficiency: parseOptionalNumber(c.efficiency), mpptChannels: parseOptionalNumber(c.mpptChannels) };
        case ComponentTypes.Battery:
            return { ...base, capacity: parseOptionalNumber(c.capacity), batteryType: c.batteryType || undefined, warranty: parseOptionalNumber(c.warranty), depthOfDischarge: parseOptionalNumber(c.depthOfDischarge) };
        case ComponentTypes.MountingSystem:
            return { ...base, mountingType: c.mountingType || undefined, material: c.material || undefined, loadCapacity: parseOptionalNumber(c.loadCapacity) };
        case ComponentTypes.Cable:
            return { ...base, cableType: c.cableType || undefined, crossSection: parseOptionalNumber(c.crossSection) };
        case ComponentTypes.MonitoringSystem:
            let features: string[] = [];
            if (c.features) {
                if (typeof c.features === 'string') {
                    features = c.features.split(',').map((item: string) => item.trim()).filter(Boolean);
                } else if (Array.isArray(c.features)) {
                    features = c.features;
                }
            }
            return { ...base, features };
        case ComponentTypes.ElectricCharger:
            return { ...base, chargingSpeed: parseOptionalNumber(c.chargingSpeed), connectorType: c.connectorType || undefined };
        default:
            return null;
    }
};

const parseSupplierFromApi = (s: any): Supplier | null => {
    if (!s || !s.id) {
        console.warn(`Skipping invalid supplier row (missing id):`, s);
        return null;
    }
    
    let specialization: ComponentType[] = [];
    if (s.specialization) {
        if (!Array.isArray(s.specialization)) {
            specialization = String(s.specialization).split(',').map((item: string) => item.trim()).filter(Boolean) as ComponentType[];
        } else {
            specialization = s.specialization;
        }
    }
    
    return {
        id: String(s.id),
        name: String(s.name || `Unnamed Supplier`),
        contactPerson: String(s.contactPerson || ''),
        phone: String(s.phone || ''),
        email: String(s.email || ''),
        address: String(s.address || ''),
        specialization,
    };
};

const unflattenProjectFromApi = (p: any): Project | null => {
    if (!p || !p.id) {
        console.warn(`Skipping invalid project row (missing id):`, p);
        return null;
    }
    return {
        id: String(p.id),
        name: String(p.name || `Project ${p.id.slice(0, 6).toUpperCase()}`),
        location: String(p.location || ''),
        systemCapacity: parseRequiredNumber(p.systemCapacity),
        status: (p.status || 'Planning') as Project['status'],
        siteSurveyNotes: String(p.siteSurveyNotes || ''),
        client: { 
            name: String(p.clientName || 'Unnamed Client'), 
            contact: String(p.clientContact || ''), 
            address: String(p.clientAddress || '') 
        },
        timeline: { 
            startDate: String(p.timelineStartDate || ''), 
            endDate: String(p.timelineEndDate || '') 
        },
        components: parseJsonField<ProjectComponent[]>(p.components, []),
        costAnalysis: {
            componentCosts: parseJsonField(p.costAnalysis_componentCosts, []),
            totalMaterialCost: parseRequiredNumber(p.costAnalysis_totalMaterialCost),
            totalProjectCost: parseRequiredNumber(p.costAnalysis_totalProjectCost),
            finalSellingPrice: parseRequiredNumber(p.costAnalysis_finalSellingPrice),
            profitMargin: parseRequiredNumber(p.costAnalysis_profitMargin),
            profitMarginPercentage: parseRequiredNumber(p.costAnalysis_profitMarginPercentage),
            costPerKw: parseRequiredNumber(p.costAnalysis_costPerKw),
            markupAmount: parseRequiredNumber(p.costAnalysis_markupAmount),
            installationCharges: parseOptionalNumber(p.costAnalysis_installationCharges),
            commissioningCharges: parseOptionalNumber(p.costAnalysis_commissioningCharges),
            electricalCost: parseOptionalNumber(p.costAnalysis_electricalCost),
            installationSellingPrice: parseOptionalNumber(p.costAnalysis_installationSellingPrice),
            commissioningSellingPrice: parseOptionalNumber(p.costAnalysis_commissioningSellingPrice),
            electricalSellingPrice: parseOptionalNumber(p.costAnalysis_electricalSellingPrice),
            markupPercentage: parseOptionalNumber(p.costAnalysis_markupPercentage),
        }
    };
};

// Generic, resilient reducer function for processing items from the sheets
const processSheetData = <T>(items: any[], parser: (item: any) => T | null, sheetName: string): T[] => {
    if (!items || !Array.isArray(items)) {
        return [];
    }
    
    return items
        .map((item, index) => {
            try {
                if (item && typeof item === 'object' && Object.keys(item).length > 0) {
                    return parser(item);
                }
                return null;
            } catch (error) {
                console.error(`Critical error parsing row at index ${index + 2} in '${sheetName}' sheet.`, { error, item });
                return null; // Ensure loop continues
            }
        })
        .filter((item): item is T => item !== null);
}


export const fetchAllData = async (): Promise<{ components: AnyComponent[], suppliers: Supplier[], projects: Project[] }> => {
    const url = getApiUrl();
     if (!url) {
        throw new Error("Application is not configured by the administrator.");
    }

    try {
        const getUrl = `${url}?action=getData`;
        const response = await fetch(getUrl, { method: 'GET', mode: 'cors', redirect: 'follow' });
        
        if (!response.ok) throw new Error(`Network response was not ok, status: ${response.status}`);
        
        const data = await response.json();
        if (data.error) throw new Error(`Google Script Error: ${data.error}`);

        return {
            components: processSheetData(data.components, parseComponentFromApi, "Components (various sheets)"),
            suppliers: processSheetData(data.suppliers, parseSupplierFromApi, "Suppliers"),
            projects: processSheetData(data.projects, unflattenProjectFromApi, "Projects")
        };

    } catch (error) {
        console.error('Error in fetchAllData:', error);
        throw error;
    }
};

// Component actions
export const addComponent = (component: Omit<AnyComponent, 'id'>) => postAction('addComponent', component);
export const updateComponent = (component: AnyComponent) => postAction('updateComponent', component);
export const deleteComponent = (component: {id: string, type: string}) => postAction('deleteComponent', component);

// Supplier actions
export const addSupplier = (supplier: Omit<Supplier, 'id'>) => postAction('addSupplier', supplier);
export const updateSupplier = (supplier: Supplier) => postAction('updateSupplier', supplier);
export const deleteSupplier = (id: string) => postAction('deleteSupplier', { id });

// Project actions
export const addProject = async (project: Omit<Project, 'id'>): Promise<Project | undefined> => {
    const result = await postAction('addProject', flattenProjectForApi(project));
    return unflattenProjectFromApi(result) ?? undefined;
};
export const updateProject = async (project: Project): Promise<Project | undefined> => {
    const result = await postAction('updateProject', flattenProjectForApi(project));
    return unflattenProjectFromApi(result) ?? undefined;
};
export const deleteProject = (id: string) => postAction('deleteProject', { id });
export const duplicateProject = async (id: string): Promise<Project | undefined> => {
    const result = await postAction('duplicateProject', { id });
    return unflattenProjectFromApi(result) ?? undefined;
};

// New PDF action
export const savePdfToDrive = (fileName: string, folderName: string, base64Data: string) => {
    return postAction('savePdf', { fileName, folderName, base64Data });
};
