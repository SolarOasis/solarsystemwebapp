
export const ComponentTypes = {
  SolarPanel: 'Solar Panels',
  Inverter: 'Inverters',
  Battery: 'Batteries',
  MountingSystem: 'Mounting Systems',
  Cable: 'Cables',
  MonitoringSystem: 'Monitoring Systems',
  ElectricCharger: 'Electric Chargers',
} as const;

export type ComponentType = typeof ComponentTypes[keyof typeof ComponentTypes];

interface BaseComponent {
  id: string;
  type: ComponentType;
  manufacturer: string;
  model: string;
  cost?: number; // cost per unit/meter
  supplierId: string;
}

export interface SolarPanel extends BaseComponent {
  type: typeof ComponentTypes.SolarPanel;
  wattage?: number;
  efficiency?: number;
  warranty?: number;
  technology?: string;
}

export interface Inverter extends BaseComponent {
  type: typeof ComponentTypes.Inverter;
  capacity?: number; // in kW
  inverterType?: 'String' | 'Central' | 'Micro';
  efficiency?: number;
  mpptChannels?: number;
}

export interface Battery extends BaseComponent {
  type: typeof ComponentTypes.Battery;
  capacity?: number; // in kWh
  batteryType?: 'Lithium' | 'Lead-acid';
  warranty?: number;
  depthOfDischarge?: number;
}

export interface MountingSystem extends BaseComponent {
  type: typeof ComponentTypes.MountingSystem;
  mountingType?: 'Roof' | 'Ground';
  material?: string;
  loadCapacity?: number;
}

export interface Cable extends BaseComponent {
  type: typeof ComponentTypes.Cable;
  cableType?: string;
  crossSection?: number; // in mm^2
}

export interface MonitoringSystem extends BaseComponent {
  type: typeof ComponentTypes.MonitoringSystem;
  features?: string[];
}

export interface ElectricCharger extends BaseComponent {
  type: typeof ComponentTypes.ElectricCharger;
  chargingSpeed?: number; // in kW
  connectorType?: 'Type 1' | 'Type 2' | 'CCS' | 'CHAdeMO';
}

export type AnyComponent = SolarPanel | Inverter | Battery | MountingSystem | Cable | MonitoringSystem | ElectricCharger;

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  specialization: ComponentType[];
}

export interface ClientInfo {
  name: string;
  contact: string;
  address: string;
}

export interface ProjectComponent {
  componentId: string;
  quantity: number;
  costAtTimeOfAdd: number; // The component's cost when it was added to the project
  sellingPrice?: number; // The final selling price per unit for this component, after markup/edits
}

export interface CostAnalysis {
  componentCosts: { componentId: string; cost: number; quantity: number }[]; // This is for internal analysis PDF only.
  totalMaterialCost: number; // Sum of component costs (costAtTimeOfAdd * quantity)
  installationCharges?: number; // Cost
  commissioningCharges?: number; // Cost
  electricalCost?: number; // Cost
  installationSellingPrice?: number;
  commissioningSellingPrice?: number;
  electricalSellingPrice?: number;
  markupPercentage?: number;
  totalProjectCost: number; // Total COGS = totalMaterialCost + all service charges costs
  finalSellingPrice: number; // Sum of all individual selling prices
  profitMargin: number;
  profitMarginPercentage: number;
  costPerKw: number;
  // Deprecated, calculated on the fly now
  markupAmount: number;
}

export interface Project {
  id: string;
  name: string;
  client: ClientInfo;
  location: string;
  systemCapacity: number; // in kW
  timeline: {
    startDate: string;
    endDate: string;
  };
  status: 'Planning' | 'In Progress' | 'Completed' | 'Cancelled';
  siteSurveyNotes: string;
  components: ProjectComponent[];
  costAnalysis: CostAnalysis;
}

// Context related types
export interface AppState {
    loading: boolean;
    error: string | null;
    components: AnyComponent[];
    suppliers: Supplier[];
    projects: Project[];
}

export type AppAction =
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'SET_INITIAL_DATA'; payload: { components: AnyComponent[]; suppliers: Supplier[]; projects: Project[] } }
    | { type: 'ADD_COMPONENT'; payload: AnyComponent }
    | { type: 'UPDATE_COMPONENT'; payload: AnyComponent }
    | { type: 'DELETE_COMPONENT'; payload: string }
    | { type: 'ADD_SUPPLIER'; payload: Supplier }
    | { type: 'UPDATE_SUPPLIER'; payload: Supplier }
    | { type: 'DELETE_SUPPLIER'; payload: string }
    | { type: 'ADD_PROJECT'; payload: Project }
    | { type: 'UPDATE_PROJECT'; payload: Project }
    | { type: 'DELETE_PROJECT'; payload: string };