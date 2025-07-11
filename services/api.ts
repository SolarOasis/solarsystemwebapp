import { AnyComponent, Supplier, Project, ClientInfo, CostAnalysis, ProjectComponent, ComponentType } from '../types';

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

// Helper to stringify nested objects in a project before sending to the backend.
const stringifyProjectNestedObjects = (project: any) => {
    const toSend = {...project};
    if (typeof toSend.client === 'object' && toSend.client !== null) {
        toSend.client = JSON.stringify(toSend.client);
    }
    if (typeof toSend.costAnalysis === 'object' && toSend.costAnalysis !== null) {
        toSend.costAnalysis = JSON.stringify(toSend.costAnalysis);
    }
    if (Array.isArray(toSend.components)) {
        toSend.components = JSON.stringify(toSend.components);
    }
    if (typeof toSend.timeline === 'object' && toSend.timeline !== null) {
        toSend.timeline = JSON.stringify(toSend.timeline);
    }
    return toSend;
};

// Helper to stringify nested objects in a supplier before sending to the backend.
const stringifySupplierNestedObjects = (supplier: Partial<Supplier>) => {
    const toSend: any = {...supplier};
    if (Array.isArray(toSend.specialization)) {
        toSend.specialization = JSON.stringify(toSend.specialization);
    }
    return toSend;
};

/**
 * Safely parses a value that might be a JSON string.
 * If it's not a string, it's returned as is.
 * If parsing fails, it returns a provided default value.
 * @param value The value to parse (string | any)
 * @param defaultValue The value to return on parsing failure.
 * @returns The parsed object, the original value, or the default value.
 */
const safelyParseJSON = <T>(value: any, defaultValue: T): T => {
    if (typeof value === 'string') {
        if (value.trim().startsWith('[') || value.trim().startsWith('{')) {
            try {
                return JSON.parse(value);
            } catch (e) {
                console.error('Failed to parse JSON string:', value, e);
                return defaultValue;
            }
        }
        // Handles empty string or other non-JSON strings by returning the default.
        return defaultValue;
    }
    
    // For non-string types, only return the value if it's not nullish and has a compatible type.
    if (value !== null && value !== undefined) {
        if (Array.isArray(defaultValue) && Array.isArray(value)) {
            return value as T;
        }
        if (typeof defaultValue === 'object' && !Array.isArray(defaultValue) && defaultValue !== null &&
            typeof value === 'object' && !Array.isArray(value) && value !== null) {
            return value as T;
        }
    }
    
    return defaultValue;
};


// Helper to parse nested objects in a supplier after receiving from the backend.
const parseSupplierNestedObjects = (supplier: any): Supplier => {
    if (!supplier) return supplier;
    return { 
        ...supplier, 
        specialization: safelyParseJSON(supplier.specialization, [])
    };
};


// Helper to parse nested objects in a project after receiving from the backend.
const parseProjectNestedObjects = (project: any): Project => {
    if (!project) return project;

    const defaultCostAnalysis: CostAnalysis = {
        componentCosts: [], totalMaterialCost: 0, totalProjectCost: 0, finalSellingPrice: 0,
        profitMargin: 0, profitMarginPercentage: 0, costPerKw: 0, markupAmount: 0,
    };
    
    return { 
        ...project, 
        client: safelyParseJSON(project.client, { name: 'Error: Invalid data', contact: '', address: '' }),
        costAnalysis: safelyParseJSON(project.costAnalysis, defaultCostAnalysis),
        components: safelyParseJSON(project.components, []),
        timeline: safelyParseJSON(project.timeline, { startDate: '', endDate: '' })
    };
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
        
        if (data.projects && Array.isArray(data.projects)) {
            data.projects = data.projects.map(parseProjectNestedObjects);
        }

        if (data.suppliers && Array.isArray(data.suppliers)) {
            data.suppliers = data.suppliers.map(parseSupplierNestedObjects);
        }
        
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
export const addSupplier = async (supplier: Omit<Supplier, 'id'>): Promise<Supplier> => {
    const result = await postAction('addSupplier', stringifySupplierNestedObjects(supplier));
    return parseSupplierNestedObjects(result);
};
export const updateSupplier = async (supplier: Supplier): Promise<Supplier> => {
    const result = await postAction('updateSupplier', stringifySupplierNestedObjects(supplier));
    return parseSupplierNestedObjects(result);
};
export const deleteSupplier = (id: string) => postAction('deleteSupplier', { id });

// Project actions
export const addProject = async (project: Omit<Project, 'id'>) => {
    const result = await postAction('addProject', stringifyProjectNestedObjects(project));
    return parseProjectNestedObjects(result);
};
export const updateProject = async (project: Project) => {
    const result = await postAction('updateProject', stringifyProjectNestedObjects(project));
    return parseProjectNestedObjects(result);
};
export const deleteProject = (id: string) => postAction('deleteProject', { id });
export const duplicateProject = async (id: string) => {
    const result = await postAction('duplicateProject', { id });
    return parseProjectNestedObjects(result);
};

// New PDF action
export const savePdfToDrive = (fileName: string, folderName: string, base64Data: string) => {
    return postAction('savePdf', { fileName, folderName, base64Data });
};