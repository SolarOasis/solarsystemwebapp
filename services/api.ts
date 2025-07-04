
import { AnyComponent, Supplier, Project, ClientInfo, CostAnalysis, ProjectComponent } from '../types';

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

// --- Robust parsing helpers for un-flattening data ---

// Parses a value into a number, defaulting to 0 for invalid/empty inputs.
const parseRequiredNumber = (val: any): number => {
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
};

// Parses a value into a number, returning undefined for invalid/empty inputs.
const parseOptionalNumber = (val: any): number | undefined => {
    if (val === null || val === undefined || val === '') return undefined;
    const num = parseFloat(val);
    return isNaN(num) ? undefined : num;
};

// Parses a JSON string, returning a default value (e.g., empty array) on failure.
const parseJsonField = <T>(val: any, defaultVal: T): T => {
    if (typeof val !== 'string' || !val) return defaultVal;
    try {
        return JSON.parse(val);
    } catch (e) {
        console.error('Failed to parse JSON field:', val, e);
        return defaultVal;
    }
};

// Helper to un-flatten a project object received from the API.
const unflattenProjectFromApi = (flatProject: any): Project => {
    const p = flatProject; // alias for brevity

    const project: Project = {
        id: p.id || '',
        name: p.name || '',
        location: p.location || '',
        systemCapacity: parseRequiredNumber(p.systemCapacity),
        status: p.status || 'Planning',
        siteSurveyNotes: p.siteSurveyNotes || '',
        
        client: {
            name: p.clientName || '',
            contact: p.clientContact || '',
            address: p.clientAddress || '',
        },

        timeline: {
            startDate: p.timelineStartDate || '',
            endDate: p.timelineEndDate || '',
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
            markupAmount: parseRequiredNumber(p.costAnalysis_markupAmount), // Deprecated, but handled
            
            // Optional fields
            installationCharges: parseOptionalNumber(p.costAnalysis_installationCharges),
            commissioningCharges: parseOptionalNumber(p.costAnalysis_commissioningCharges),
            electricalCost: parseOptionalNumber(p.costAnalysis_electricalCost),
            installationSellingPrice: parseOptionalNumber(p.costAnalysis_installationSellingPrice),
            commissioningSellingPrice: parseOptionalNumber(p.costAnalysis_commissioningSellingPrice),
            electricalSellingPrice: parseOptionalNumber(p.costAnalysis_electricalSellingPrice),
            markupPercentage: parseOptionalNumber(p.costAnalysis_markupPercentage),
        }
    };

    return project;
};


export const fetchAllData = async (): Promise<{ components: AnyComponent[], suppliers: Supplier[], projects: Project[] }> => {
    const url = getApiUrl();
     if (!url) {
        throw new Error("Application is not configured by the administrator.");
    }

    try {
        // For GET requests, we can append parameters to the URL
        const getUrl = `${url}?action=getData`;
        const response = await fetch(getUrl, {
            method: 'GET',
            mode: 'cors',
            redirect: 'follow',
        });
        
        if (!response.ok) {
           throw new Error(`Network response was not ok, status: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.error) {
            throw new Error(`Google Script Error: ${data.error}`);
        }

        // Defensively process supplier specialization to prevent crashes from bad data in the sheet.
        if (data.suppliers && Array.isArray(data.suppliers)) {
            data.suppliers.forEach((s: any) => {
                // The sheet can return strings, numbers, or other types instead of an array.
                if (!Array.isArray(s.specialization)) {
                    if (s.specialization && typeof s.specialization.toString === 'function') {
                        // Convert to string, split by comma, and trim whitespace from each item.
                        s.specialization = s.specialization.toString().split(',').map((item: string) => item.trim()).filter(Boolean);
                    } else {
                        // If it's something invalid (null, undefined), default to an empty array.
                        s.specialization = [];
                    }
                }
            });
        }
        
        if (data.projects && Array.isArray(data.projects)) {
            data.projects = data.projects.map(unflattenProjectFromApi);
        } else {
            data.projects = [];
        }
        
        if (!data.components) data.components = [];
        if (!data.suppliers) data.suppliers = [];

        return data;
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
export const addProject = async (project: Omit<Project, 'id'>) => {
    const result = await postAction('addProject', flattenProjectForApi(project));
    return unflattenProjectFromApi(result);
};
export const updateProject = async (project: Project) => {
    const result = await postAction('updateProject', flattenProjectForApi(project));
    return unflattenProjectFromApi(result);
};
export const deleteProject = (id: string) => postAction('deleteProject', { id });
export const duplicateProject = async (id: string) => {
    const result = await postAction('duplicateProject', { id });
    return unflattenProjectFromApi(result);
};

// New PDF action
export const savePdfToDrive = (fileName: string, folderName: string, base64Data: string) => {
    return postAction('savePdf', { fileName, folderName, base64Data });
};
