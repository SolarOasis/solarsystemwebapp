
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

// Helper to un-flatten a project object received from the API.
const unflattenProjectFromApi = (flatProject: any): Project => {
    const project: any = { ...flatProject };

    // Un-flatten client
    project.client = {
        name: project.clientName || '',
        contact: project.clientContact || '',
        address: project.clientAddress || '',
    };
    delete project.clientName;
    delete project.clientContact;
    delete project.clientAddress;

    // Un-flatten timeline
    project.timeline = {
        startDate: project.timelineStartDate || '',
        endDate: project.timelineEndDate || '',
    };
    delete project.timelineStartDate;
    delete project.timelineEndDate;

    // Un-flatten costAnalysis
    const newCostAnalysis: Partial<CostAnalysis> = {};
    for (const key in project) {
        if (key.startsWith('costAnalysis_')) {
            const originalKey = key.substring('costAnalysis_'.length);
            let value = project[key];
            
            // Parse componentCosts back into an array
            if (originalKey === 'componentCosts' && typeof value === 'string' && value) {
                try {
                    value = JSON.parse(value);
                } catch (e) {
                    console.error('Failed to parse costAnalysis.componentCosts', value, e);
                    value = [];
                }
            } else if (originalKey !== 'componentCosts' && typeof value === 'string' && value !== '' && !isNaN(Number(value))) {
                // For other cost fields, convert numeric strings to numbers
                value = Number(value);
            }
            
            (newCostAnalysis as any)[originalKey] = value;
            delete project[key];
        }
    }
    
    const costAnalysisDefaults: CostAnalysis = {
        componentCosts: [], totalMaterialCost: 0, totalProjectCost: 0, finalSellingPrice: 0,
        profitMargin: 0, profitMarginPercentage: 0, costPerKw: 0, markupAmount: 0,
    };
    project.costAnalysis = { ...costAnalysisDefaults, ...newCostAnalysis };

    // Parse components string
    if (typeof project.components === 'string' && project.components) {
        try {
            project.components = JSON.parse(project.components);
        } catch (e) {
            console.error('Failed to parse project.components:', project.components, e);
            project.components = [];
        }
    } else if (!project.components) {
        project.components = [];
    }

    return project as Project;
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
            data.projects = data.projects.map(unflattenProjectFromApi);
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
