
import React, { createContext, useReducer, useCallback } from 'react';
import { AppState, AppAction, AnyComponent, Supplier, Project } from '../types';
import * as api from '../services/api';

const initialState: AppState = {
    loading: true,
    error: null,
    components: [],
    suppliers: [],
    projects: [],
};

const appReducer = (state: AppState, action: AppAction): AppState => {
    switch (action.type) {
        case 'SET_LOADING':
            return { ...state, loading: action.payload };
        case 'SET_ERROR':
            return { ...state, error: action.payload, loading: false };
        case 'SET_INITIAL_DATA':
            return { ...state, ...action.payload, loading: false, error: null };
        case 'ADD_COMPONENT':
            return { ...state, components: [...state.components, action.payload] };
        case 'UPDATE_COMPONENT':
            return {
                ...state,
                components: state.components.map(c => c.id === action.payload.id ? action.payload : c),
            };
        case 'DELETE_COMPONENT':
            return {
                ...state,
                components: state.components.filter(c => c.id !== action.payload),
            };
        case 'ADD_SUPPLIER':
            return { ...state, suppliers: [...state.suppliers, action.payload] };
        case 'UPDATE_SUPPLIER':
            return {
                ...state,
                suppliers: state.suppliers.map(s => s.id === action.payload.id ? action.payload : s),
            };
        case 'DELETE_SUPPLIER':
            return {
                ...state,
                suppliers: state.suppliers.filter(s => s.id !== action.payload),
            };
        case 'ADD_PROJECT':
            return { ...state, projects: [...state.projects, action.payload] };
        case 'UPDATE_PROJECT':
            return {
                ...state,
                projects: state.projects.map(p => p.id === action.payload.id ? action.payload : p),
            };
        case 'DELETE_PROJECT':
            return {
                ...state,
                projects: state.projects.filter(p => p.id !== action.payload),
            };
        default:
            return state;
    }
};

export const AppContext = createContext<{
    state: AppState;
    loadInitialData: () => void;
    addComponent: (component: Omit<AnyComponent, 'id'>) => Promise<AnyComponent | undefined>;
    updateComponent: (component: AnyComponent) => Promise<void>;
    deleteComponent: (component: {id: string, type: string}) => Promise<void>;
    addSupplier: (supplier: Omit<Supplier, 'id'>) => Promise<Supplier | undefined>;
    updateSupplier: (supplier: Supplier) => Promise<void>;
    deleteSupplier: (id: string) => Promise<void>;
    addProject: (project: Omit<Project, 'id'>) => Promise<Project | undefined>;
    updateProject: (project: Project) => Promise<void>;
    deleteProject: (id: string) => Promise<void>;
    duplicateProject: (id: string) => Promise<Project | undefined>;
    savePdfToDrive: (fileName: string, folderName: string, base64Data: string) => Promise<{fileUrl: string} | undefined>;
}>({
    state: initialState,
    loadInitialData: () => {},
    addComponent: async () => undefined,
    updateComponent: async () => {},
    deleteComponent: async () => {},
    addSupplier: async () => undefined,
    updateSupplier: async () => {},
    deleteSupplier: async () => {},
    addProject: async () => undefined,
    updateProject: async () => {},
    deleteProject: async () => {},
    duplicateProject: async () => undefined,
    savePdfToDrive: async () => undefined,
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(appReducer, initialState);

    const loadInitialData = useCallback(async () => {
        dispatch({ type: 'SET_LOADING', payload: true });
        
        try {
            const data = await api.fetchAllData();
            dispatch({ type: 'SET_INITIAL_DATA', payload: data });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load data from Google Script.';
            const finalMessage = errorMessage.includes("administrator") 
              ? errorMessage 
              : `${errorMessage} Please check your Vercel environment variables or your script's permissions.`;
            dispatch({ type: 'SET_ERROR', payload: finalMessage });
            // Load empty data to prevent crashes on pages
            dispatch({ type: 'SET_INITIAL_DATA', payload: { components: [], suppliers: [], projects: [] } });
        }
    }, []);

    const performApiAction = async <T, U>(
      apiFunc: (data: T) => Promise<U>, 
      data: T, 
      successAction: (payload: U) => AppAction
    ) => {
        dispatch({ type: 'SET_LOADING', payload: true });
        try {
            const result = await apiFunc(data);
            dispatch(successAction(result));
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Operation failed';
            dispatch({ type: 'SET_ERROR', payload: `Operation failed: ${errorMessage}`});
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    };

    const performAddApiAction = async <T, U>(
      apiFunc: (data: T) => Promise<U>, 
      data: T, 
      successAction: (payload: U) => AppAction
    ): Promise<U | undefined> => {
        dispatch({ type: 'SET_LOADING', payload: true });
        try {
            const result = await apiFunc(data);
            if (result) {
                dispatch(successAction(result));
            }
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Operation failed';
            dispatch({ type: 'SET_ERROR', payload: `Operation failed: ${errorMessage}`});
            return undefined;
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    };
    
    const addComponent = (c: Omit<AnyComponent, 'id'>) => performAddApiAction(api.addComponent, c, (p) => ({type: 'ADD_COMPONENT', payload: p as AnyComponent}));
    const updateComponent = (c: AnyComponent) => performApiAction(api.updateComponent, c, (p) => ({type: 'UPDATE_COMPONENT', payload: p as AnyComponent}));
    const deleteComponent = (c: {id: string, type: string}) => performApiAction(api.deleteComponent, c, () => ({type: 'DELETE_COMPONENT', payload: c.id}));
    
    const addSupplier = (s: Omit<Supplier, 'id'>) => performAddApiAction(api.addSupplier, s, (p) => ({type: 'ADD_SUPPLIER', payload: p as Supplier}));
    const updateSupplier = (s: Supplier) => performApiAction(api.updateSupplier, s, (p) => ({type: 'UPDATE_SUPPLIER', payload: p as Supplier}));
    const deleteSupplier = (id: string) => performApiAction(api.deleteSupplier, id, () => ({type: 'DELETE_SUPPLIER', payload: id}));

    const addProject = (p: Omit<Project, 'id'>) => performAddApiAction(api.addProject, p, (p) => ({type: 'ADD_PROJECT', payload: p as Project}));
    const updateProject = (p: Project) => performApiAction(api.updateProject, p, (p) => ({type: 'UPDATE_PROJECT', payload: p as Project}));
    const deleteProject = (id: string) => performApiAction(api.deleteProject, id, () => ({type: 'DELETE_PROJECT', payload: id}));
    const duplicateProject = (id: string) => performAddApiAction(api.duplicateProject, id, p => ({type: 'ADD_PROJECT', payload: p as Project}));
    
    const savePdfToDrive = async (fileName: string, folderName: string, base64Data: string): Promise<{fileUrl: string} | undefined> => {
        dispatch({ type: 'SET_LOADING', payload: true });
        try {
            const result = await api.savePdfToDrive(fileName, folderName, base64Data);
            alert(`Successfully saved PDF to Google Drive folder: "${folderName}"`);
            return result;
        } catch (err)
 {
            const errorMessage = err instanceof Error ? err.message : 'Failed to save PDF';
            dispatch({ type: 'SET_ERROR', payload: `PDF Save Failed: ${errorMessage}`});
            return undefined;
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    };

    return (
        <AppContext.Provider value={{ state, loadInitialData, addComponent, updateComponent, deleteComponent, addSupplier, updateSupplier, deleteSupplier, addProject, updateProject, deleteProject, duplicateProject, savePdfToDrive }}>
            {children}
        </AppContext.Provider>
    );
};
