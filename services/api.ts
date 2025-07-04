
import { AnyComponent, Supplier, Project } from '../types';

const getApiUrl = (): string | null => {
    const url = localStorage.getItem('googleAppsScriptUrl');
    // Basic validation for the URL
    if (url && url.startsWith('https://script.google.com/macros/s/')) {
        return url;
    }
    return null;
};

// A single function to perform a POST request to the Google Apps Script.
const postAction = async (action: string, payload: any): Promise<any> => {
    const url = getApiUrl();
    if (!url) {
        throw new Error("Google Apps Script URL is not configured. Please set it in the Settings page.");
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            mode: 'cors',
            redirect: 'follow', // Important for Google Scripts
            body: JSON.stringify({ action, payload }),
            // Apps Script doPost expects a specific content type for the e.postData.contents
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

export const fetchAllData = async (): Promise<{ components: AnyComponent[], suppliers: Supplier[], projects: Project[] }> => {
    const url = getApiUrl();
     if (!url) {
        throw new Error("Google Apps Script URL is not configured.");
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
        return data;
    } catch (error) {
        console.error('Error in fetchAllData:', error);
        throw error;
    }
};

// Component actions
export const addComponent = (component: Omit<AnyComponent, 'id'>) => postAction('addComponent', component);
export const updateComponent = (component: AnyComponent) => postAction('updateComponent', component);
export const deleteComponent = (id: string) => postAction('deleteComponent', { id });

// Supplier actions
export const addSupplier = (supplier: Omit<Supplier, 'id'>) => postAction('addSupplier', supplier);
export const updateSupplier = (supplier: Supplier) => postAction('updateSupplier', supplier);
export const deleteSupplier = (id: string) => postAction('deleteSupplier', { id });

// Project actions
export const addProject = (project: Omit<Project, 'id'>) => postAction('addProject', project);
export const updateProject = (project: Project) => postAction('updateProject', project);
export const deleteProject = (id: string) => postAction('deleteProject', { id });
