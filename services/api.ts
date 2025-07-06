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

// Helper to parse nested objects in a project after receiving from the backend.
const parseProjectNestedObjects = (project: any): Project => {
    if (!project) return project;

    let client: ClientInfo = project.client;
    if (typeof client === 'string') {
        try {
            client = JSON.parse(client);
        } catch (e) {
            console.error('Failed to parse project.client:', client, e);
            client = { name: 'Error: Invalid data', contact: '', address: '' };
        }
    }

    let costAnalysis: CostAnalysis = project.costAnalysis;
    if (typeof costAnalysis === 'string') {
        try {
            costAnalysis = JSON.parse(costAnalysis);
        } catch (e) {
            console.error('Failed to parse project.costAnalysis:', costAnalysis, e);
            // Provide a default structure to prevent UI crashes
            costAnalysis = {
                componentCosts: [], totalMaterialCost: 0, totalProjectCost: 0, finalSellingPrice: 0,
                profitMargin: 0, profitMarginPercentage: 0, costPerKw: 0, markupAmount: 0,
            };
        }
    }
    
    let components: ProjectComponent[] = project.components;
    if (typeof components === 'string') {
        try {
            components = JSON.parse(components);
        } catch (e) {
            console.error('Failed to parse project.components:', components, e);
            components = [];
        }
    }

    let timeline: { startDate: string; endDate: string; } = project.timeline;
    if (typeof timeline === 'string') {
        try {
            timeline = JSON.parse(timeline);
        } catch (e) {
            console.error('Failed to parse project.timeline:', timeline, e);
            timeline = { startDate: '', endDate: '' };
        }
    }

    return { ...project, client, costAnalysis, components, timeline };
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