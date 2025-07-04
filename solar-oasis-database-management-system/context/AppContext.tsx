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
    deleteComponent: (id: string) => Promise<void>;
    addSupplier: (supplier: Omit<Supplier, 'id'>) => Promise<Supplier | undefined>;
    updateSupplier: (supplier: Supplier) => Promise<void>;
    deleteSupplier: (id: string) => Promise<void>;
    addProject: (project: Omit<Project, 'id'>) => Promise<Project | undefined>;
    updateProject: (project: Project) => Promise<void>;
    deleteProject: (id: string) => Promise<void>;
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
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(appReducer, initialState);

    const loadInitialData = useCallback(async () => {
        dispatch({ type: 'SET_LOADING', payload: true });
        
        const scriptUrl = localStorage.getItem('googleAppsScriptUrl');
        if (!scriptUrl) {
            dispatch({ type: 'SET_ERROR', payload: 'Google Apps Script URL is not configured.' });
             // Load empty data to prevent crashes on pages
            dispatch({ type: 'SET_INITIAL_DATA', payload: { components: [], suppliers: [], projects: [] } });
            return;
        }

        try {
            const data = await api.fetchAllData();
            dispatch({ type: 'SET_INITIAL_DATA', payload: data });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load data from Google Script.';
            dispatch({ type: 'SET_ERROR', payload: `${errorMessage} Please check the URL in Settings or your script's permissions.` });
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
            dispatch(successAction(result));
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
    const deleteComponent = (id: string) => performApiAction(api.deleteComponent, id, () => ({type: 'DELETE_COMPONENT', payload: id}));
    
    const addSupplier = (s: Omit<Supplier, 'id'>) => performAddApiAction(api.addSupplier, s, (p) => ({type: 'ADD_SUPPLIER', payload: p as Supplier}));
    const updateSupplier = (s: Supplier) => performApiAction(api.updateSupplier, s, (p) => ({type: 'UPDATE_SUPPLIER', payload: p as Supplier}));
    const deleteSupplier = (id: string) => performApiAction(api.deleteSupplier, id, () => ({type: 'DELETE_SUPPLIER', payload: id}));

    const addProject = (p: Omit<Project, 'id'>) => performAddApiAction(api.addProject, p, (p) => ({type: 'ADD_PROJECT', payload: p as Project}));
    const updateProject = (p: Project) => performApiAction(api.updateProject, p, (p) => ({type: 'UPDATE_PROJECT', payload: p as Project}));
    const deleteProject = (id: string) => performApiAction(api.deleteProject, id, () => ({type: 'DELETE_PROJECT', payload: id}));

    return (
        <AppContext.Provider value={{ state, loadInitialData, addComponent, updateComponent, deleteComponent, addSupplier, updateSupplier, deleteSupplier, addProject, updateProject, deleteProject }}>
            {children}
        </AppContext.Provider>
    );
};